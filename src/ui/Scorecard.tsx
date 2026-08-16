/**
 * Full batting and bowling cards for one innings.
 *
 * Pure presentation over the fold — it computes nothing about cricket beyond
 * formatting. Strike rate and economy are arithmetic on engine output, and
 * dismissal attribution comes from `bowlerForDismissal()`.
 */

import { StyleSheet, Text, View } from 'react-native';

import { battingCard, bowlingCard, formatOvers, totalExtras } from '../engine/derive';
import { bowlerForDismissal } from '../engine/summary';
import type { BallEvent, BatterCard, InningsState, PlayerId } from '../engine/types';
import type { Player } from '../store/matchStore';
import { Card } from './components';
import { CREAM, FAINT, LIME, LINE, MUTED } from './theme';

export function Scorecard({
  title,
  state,
  events,
  battingSquad,
  bowlingSquad,
}: {
  title: string;
  state: InningsState;
  events: BallEvent[];
  battingSquad: Player[];
  bowlingSquad: Player[];
}) {
  const nameOf = (id: PlayerId | null): string => {
    if (id === null) return '';
    return (
      battingSquad.find((p) => p.id === id)?.name ??
      bowlingSquad.find((p) => p.id === id)?.name ??
      id
    );
  };

  const batters = battingCard(state);
  const bowlers = bowlingCard(state);
  const batted = new Set(batters.map((b) => b.playerId));
  const didNotBat = battingSquad.filter((p) => !batted.has(p.id));
  const { wides, noBalls, byes, legByes } = state.extras;

  return (
    <>
      <Card title={title}>
        <View style={[s.row, s.head]}>
          <Text style={[s.name, s.headText]}>Batter</Text>
          <Text style={[s.num, s.headText]}>R</Text>
          <Text style={[s.num, s.headText]}>B</Text>
          <Text style={[s.num, s.headText]}>4s</Text>
          <Text style={[s.num, s.headText]}>6s</Text>
          <Text style={[s.sr, s.headText]}>SR</Text>
        </View>

        {batters.map((b) => (
          <View key={b.playerId} style={s.row}>
            <View style={s.name}>
              <Text style={[s.player, b.out === null && s.notOut]} numberOfLines={1}>
                {nameOf(b.playerId)}
              </Text>
              <Text style={s.how} numberOfLines={1}>
                {dismissalText(b, events, nameOf)}
              </Text>
            </View>
            <Text style={[s.num, s.strong]}>{b.runs}</Text>
            <Text style={s.num}>{b.balls}</Text>
            <Text style={s.num}>{b.fours}</Text>
            <Text style={s.num}>{b.sixes}</Text>
            <Text style={s.sr}>{strikeRate(b)}</Text>
          </View>
        ))}

        <View style={s.divider} />

        <View style={s.row}>
          <Text style={[s.name, s.player]}>Extras</Text>
          <Text style={[s.num, s.strong]}>{totalExtras(state)}</Text>
          <Text style={s.spread}>
            (b {byes}, lb {legByes}, w {wides}, nb {noBalls})
          </Text>
        </View>

        <View style={s.row}>
          <Text style={[s.name, s.total]}>Total</Text>
          <Text style={[s.num, s.total]}>{state.runs}</Text>
          <Text style={s.spread}>
            {state.wickets} wkts, {formatOvers(state.legalBalls)} ov
          </Text>
        </View>

        {didNotBat.length > 0 && (
          <Text style={s.dnb}>
            Did not bat: {didNotBat.map((p) => p.name).join(', ')}
          </Text>
        )}
      </Card>

      <Card title="Bowling">
        <View style={[s.row, s.head]}>
          <Text style={[s.name, s.headText]}>Bowler</Text>
          <Text style={[s.num, s.headText]}>O</Text>
          <Text style={[s.num, s.headText]}>M</Text>
          <Text style={[s.num, s.headText]}>R</Text>
          <Text style={[s.num, s.headText]}>W</Text>
          <Text style={[s.sr, s.headText]}>Econ</Text>
        </View>

        {bowlers.map((b) => (
          <View key={b.playerId} style={s.row}>
            <Text style={[s.name, s.player]} numberOfLines={1}>
              {nameOf(b.playerId)}
            </Text>
            <Text style={s.num}>{formatOvers(b.balls)}</Text>
            <Text style={s.num}>{b.maidens}</Text>
            <Text style={s.num}>{b.runs}</Text>
            <Text style={[s.num, s.strong]}>{b.wickets}</Text>
            <Text style={s.sr}>{economy(b.runs, b.balls)}</Text>
          </View>
        ))}
      </Card>
    </>
  );
}

function strikeRate(b: BatterCard): string {
  if (b.balls === 0) return '—';
  return ((b.runs / b.balls) * 100).toFixed(1);
}

function economy(runs: number, balls: number): string {
  if (balls === 0) return '—';
  return (runs / (balls / 6)).toFixed(2);
}

/** Standard scorebook notation. */
export function dismissalText(
  b: BatterCard,
  events: BallEvent[],
  nameOf: (id: PlayerId | null) => string,
): string {
  if (b.out === null) return 'not out';

  const bowlerId = bowlerForDismissal(events, b.playerId);
  const bowler = nameOf(bowlerId);
  const fielder = b.out.fielderId !== undefined ? nameOf(b.out.fielderId) : '';

  switch (b.out.kind) {
    case 'BOWLED':
      return `b ${bowler}`;
    case 'LBW':
      return `lbw b ${bowler}`;
    case 'CAUGHT':
      if (fielder === '') return `c b ${bowler}`;
      return fielder === bowler ? `c & b ${bowler}` : `c ${fielder} b ${bowler}`;
    case 'STUMPED':
      return fielder === '' ? `st b ${bowler}` : `st ${fielder} b ${bowler}`;
    case 'HIT_WICKET':
      return `hit wicket b ${bowler}`;
    case 'RUN_OUT':
      return fielder === '' ? 'run out' : `run out (${fielder})`;
  }
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  head: { borderBottomWidth: 1, borderBottomColor: LINE, paddingBottom: 8, marginBottom: 2 },
  headText: { color: FAINT, fontSize: 11, fontWeight: '700' },

  name: { flex: 1, paddingRight: 8 },
  player: { color: CREAM, fontSize: 14 },
  notOut: { color: LIME },
  how: { color: MUTED, fontSize: 11, marginTop: 1 },

  num: { width: 34, textAlign: 'right', color: MUTED, fontSize: 13 },
  sr: { width: 50, textAlign: 'right', color: MUTED, fontSize: 13 },
  strong: { color: CREAM, fontWeight: '700' },

  divider: { height: 1, backgroundColor: LINE, marginVertical: 8 },
  spread: { flex: 1, textAlign: 'right', color: MUTED, fontSize: 12 },
  total: { color: CREAM, fontSize: 15, fontWeight: '800' },

  dnb: { color: MUTED, fontSize: 12, marginTop: 12, lineHeight: 17 },
});
