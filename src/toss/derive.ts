/**
 * Derived views over the toss. Mirrors src/engine/derive.ts.
 *
 * `deriveToss` is the fold: an append-only action log reduced to state, same
 * definition of truth as the ball log. Persist the actions, render the fold.
 *
 * PURE.
 */

import { initialTossState, reduceToss } from './reduce';
import { umpiresIn } from './validate';
import type {
  MatchOfficial,
  TeamId,
  TossAction,
  TossMethod,
  TossRecord,
  TossState,
} from './types';

/** The fold. Invalid actions in the log are skipped, never applied. */
export function deriveToss(
  tossedBy: TeamId,
  calledBy: TeamId,
  method: TossMethod,
  actions: readonly TossAction[],
): TossState {
  return actions.reduce(reduceToss, initialTossState(tossedBy, calledBy, method));
}

export function umpires(s: TossState): MatchOfficial[] {
  return umpiresIn(s.officials);
}

/** No umpire assigned ⇒ the toss runs on both-captains-confirm. */
export function isCaptainsConfirmFallback(s: TossState): boolean {
  return umpiresIn(s.officials).length === 0;
}

/** Is the toss settled? The only gate the match flow should read. */
export function isTossComplete(s: TossState): boolean {
  return s.phase === 'COMPLETE' && s.record !== null;
}

/** Which side bats first, given a completed toss. Null until then. */
export function battingFirst(s: TossState): TeamId | null {
  const r = s.record;
  if (r === null) return null;
  const loser = r.wonBy === r.tossedBy ? r.calledBy : r.tossedBy;
  return r.decision === 'BAT' ? r.wonBy : loser;
}

/**
 * The scorecard header line:
 *   "Mumbai Colts won the toss and elected to bat. Umpire: R. Sharma."
 */
export function tossSummary(r: TossRecord, teamNames: Record<TeamId, string>): string {
  const name = teamNames[r.wonBy] ?? r.wonBy;
  const verb = r.decision === 'BAT' ? 'bat' : 'field';
  const officials = umpiresIn(r.witnessedBy);

  if (officials.length === 0) {
    return `${name} won the toss and elected to ${verb}.`;
  }
  const label = officials.length === 1 ? 'Umpire' : 'Umpires';
  return `${name} won the toss and elected to ${verb}. ${label}: ${officials
    .map((o) => o.name)
    .join(', ')}.`;
}
