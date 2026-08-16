/**
 * Match-level derivations: the result, the chase, and dismissal attribution.
 *
 * An ADDITION to the engine, not a change to it — nothing in this file touches
 * reduce/validate/derive. Same discipline: pure, no clock, no randomness.
 */

import type { BallEvent, InningsState, PlayerId, Rules } from './types';

/** Wickets a side still has standing. */
export function wicketsInHand(s: InningsState, rules: Rules): number {
  const allOutAt = rules.lastManStands ? rules.playersPerSide : rules.playersPerSide - 1;
  return Math.max(0, allOutAt - s.wickets);
}

export type MatchResult =
  | { kind: 'IN_PROGRESS' }
  | { kind: 'WON_BY_RUNS'; winner: 'FIRST'; margin: number }
  | { kind: 'WON_BY_WICKETS'; winner: 'SECOND'; margin: number }
  | { kind: 'TIE' };

/**
 * Who won. `first` batted first, `second` chased.
 * Level scores is a TIE — never "won by 0 runs".
 */
export function resultOf(
  first: InningsState,
  second: InningsState,
  rules: Rules,
): MatchResult {
  if (second.status === 'IN_PROGRESS') return { kind: 'IN_PROGRESS' };

  if (second.runs > first.runs) {
    return { kind: 'WON_BY_WICKETS', winner: 'SECOND', margin: wicketsInHand(second, rules) };
  }
  if (second.runs < first.runs) {
    return { kind: 'WON_BY_RUNS', winner: 'FIRST', margin: first.runs - second.runs };
  }
  return { kind: 'TIE' };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function resultText(r: MatchResult, firstName: string, secondName: string): string {
  switch (r.kind) {
    case 'IN_PROGRESS':
      return 'Match in progress.';
    case 'WON_BY_RUNS':
      return `${firstName} won by ${plural(r.margin, 'run')}.`;
    case 'WON_BY_WICKETS':
      return `${secondName} won by ${plural(r.margin, 'wicket')}.`;
    case 'TIE':
      return 'Match tied.';
  }
}

export interface ChaseState {
  target: number;
  runsNeeded: number;
  ballsRemaining: number;
  /** Runs per OVER still required. Zero when nothing is left to get. */
  requiredRate: number;
}

/** Null in an innings with no target set. */
export function chaseState(s: InningsState, rules: Rules): ChaseState | null {
  if (rules.target === undefined) return null;

  const runsNeeded = Math.max(0, rules.target - s.runs);
  const ballsRemaining = Math.max(0, rules.oversLimit * 6 - s.legalBalls);
  const requiredRate = ballsRemaining === 0 ? 0 : runsNeeded / (ballsRemaining / 6);

  return { target: rules.target, runsNeeded, ballsRemaining, requiredRate };
}

/**
 * Which bowler is credited with dismissing this batter.
 *
 * Ask this only for batters the fold reports as out (`batters[id].out !== null`).
 * That way the free-hit rule stays where it belongs — in reduce() — instead of
 * being re-implemented here and drifting out of step with it.
 */
export function bowlerForDismissal(
  events: readonly BallEvent[],
  playerId: PlayerId,
): PlayerId | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!;
    if (e.voidedBy) continue;
    if (e.wicket !== null && e.wicket.outPlayerId === playerId) return e.bowlerId;
  }
  return null;
}
