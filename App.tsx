import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { useMatch, useMatchStore } from './src/store/matchStore';
import { useTossState, useTossStore } from './src/store/tossStore';
import { isTossComplete } from './src/toss/derive';
import InningsBreakScreen from './src/ui/InningsBreakScreen';
import InningsSetupScreen from './src/ui/InningsSetupScreen';
import ResultScreen from './src/ui/ResultScreen';
import ScoringScreen from './src/ui/ScoringScreen';
import TossScreen from './src/ui/TossScreen';
import { FAINT, INK, LINE } from './src/ui/theme';

/**
 * Routing is a fold over state, not a navigation stack — toss, openers,
 * scoring, break, chase, result. No navigation dependency, and every reload
 * lands exactly where the match actually is.
 */
export default function App() {
  const toss = useTossState();
  const { phase } = useMatch();
  const resetMatch = useMatchStore((s) => s.resetMatch);
  const resetToss = useTossStore((s) => s.resetToss);

  // The only piece of pure UI state: has the scorer left the break screen to
  // pick the chasing openers? Losing it on reload just shows the break again.
  const [chaseSetup, setChaseSetup] = useState(false);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      {!isTossComplete(toss) ? (
        <TossScreen />
      ) : phase === 'NO_MATCH' ? (
        <InningsSetupScreen />
      ) : phase === 'BREAK' ? (
        chaseSetup ? (
          <InningsSetupScreen />
        ) : (
          <InningsBreakScreen onStartChase={() => setChaseSetup(true)} />
        )
      ) : phase === 'COMPLETE' ? (
        <ResultScreen />
      ) : (
        <ScoringScreen />
      )}

      {/* §7 — judge #3 must not inherit judge #2's mess. */}
      <View style={styles.bar}>
        <Pressable
          style={styles.reset}
          onPress={() => {
            resetMatch();
            resetToss();
            setChaseSetup(false);
          }}
        >
          <Text style={styles.resetText}>Reset demo</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: INK },
  bar: { borderTopWidth: 1, borderTopColor: LINE, alignItems: 'center' },
  reset: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 20 },
  resetText: { color: FAINT, fontSize: 13 },
});
