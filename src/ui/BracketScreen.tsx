/**
 * The knockout draw.
 *
 * Everything here is read from `useBracket()` — the fold over recorded results.
 * The screen never advances a team itself; it records a winner and re-renders
 * whatever the fold then says the draw looks like.
 */

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { teamNameFor, TOURNAMENT_TEAMS } from '../bracket/teams';
import { ROUND_NAMES, TIES, type SlotSource } from '../bracket/shape';
import type { Round, Tie } from '../bracket/types';
import { useBracket, useBracketStore } from '../store/bracketStore';
import { useMatch } from '../store/matchStore';
import { Card } from './components';
import { CREAM, FAINT, INK, LIME, LINE, MUTED, PANEL, SUNK, TAP } from './theme';

const ROUNDS: Round[] = [0, 1, 2];

/** What to show in a slot that has no team yet: "Winner of QF1". */
function slotLabel(tie: Tie, side: 'home' | 'away'): string {
  const shape = TIES.find((t) => t.id === tie.id);
  const src: SlotSource | undefined = side === 'home' ? shape?.home : shape?.away;
  if (src === undefined) return 'TBC';
  return src.kind === 'WINNER' ? `Winner of ${src.of}` : 'TBC';
}

function seedOf(teamId: string | null): string {
  const team = TOURNAMENT_TEAMS.find((t) => t.id === teamId);
  return team === undefined ? '' : String(team.seed);
}

function TeamLine({ tie, side }: { tie: Tie; side: 'home' | 'away' }) {
  const teamId = side === 'home' ? tie.homeId : tie.awayId;
  const won = tie.result !== null && tie.result.winnerId === teamId;

  return (
    <View style={styles.teamLine}>
      <Text style={[styles.seed, teamId === null && styles.pending]}>{seedOf(teamId)}</Text>
      <Text
        style={[styles.teamName, teamId === null && styles.pending, won && styles.winner]}
        numberOfLines={1}
      >
        {teamId === null ? slotLabel(tie, side) : teamNameFor(teamId)}
      </Text>
      {won && <Text style={styles.tick}>✓</Text>}
    </View>
  );
}

function TieCard({ tie }: { tie: Tie }) {
  const activeTieId = useBracketStore((s) => s.activeTieId);
  const startTie = useBracketStore((s) => s.startTie);
  const setView = useBracketStore((s) => s.setView);
  const { phase } = useMatch();

  const isActive = activeTieId === tie.id;
  const matchLive = phase !== 'NO_MATCH' && phase !== 'COMPLETE';
  // Starting a tie resets the match slot, so say so rather than silently
  // discarding someone's half-scored innings.
  const wouldDiscard = matchLive && activeTieId !== null && activeTieId !== tie.id;

  return (
    <View style={styles.tie}>
      <Text style={styles.tieId}>{tie.id}</Text>

      <View style={styles.teams}>
        <TeamLine tie={tie} side="home" />
        <View style={styles.divider} />
        <TeamLine tie={tie} side="away" />
      </View>

      {tie.result !== null && <Text style={styles.summary}>{tie.result.summary}</Text>}

      {isActive ? (
        <Pressable style={[styles.action, styles.resume]} onPress={() => setView('MATCH')}>
          <Text style={styles.resumeText}>Resume this tie →</Text>
        </Pressable>
      ) : tie.playable ? (
        <Pressable style={[styles.action, styles.play]} onPress={() => startTie(tie.id)}>
          <Text style={styles.playText}>Play this tie</Text>
        </Pressable>
      ) : tie.result !== null ? (
        <Pressable style={styles.action} onPress={() => startTie(tie.id)}>
          <Text style={styles.replayText}>Replay</Text>
        </Pressable>
      ) : (
        <Text style={styles.awaiting}>Awaiting both sides</Text>
      )}

      {wouldDiscard && (tie.playable || tie.result !== null) && (
        <Text style={styles.warnNote}>Discards the match in progress.</Text>
      )}
    </View>
  );
}

export default function BracketScreen() {
  const bracket = useBracket();
  const setView = useBracketStore((s) => s.setView);
  const resetBracket = useBracketStore((s) => s.resetBracket);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>KNOCKOUT · 8 TEAMS</Text>
          <Text style={styles.title}>The draw</Text>
        </View>

        {bracket.champion !== null && (
          <Card>
            <Text style={styles.championLabel}>CHAMPION</Text>
            <Text style={styles.championName}>{teamNameFor(bracket.champion)}</Text>
          </Card>
        )}

        {ROUNDS.map((round) => (
          <View key={round} style={styles.round}>
            <Text style={styles.roundName}>{ROUND_NAMES[round].toUpperCase()}</Text>
            {bracket.ties
              .filter((t) => t.round === round)
              .map((t) => (
                <TieCard key={t.id} tie={t} />
              ))}
          </View>
        ))}

        <Pressable style={styles.secondary} onPress={() => setView('MATCH')}>
          <Text style={styles.secondaryText}>← Back to the match</Text>
        </Pressable>

        <Pressable style={styles.secondary} onPress={resetBracket}>
          <Text style={styles.clearText}>Clear the draw</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: INK },
  scroll: { padding: 20, paddingBottom: 48, maxWidth: 560, width: '100%', alignSelf: 'center' },

  header: { paddingTop: 28, paddingBottom: 18 },
  eyebrow: { color: LIME, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  title: { color: CREAM, fontSize: 30, fontWeight: '800', marginTop: 6 },

  championLabel: { color: LIME, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  championName: { color: CREAM, fontSize: 26, fontWeight: '800', marginTop: 6 },

  round: { marginBottom: 22 },
  roundName: { color: MUTED, fontSize: 11, letterSpacing: 2, fontWeight: '700', marginBottom: 10 },

  tie: {
    backgroundColor: PANEL,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: LINE,
    padding: 14,
    marginBottom: 10,
  },
  tieId: { color: FAINT, fontSize: 10, letterSpacing: 1.5, fontWeight: '700', marginBottom: 8 },

  teams: { backgroundColor: SUNK, borderRadius: 10, paddingHorizontal: 12 },
  teamLine: { flexDirection: 'row', alignItems: 'center', minHeight: 42, gap: 10 },
  divider: { height: 1, backgroundColor: LINE },
  seed: { color: FAINT, fontSize: 11, width: 14, fontWeight: '700' },
  teamName: { color: CREAM, fontSize: 15, flex: 1 },
  winner: { color: LIME, fontWeight: '700' },
  pending: { color: FAINT, fontStyle: 'italic' },
  tick: { color: LIME, fontSize: 14, fontWeight: '800' },

  summary: { color: MUTED, fontSize: 12, marginTop: 10 },

  action: {
    minHeight: TAP,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  play: { backgroundColor: LIME, borderColor: LIME },
  playText: { color: INK, fontSize: 15, fontWeight: '800' },
  resume: { borderColor: LIME },
  resumeText: { color: LIME, fontSize: 15, fontWeight: '700' },
  replayText: { color: MUTED, fontSize: 14, fontWeight: '600' },

  awaiting: { color: FAINT, fontSize: 12, marginTop: 12, textAlign: 'center' },
  warnNote: { color: FAINT, fontSize: 11, marginTop: 6, textAlign: 'center' },

  secondary: { minHeight: TAP, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  secondaryText: { color: CREAM, fontSize: 15, fontWeight: '600' },
  clearText: { color: FAINT, fontSize: 13 },
});
