/**
 * The scoring screen. The only screen judges will really exercise.
 *
 * House rules being honoured here:
 *  - NO cricket rule lives in this file. Strike rotation, free hits, what a
 *    wide does to the over count — all of that is the engine's. This file
 *    builds a candidate `BallEvent`, asks `isValid()`, and renders.
 *  - Illegal actions are DISABLED BUTTONS, never error toasts (§7).
 *  - Undo is always on screen, unlimited, no confirmation dialog.
 */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatOvers, runRate, scoreline, totalExtras } from '../engine/derive';
import { isLegalDelivery } from '../engine/reduce';
import type {
  BallEvent,
  ExtraType,
  InningsState,
  PlayerId,
  Rules,
  WicketKind,
} from '../engine/types';
import { isValid } from '../engine/validate';
import { useCanUndo, useInnings, useMatchStore } from '../store/matchStore';
import { useTossStore } from '../store/tossStore';
import { Card, Pill, Primary, s as c } from './components';
import { CREAM, FAINT, INK, LIME, LINE, MUTED, PANEL, SUNK, TAP, WARN } from './theme';

const RUN_BUTTONS = [0, 1, 2, 3, 4, 6];

const EXTRAS: { type: ExtraType; label: string }[] = [
  { type: 'WIDE', label: 'Wide' },
  { type: 'NO_BALL', label: 'No ball' },
  { type: 'BYE', label: 'Bye' },
  { type: 'LEG_BYE', label: 'Leg bye' },
];

const WICKET_KINDS: WicketKind[] = [
  'BOWLED',
  'CAUGHT',
  'LBW',
  'RUN_OUT',
  'STUMPED',
  'HIT_WICKET',
];

const kindLabel = (k: WicketKind) =>
  k.replace('_', ' ').toLowerCase().replace(/^./, (m) => m.toUpperCase());

export default function ScoringScreen() {
  const s = useInnings();
  const rules = useMatchStore((st) => st.rules);
  const events = useMatchStore((st) => st.events);
  const battingSide = useMatchStore((st) => st.battingSide);
  const homeSquad = useMatchStore((st) => st.homeSquad);
  const awaySquad = useMatchStore((st) => st.awaySquad);
  const recordBall = useMatchStore((st) => st.recordBall);
  const undo = useMatchStore((st) => st.undo);
  const canUndo = useCanUndo();

  const home = useTossStore((st) => st.home);
  const away = useTossStore((st) => st.away);

  const [armed, setArmed] = useState<ExtraType | null>(null);
  const [pick, setPick] = useState<{ over: number; id: PlayerId } | null>(null);
  const [wicketOpen, setWicketOpen] = useState(false);
  const [kind, setKind] = useState<WicketKind>('BOWLED');
  const [outId, setOutId] = useState<PlayerId | null>(null);
  const [newBatterId, setNewBatterId] = useState<PlayerId | null>(null);
  const [wicketRuns, setWicketRuns] = useState(0);
  const [crossed, setCrossed] = useState(false);

  if (s === null || battingSide === null) return null;

  const battingSquad = battingSide === 'home' ? homeSquad : awaySquad;
  const bowlingSquad = battingSide === 'home' ? awaySquad : homeSquad;
  const battingName = battingSide === 'home' ? home.name : away.name;

  const nameOf = (id: PlayerId | null): string => {
    if (id === null) return '—';
    return (
      battingSquad.find((p) => p.id === id)?.name ??
      bowlingSquad.find((p) => p.id === id)?.name ??
      id
    );
  };

  // --- which bowler is on? At an over boundary the scorer must choose. ------
  const overIdx = Math.floor(s.legalBalls / 6);
  const needsBowler = s.legalBalls > 0 && s.legalBalls % 6 === 0 && s.status === 'IN_PROGRESS';
  const picked = pick !== null && pick.over === overIdx ? pick.id : null;
  const bowlerId = needsBowler ? picked : s.bowlerId;

  const base = (bId: PlayerId) => ({
    strikerId: s.strikerId ?? '',
    nonStrikerId: s.nonStrikerId ?? '',
    bowlerId: bId,
  });

  const draftFor = (n: number, bId: PlayerId): Omit<BallEvent, 'id'> => {
    const b = { ...base(bId), wicket: null };
    switch (armed) {
      case null:
        return { ...b, runsOffBat: n, extraType: null, extraRuns: 0 };
      case 'WIDE':
        return { ...b, runsOffBat: 0, extraType: 'WIDE', extraRuns: n };
      case 'NO_BALL':
        return { ...b, runsOffBat: n, extraType: 'NO_BALL', extraRuns: 0 };
      default:
        return { ...b, runsOffBat: 0, extraType: armed, extraRuns: n };
    }
  };

  const wicketDraft = (k: WicketKind, bId: PlayerId): Omit<BallEvent, 'id'> => ({
    ...base(bId),
    runsOffBat: wicketRuns,
    extraType: null,
    extraRuns: 0,
    wicket: { kind: k, outPlayerId: outId ?? s.strikerId ?? '', crossed },
    ...(newBatterId !== null ? { newBatterId } : {}),
  });

  const probe = (d: Omit<BallEvent, 'id'>) => isValid(s, { ...d, id: 'probe' }, rules);

  const resetWicketPanel = () => {
    setWicketOpen(false);
    setKind('BOWLED');
    setOutId(null);
    setNewBatterId(null);
    setWicketRuns(0);
    setCrossed(false);
  };

  const yetToBat = battingSquad.filter((p) => !s.battingOrder.includes(p.id));
  const live = s.status === 'IN_PROGRESS';

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* --------------------------------------------------- scoreboard -- */}
        <View style={styles.board}>
          <Text style={styles.team}>{battingName}</Text>
          <Text style={styles.score}>{scoreline(s)}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>CRR {runRate(s.runs, s.legalBalls).toFixed(2)}</Text>
            <Text style={styles.meta}>
              {formatOvers(s.legalBalls)} of {rules.oversLimit}
            </Text>
            <Text style={styles.meta}>EX {totalExtras(s)}</Text>
          </View>
        </View>

        {s.freeHitNext && live && (
          <View style={styles.freeHit}>
            <Text style={styles.freeHitText}>FREE HIT — only a run out counts</Text>
          </View>
        )}

        <Card>
          <BatterLine
            name={nameOf(s.strikerId)}
            runs={s.strikerId !== null ? (s.batters[s.strikerId]?.runs ?? 0) : 0}
            balls={s.strikerId !== null ? (s.batters[s.strikerId]?.balls ?? 0) : 0}
            onStrike
          />
          <BatterLine
            name={nameOf(s.nonStrikerId)}
            runs={s.nonStrikerId !== null ? (s.batters[s.nonStrikerId]?.runs ?? 0) : 0}
            balls={s.nonStrikerId !== null ? (s.batters[s.nonStrikerId]?.balls ?? 0) : 0}
          />
          <View style={styles.divider} />
          <View style={styles.bowlerRow}>
            <Text style={styles.bowlerName}>{nameOf(bowlerId)}</Text>
            <Text style={styles.bowlerFigs}>{bowlerFigures(s, bowlerId)}</Text>
          </View>
          <OverStrip events={events} />
        </Card>

        {/* ------------------------------------------------ innings over -- */}
        {!live && (
          <Card title="Innings complete">
            <Text style={styles.done}>{statusLine(s)}</Text>
            <Text style={styles.doneSub}>
              {battingName} {scoreline(s)}
            </Text>
          </Card>
        )}

        {/* -------------------------------------------- new bowler needed -- */}
        {live && needsBowler && picked === null && (
          <Card title={`Over ${overIdx} complete — who bowls next?`}>
            <View style={c.wrap}>
              {bowlingSquad.map((p) => (
                <Pill
                  key={p.id}
                  label={p.name}
                  disabled={p.id === s.previousBowlerId}
                  onPress={() => setPick({ over: overIdx, id: p.id })}
                />
              ))}
            </View>
            <Text style={styles.hint}>
              {nameOf(s.previousBowlerId)} just bowled and cannot bowl consecutive overs.
            </Text>
          </Card>
        )}

        {/* ------------------------------------------------ wicket panel -- */}
        {live && wicketOpen && bowlerId !== null && (
          <Card title="Wicket">
            <Text style={styles.label}>How out</Text>
            <View style={c.wrap}>
              {WICKET_KINDS.map((k) => (
                <Pill
                  key={k}
                  label={kindLabel(k)}
                  selected={kind === k}
                  disabled={!kindAllowed(s, k, rules, base(bowlerId), outId, crossed, wicketRuns)}
                  onPress={() => setKind(k)}
                />
              ))}
            </View>

            <Text style={styles.label}>Who is out</Text>
            <View style={c.wrap}>
              {[s.strikerId, s.nonStrikerId].map((id) =>
                id === null ? null : (
                  <Pill
                    key={id}
                    label={nameOf(id)}
                    selected={(outId ?? s.strikerId) === id}
                    onPress={() => setOutId(id)}
                  />
                ),
              )}
            </View>

            <Text style={styles.label}>Runs completed</Text>
            <View style={c.wrap}>
              {[0, 1, 2, 3].map((n) => (
                <Pill
                  key={n}
                  label={String(n)}
                  selected={wicketRuns === n}
                  onPress={() => setWicketRuns(n)}
                />
              ))}
              <Pill
                label={crossed ? 'Crossed ✓' : 'Crossed'}
                selected={crossed}
                onPress={() => setCrossed((x) => !x)}
              />
            </View>

            {yetToBat.length > 0 && (
              <>
                <Text style={styles.label}>New batter</Text>
                <View style={c.wrap}>
                  {yetToBat.map((p) => (
                    <Pill
                      key={p.id}
                      label={p.name}
                      selected={newBatterId === p.id}
                      onPress={() => setNewBatterId(p.id)}
                    />
                  ))}
                </View>
              </>
            )}

            <View style={styles.panelActions}>
              <Pressable style={styles.cancel} onPress={resetWicketPanel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <View style={styles.grow}>
                <Primary
                  label="Record wicket"
                  disabled={!probe(wicketDraft(kind, bowlerId))}
                  onPress={() => {
                    if (recordBall(wicketDraft(kind, bowlerId))) resetWicketPanel();
                  }}
                />
              </View>
            </View>
          </Card>
        )}

        {/* --------------------------------------------------- the pad ---- */}
        {live && !wicketOpen && bowlerId !== null && (
          <>
            <Card title="Extra">
              <View style={c.wrap}>
                {EXTRAS.map((x) => (
                  <Pill
                    key={x.type}
                    label={x.label}
                    selected={armed === x.type}
                    onPress={() => setArmed((a) => (a === x.type ? null : x.type))}
                  />
                ))}
              </View>
              <Text style={styles.hint}>{armedHint(armed)}</Text>
            </Card>

            <View style={styles.pad}>
              {RUN_BUTTONS.map((n) => {
                const d = draftFor(n, bowlerId);
                return (
                  <Pressable
                    key={n}
                    style={[styles.run, !probe(d) && styles.runOff]}
                    disabled={!probe(d)}
                    onPress={() => {
                      if (recordBall(d)) setArmed(null);
                    }}
                  >
                    <Text style={styles.runText}>{n}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={styles.wicketBtn}
              onPress={() => {
                setWicketOpen(true);
                setOutId(s.strikerId);
                // Open on a dismissal that is actually legal right now, so the
                // panel never starts on a greyed-out option.
                setKind(s.freeHitNext ? 'RUN_OUT' : 'BOWLED');
              }}
            >
              <Text style={styles.wicketText}>WICKET</Text>
            </Pressable>
          </>
        )}

        <Pressable
          style={[styles.undo, !canUndo && c.disabled]}
          disabled={!canUndo}
          onPress={undo}
        >
          <Text style={styles.undoText}>↶ Undo last ball</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/**
 * Some dismissals are illegal on a free hit. We still want the pill visible and
 * greyed rather than missing, so a kind is enabled if the ONLY thing wrong with
 * it is something unrelated (e.g. no new batter picked yet).
 */
function kindAllowed(
  s: InningsState,
  k: WicketKind,
  rules: Rules,
  b: { strikerId: PlayerId; nonStrikerId: PlayerId; bowlerId: PlayerId },
  outId: PlayerId | null,
  crossed: boolean,
  runs: number,
): boolean {
  const e: BallEvent = {
    ...b,
    id: 'probe',
    runsOffBat: runs,
    extraType: null,
    extraRuns: 0,
    wicket: { kind: k, outPlayerId: outId ?? s.strikerId ?? '', crossed },
    newBatterId: 'probe-batter',
  };
  return isValid(s, e, rules);
}

function bowlerFigures(s: InningsState, bowlerId: PlayerId | null): string {
  if (bowlerId === null) return '—';
  const b = s.bowlers[bowlerId];
  if (b === undefined) return '0.0-0-0-0';
  return `${formatOvers(b.balls)}-${b.maidens}-${b.runs}-${b.wickets}`;
}

function statusLine(s: InningsState): string {
  switch (s.status) {
    case 'ALL_OUT':
      return 'All out.';
    case 'OVERS_DONE':
      return 'Overs complete.';
    case 'TARGET_CHASED':
      return 'Target chased.';
    default:
      return '';
  }
}

function armedHint(armed: ExtraType | null): string {
  switch (armed) {
    case null:
      return 'Tap the runs scored off the bat.';
    case 'WIDE':
      return 'Tap any EXTRA runs run on top of the wide. Usually 0.';
    case 'NO_BALL':
      return 'Tap the runs off the bat. The no-ball penalty is added for you.';
    case 'BYE':
      return 'Tap the byes run. Not credited to the batter.';
    case 'LEG_BYE':
      return 'Tap the leg byes run. Not credited to the batter.';
  }
}

function BatterLine({
  name,
  runs,
  balls,
  onStrike,
}: {
  name: string;
  runs: number;
  balls: number;
  onStrike?: boolean;
}) {
  return (
    <View style={styles.batterRow}>
      <Text style={[styles.batterName, onStrike === true && styles.onStrike]}>
        {name}
        {onStrike === true ? ' *' : ''}
      </Text>
      <Text style={styles.batterScore}>
        {runs} ({balls})
      </Text>
    </View>
  );
}

/** The current over, as a scorer would write it. */
function OverStrip({ events }: { events: BallEvent[] }) {
  const live = events.filter((e) => !e.voidedBy);
  const byOver: Record<number, string[]> = {};
  let legal = 0;

  for (const e of live) {
    const idx = Math.floor(legal / 6);
    const arr = byOver[idx] ?? [];
    arr.push(ballLabel(e));
    byOver[idx] = arr;
    if (isLegalDelivery(e)) legal += 1;
  }

  const strip = byOver[Math.floor(legal / 6)] ?? [];
  if (strip.length === 0) return null;

  return (
    <View style={styles.strip}>
      {strip.map((label, i) => (
        <View key={i} style={styles.chip}>
          <Text style={styles.chipText}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function ballLabel(e: BallEvent): string {
  if (e.wicket !== null) return 'W';
  switch (e.extraType) {
    case 'WIDE':
      return e.extraRuns > 0 ? `${e.extraRuns}wd` : 'wd';
    case 'NO_BALL':
      return e.runsOffBat > 0 ? `${e.runsOffBat}nb` : 'nb';
    case 'BYE':
      return `${e.extraRuns}b`;
    case 'LEG_BYE':
      return `${e.extraRuns}lb`;
    default:
      return e.runsOffBat === 0 ? '•' : String(e.runsOffBat);
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: INK },
  scroll: { padding: 20, paddingBottom: 64, maxWidth: 560, width: '100%', alignSelf: 'center' },

  board: { paddingTop: 28, paddingBottom: 14 },
  team: { color: LIME, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  score: { color: CREAM, fontSize: 46, fontWeight: '800', marginTop: 4 },
  metaRow: { flexDirection: 'row', gap: 16, marginTop: 4 },
  meta: { color: MUTED, fontSize: 13 },

  freeHit: {
    backgroundColor: '#3a2a10',
    borderColor: WARN,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  freeHitText: { color: WARN, fontWeight: '800', fontSize: 13, letterSpacing: 1 },

  batterRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  batterName: { color: MUTED, fontSize: 15 },
  onStrike: { color: CREAM, fontWeight: '700' },
  batterScore: { color: CREAM, fontSize: 15, fontWeight: '600' },

  divider: { height: 1, backgroundColor: LINE, marginVertical: 10 },
  bowlerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  bowlerName: { color: MUTED, fontSize: 15 },
  bowlerFigs: { color: CREAM, fontSize: 15, fontWeight: '600' },

  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  chip: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: SUNK,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  chipText: { color: CREAM, fontSize: 12, fontWeight: '700' },

  label: { color: MUTED, fontSize: 12, marginTop: 12, marginBottom: 6 },
  hint: { color: FAINT, fontSize: 12, marginTop: 10 },

  pad: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  run: {
    width: '30.9%',
    minHeight: 76,
    borderRadius: 12,
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  runOff: { opacity: 0.3 },
  runText: { color: CREAM, fontSize: 26, fontWeight: '800' },

  wicketBtn: {
    minHeight: 60,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#5c2626',
    backgroundColor: '#2a1414',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wicketText: { color: '#ff8f8f', fontSize: 17, fontWeight: '800', letterSpacing: 2 },

  panelActions: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 16 },
  grow: { flex: 1 },
  cancel: {
    minHeight: TAP,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: LINE,
  },
  cancelText: { color: MUTED, fontSize: 14 },

  undo: {
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  undoText: { color: CREAM, fontSize: 15, fontWeight: '600' },

  done: { color: CREAM, fontSize: 20, fontWeight: '800' },
  doneSub: { color: MUTED, fontSize: 15, marginTop: 6 },
});
