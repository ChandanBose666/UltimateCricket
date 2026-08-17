/**
 * Match complete: the result and both full scorecards.
 *
 * The result sentence comes from the engine's `resultText()`, so a tie is a
 * tie and never "won by 0 runs".
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { teamNameFor } from '../bracket/teams';
import { scoreline } from '../engine/derive';
import { resultText } from '../engine/summary';
import { useActiveTie, useBracketStore } from '../store/bracketStore';
import { otherSide, useMatch, useMatchStore, type Side } from '../store/matchStore';
import { useTossStore } from '../store/tossStore';
import { Card, Note, Primary, Undo } from './components';
import { Scorecard } from './Scorecard';
import { CREAM, INK, LIME, MUTED } from './theme';

export default function ResultScreen() {
  const { innings, result } = useMatch();
  const homeSquad = useMatchStore((s) => s.homeSquad);
  const awaySquad = useMatchStore((s) => s.awaySquad);
  const home = useTossStore((s) => s.home);
  const away = useTossStore((s) => s.away);
  const tie = useActiveTie();
  const recordResult = useBracketStore((s) => s.recordResult);
  const startTie = useBracketStore((s) => s.startTie);

  const first = innings[0];
  const second = innings[1];
  if (first === undefined || second === undefined) return null;

  const nameFor = (side: Side) => (side === 'home' ? home.name : away.name);
  const squadFor = (side: Side) => (side === 'home' ? homeSquad : awaySquad);

  const firstSide = first.record.battingSide;
  const secondSide = second.record.battingSide;
  const summary = resultText(result, nameFor(firstSide), nameFor(secondSide));

  // Which side of the tie won. A tie has no winner and cannot advance anyone —
  // no super over in this build (plan §1), so the knockout tie is replayed.
  const winningSide: Side | null =
    result.kind === 'WON_BY_RUNS' ? firstSide : result.kind === 'WON_BY_WICKETS' ? secondSide : null;
  const winnerId =
    tie === null || winningSide === null ? null : winningSide === 'home' ? tie.homeId : tie.awayId;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>MATCH COMPLETE</Text>
          <Text style={styles.result}>{summary}</Text>
        </View>

        <Card>
          <View style={styles.line}>
            <Text style={styles.team}>{nameFor(firstSide)}</Text>
            <Text style={styles.score}>{scoreline(first.state)}</Text>
          </View>
          <View style={styles.line}>
            <Text style={styles.team}>{nameFor(secondSide)}</Text>
            <Text style={styles.score}>{scoreline(second.state)}</Text>
          </View>
        </Card>

        {tie !== null && (
          <Card title={`${tie.id} · knockout`}>
            {winnerId !== null ? (
              <>
                <Note>
                  Posting the result advances {teamNameFor(winnerId)} in the draw. The ball log
                  ends here — the bracket keeps the scoreline.
                </Note>
                <Primary
                  label={`Record result → ${teamNameFor(winnerId)}`}
                  onPress={() => recordResult(tie.id, { winnerId, summary })}
                />
              </>
            ) : (
              <>
                <Note>
                  A tied knockout match advances nobody. There is no super over in this build, so
                  the tie is replayed.
                </Note>
                <Primary label="Replay this tie" onPress={() => startTie(tie.id)} />
              </>
            )}
          </Card>
        )}

        <Scorecard
          title={`${nameFor(firstSide)} — 1st innings`}
          state={first.state}
          events={first.record.events}
          battingSquad={squadFor(firstSide)}
          bowlingSquad={squadFor(otherSide(firstSide))}
        />

        <Scorecard
          title={`${nameFor(secondSide)} — 2nd innings`}
          state={second.state}
          events={second.record.events}
          battingSquad={squadFor(secondSide)}
          bowlingSquad={squadFor(otherSide(secondSide))}
        />

        {/* A result is not a dead end — the last ball can still be undone. */}
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
  result: { color: CREAM, fontSize: 28, fontWeight: '800', marginTop: 8, lineHeight: 34 },

  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  team: { color: MUTED, fontSize: 15 },
  score: { color: CREAM, fontSize: 15, fontWeight: '700' },
});
