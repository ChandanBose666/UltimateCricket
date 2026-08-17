import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { useBracketStore, type AppView } from './src/store/bracketStore';
import { resetToDemo } from './src/store/demo';
import { useMatch } from './src/store/matchStore';
import { useTossState } from './src/store/tossStore';
import { isTossComplete } from './src/toss/derive';
import BracketScreen from './src/ui/BracketScreen';
import { ErrorBoundary } from './src/ui/ErrorBoundary';
import InningsBreakScreen from './src/ui/InningsBreakScreen';
import InningsSetupScreen from './src/ui/InningsSetupScreen';
import ResultScreen from './src/ui/ResultScreen';
import ScoringScreen from './src/ui/ScoringScreen';
import TossScreen from './src/ui/TossScreen';
import { FAINT, INK, LIME, LINE } from './src/ui/theme';

/**
 * Routing is a fold over state, not a navigation stack — toss, openers,
 * scoring, break, chase, result. No navigation dependency, and every reload
 * lands exactly where the match actually is.
 *
 * The bracket sits beside that fold rather than above it: the match stays the
 * landing screen (§7 — a judge should arrive mid-innings, not at a menu) and
 * the draw is one tap away.
 */
/**
 * The routing fold itself, deliberately a SEPARATE component from App.
 *
 * `useTossState()` and `useMatch()` fold persisted data, so corrupt storage
 * makes them throw. React only catches a throw from a component BELOW the
 * boundary — if these hooks ran in App's own body the boundary above them
 * could never fire, and the judge would get a white page.
 */
function Screens({
  view,
  chaseSetup,
  onStartChase,
}: {
  view: AppView;
  chaseSetup: boolean;
  onStartChase: () => void;
}) {
  const toss = useTossState();
  const { phase } = useMatch();

  if (view === 'BRACKET') return <BracketScreen />;
  if (!isTossComplete(toss)) return <TossScreen />;
  if (phase === 'NO_MATCH') return <InningsSetupScreen />;
  if (phase === 'BREAK') {
    return chaseSetup ? <InningsSetupScreen /> : <InningsBreakScreen onStartChase={onStartChase} />;
  }
  if (phase === 'COMPLETE') return <ResultScreen />;
  return <ScoringScreen />;
}

export default function App() {
  // Only cheap, non-throwing state up here: everything that folds persisted
  // data lives in <Screens/>, inside the boundary.
  const view = useBracketStore((s) => s.view);
  const setView = useBracketStore((s) => s.setView);

  // The only piece of pure UI state: has the scorer left the break screen to
  // pick the chasing openers? Losing it on reload just shows the break again.
  const [chaseSetup, setChaseSetup] = useState(false);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      {/* The bar below stays OUTSIDE the boundary, so a screen that throws
          still leaves the judge a way back to the bracket and the reset. */}
      <ErrorBoundary>
        <Screens view={view} chaseSetup={chaseSetup} onStartChase={() => setChaseSetup(true)} />
      </ErrorBoundary>

      {/* §7 — judge #3 must not inherit judge #2's mess. */}
      <View style={styles.bar}>
        <Pressable
          style={styles.barItem}
          onPress={() => setView(view === 'BRACKET' ? 'MATCH' : 'BRACKET')}
        >
          <Text style={styles.navText}>{view === 'BRACKET' ? 'Match' : 'Tournament'}</Text>
        </Pressable>
        <Pressable
          style={styles.barItem}
          onPress={() => {
            resetToDemo();
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
  bar: {
    flexDirection: 'row',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: LINE,
  },
  barItem: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 20 },
  navText: { color: LIME, fontSize: 13, fontWeight: '700' },
  resetText: { color: FAINT, fontSize: 13 },
});
