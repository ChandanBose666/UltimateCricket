/**
 * The last line of defence (plan §7).
 *
 * Judges will tap the thing that was never tested. A render that throws must
 * not leave them staring at a blank page with no way out — so the fallback is
 * not an apology, it is a working "put it back" button.
 *
 * A class component because that is the only way to catch a render error in
 * React; there is no hook equivalent.
 */

import { Component, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { resetToDemo } from '../store/demo';
import { CREAM, INK, LIME, MUTED, TAP } from './theme';

interface Props {
  children: ReactNode;
}

interface State {
  message: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { message: null };

  static getDerivedStateFromError(error: unknown): State {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  override componentDidCatch(error: unknown): void {
    // No crash reporter in this build — the console is the whole story.
    console.error('[UltimateCricket] render failed:', error);
  }

  private readonly recover = () => {
    resetToDemo();
    this.setState({ message: null });
  };

  override render(): ReactNode {
    const { message } = this.state;
    if (message === null) return this.props.children;

    return (
      <View style={styles.root}>
        <Text style={styles.eyebrow}>SOMETHING BROKE</Text>
        <Text style={styles.title}>That screen failed to draw.</Text>
        <Text style={styles.body}>
          The ball log is safe — it is append-only and still on this device. Resetting puts the
          demo match back so you can carry on.
        </Text>
        <Pressable style={styles.button} onPress={this.recover}>
          <Text style={styles.buttonText}>Reset the demo and continue</Text>
        </Pressable>
        <Text style={styles.detail}>{message}</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: INK, padding: 24, justifyContent: 'center' },
  eyebrow: { color: LIME, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  title: { color: CREAM, fontSize: 26, fontWeight: '800', marginTop: 8 },
  body: { color: MUTED, fontSize: 14, lineHeight: 20, marginTop: 12 },
  button: {
    minHeight: 56,
    borderRadius: 12,
    backgroundColor: LIME,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  buttonText: { color: INK, fontSize: 16, fontWeight: '800' },
  detail: { color: '#5f7a6d', fontSize: 11, marginTop: 18, minHeight: TAP },
});
