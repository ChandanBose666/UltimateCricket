/**
 * Innings break: the first innings scorecard, the target, and the way into
 * the chase. Nothing here can change a recorded ball.
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { scoreline } from '../engine/derive';
import { useMatch, useMatchStore, otherSide } from '../store/matchStore';
import { useTossStore } from '../store/tossStore';
import { Card, Primary, Undo } from './components';
import { Scorecard } from './Scorecard';
import { CREAM, INK, LIME, MUTED } from './theme';

export default function InningsBreakScreen({ onStartChase }: { onStartChase: () => void }) {
  const { innings } = useMatch();
  const homeSquad = useMatchStore((s) => s.homeSquad);
  const awaySquad = useMatchStore((s) => s.awaySquad);
  const home = useTossStore((s) => s.home);
  const away = useTossStore((s) => s.away);

  const first = innings[0];
  if (first === undefined) return null;

  const battingSide = first.record.battingSide;
  const chasingSide = otherSide(battingSide);
  const nameFor = (side: 'home' | 'away') => (side === 'home' ? home.name : away.name);
  const squadFor = (side: 'home' | 'away') => (side === 'home' ? homeSquad : awaySquad);

  const target = first.state.runs + 1;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>INNINGS BREAK</Text>
          <Text style={styles.title}>
            {nameFor(battingSide)} {scoreline(first.state)}
          </Text>
        </View>

        <Card>
          <Text style={styles.targetLabel}>{nameFor(chasingSide)} need</Text>
          <Text style={styles.target}>{target}</Text>
          <Text style={styles.targetSub}>
            to win from {first.rules.oversLimit} overs
          </Text>
        </Card>

        <Scorecard
          title={`${nameFor(battingSide)} — batting`}
          state={first.state}
          events={first.record.events}
          battingSquad={squadFor(battingSide)}
          bowlingSquad={squadFor(chasingSide)}
        />

        <Primary label="Start the chase" onPress={onStartChase} />

        {/* The last ball of an innings is the easiest one to mis-tap. */}
        <Undo />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: INK },
  scroll: { padding: 20, paddingBottom: 64, maxWidth: 560, width: '100%', alignSelf: 'center' },
  header: { paddingTop: 32, paddingBottom: 20 },
  eyebrow: { color: LIME, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  title: { color: CREAM, fontSize: 28, fontWeight: '800', marginTop: 8 },

  targetLabel: { color: MUTED, fontSize: 13 },
  target: { color: LIME, fontSize: 48, fontWeight: '800', marginTop: 2 },
  targetSub: { color: MUTED, fontSize: 13, marginTop: 2 },
});
