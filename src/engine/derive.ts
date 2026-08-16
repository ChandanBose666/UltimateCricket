import {
  type BallEvent,
  type BatterCard,
  type InningsState,
  type Rules,
  type PlayerId,
} from './types';
import { reduce, initialState } from './reduce';

/**
 * THE DEFINITION OF TRUTH.
 * Everything rendered anywhere in the app is a cache of this fold.
 * Voided (undone) events are skipped, never deleted.
 */
export function derive(
  events: BallEvent[],
  rules: Rules,
  opening: { strikerId: PlayerId; nonStrikerId: PlayerId; bowlerId: PlayerId },
): InningsState {
  const start = initialState(opening.strikerId, opening.nonStrikerId, opening.bowlerId);
  return events.filter((e) => !e.voidedBy).reduce((s, e) => reduce(s, e, rules), start);
}

/** Balls -> "12.3". Overs are never stored or computed as decimals. */
export function formatOvers(balls: number): string {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

/** Balls -> overs as a true fraction, for run-rate maths only. */
export function oversAsFraction(balls: number): number {
  return balls / 6;
}

export function runRate(runs: number, balls: number): number {
  if (balls === 0) return 0;
  return runs / (balls / 6);
}

export function totalExtras(s: InningsState): number {
  const { wides, noBalls, byes, legByes } = s.extras;
  return wides + noBalls + byes + legByes;
}

export function scoreline(s: InningsState): string {
  return `${s.runs}/${s.wickets} (${formatOvers(s.legalBalls)})`;
}

/** Undo the most recent non-voided event by appending a void pointer. */
export function voidLast(events: BallEvent[], voidEventId: string): BallEvent[] {
  const idx = [...events].reverse().findIndex((e) => !e.voidedBy);
  if (idx === -1) return events;
  const realIdx = events.length - 1 - idx;
  return events.map((e, i) => (i === realIdx ? { ...e, voidedBy: voidEventId } : e));
}

/** Batting card in the order players came to the crease. */
export function battingCard(s: InningsState): BatterCard[] {
  return s.battingOrder
    .map((id) => s.batters[id])
    .filter((b): b is BatterCard => b !== undefined);
}

/** Bowling card, bowlers who have actually bowled. */
export function bowlingCard(s: InningsState) {
  return Object.values(s.bowlers).filter((b) => b.balls > 0 || b.runs > 0);
}
