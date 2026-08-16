/**
 * Toss validation. Mirrors src/engine/validate.ts: it returns reasons, it never
 * throws and never mutates.
 *
 * This is what drives the UI. Illegal actions are DISABLED BUTTONS, not error
 * toasts — ask `isValidToss()` before rendering a control, and use the
 * violation message as the tooltip / helper text when you need to explain why.
 *
 * PURE.
 */

import { verifyReveal } from './commit';
import {
  UMPIRE_ROLES,
  type Actor,
  type MatchOfficial,
  type TossAction,
  type TossPhase,
  type TossState,
  type TossViolation,
  type TossViolationCode,
} from './types';

const v = (code: TossViolationCode, message: string): TossViolation => ({ code, message });

export function umpiresIn(officials: readonly MatchOfficial[]): MatchOfficial[] {
  return officials.filter((o) => UMPIRE_ROLES.includes(o.role));
}

/**
 * Law 13.4 — the toss happens in the presence of one or both umpires.
 *
 * If an umpire is assigned, only that umpire may start, witness the outcome and
 * confirm. If none is assigned we fall back to both captains acting together,
 * because in gully and school cricket there frequently is no umpire and a
 * required field would lock out most users. A lone captain is never enough.
 */
export function authorised(s: TossState, actor: Actor): boolean {
  const ump = umpiresIn(s.officials);
  if (ump.length === 0) return actor.kind === 'BOTH_CAPTAINS';
  return actor.kind === 'UMPIRE' && ump.some((o) => o.role === actor.role);
}

function isCaptainOf(actor: Actor, teamId: string | null): boolean {
  return teamId !== null && actor.kind === 'CAPTAIN' && actor.teamId === teamId;
}

export function validateToss(s: TossState, a: TossAction): TossViolation[] {
  // Law 13.5 — once notified and confirmed, the decision cannot be changed.
  // There is deliberately no action that reopens a completed toss.
  if (s.phase === 'COMPLETE') {
    return [
      v('TOSS_COMPLETE', 'The toss is confirmed. Law 13.5 — the decision cannot be changed.'),
    ];
  }

  const out: TossViolation[] = [];
  const phase = (...allowed: TossPhase[]) => {
    if (!allowed.includes(s.phase)) {
      out.push(v('WRONG_PHASE', `Not available at this point in the toss (${s.phase}).`));
      return false;
    }
    return true;
  };
  const notAuthorised = (why: string) => out.push(v('NOT_AUTHORISED', why));

  switch (a.type) {
    case 'ASSIGN_OFFICIAL':
      phase('SETUP');
      if (a.official.name.trim() === '') {
        out.push(v('EMPTY_OFFICIAL_NAME', 'An official needs a name.'));
      }
      break;

    case 'REMOVE_OFFICIAL':
    case 'SET_METHOD':
      phase('SETUP');
      break;

    case 'START_TOSS':
      if (phase('SETUP')) {
        if (!authorised(s, a.actor)) {
          notAuthorised(
            umpiresIn(s.officials).length > 0
              ? 'Only the assigned umpire may start the toss (Law 13.4).'
              : 'With no umpire assigned, both captains must start the toss together.',
          );
        }
        if (s.tossedBy === s.calledBy) {
          out.push(v('SAME_TEAM', 'A side cannot toss against itself.'));
        }
        if (s.method === 'DIGITAL' && !a.commitHash) {
          out.push(v('COMMIT_REQUIRED', 'The digital toss must commit to a nonce before the call.'));
        }
        if (s.method === 'PHYSICAL_COIN' && a.commitHash) {
          out.push(v('COMMIT_NOT_APPLICABLE', 'A physical coin toss does not commit to a hash.'));
        }
      }
      break;

    case 'RECORD_CALL':
      if (phase('AWAITING_CALL') && !isCaptainOf(a.actor, s.calledBy)) {
        notAuthorised('Only the visiting captain calls the toss.');
      }
      break;

    case 'REVEAL':
      if (phase('AWAITING_REVEAL')) {
        if (!authorised(s, a.actor)) notAuthorised('Only the umpire may reveal the toss.');
        if (s.commitHash !== null && !verifyReveal(s.commitHash, a.nonce)) {
          out.push(v('COMMIT_MISMATCH', 'This nonce does not match the published commit.'));
        }
      }
      break;

    case 'RECORD_OUTCOME':
      if (phase('AWAITING_OUTCOME')) {
        if (!authorised(s, a.actor)) notAuthorised('Only the umpire may record who won the toss.');
        if (a.wonBy !== s.tossedBy && a.wonBy !== s.calledBy) {
          out.push(v('UNKNOWN_TEAM', 'That team is not playing this match.'));
        }
      }
      break;

    case 'RECORD_DECISION':
      // Still editable at AWAITING_CONFIRMATION: the captain has decided but the
      // umpire has not yet been notified, so Law 13.5 has not bitten.
      if (phase('AWAITING_DECISION', 'AWAITING_CONFIRMATION') && !isCaptainOf(a.actor, s.wonBy)) {
        notAuthorised('Only the captain who won the toss may choose to bat or field.');
      }
      break;

    case 'CONFIRM':
      if (phase('AWAITING_CONFIRMATION') && !authorised(s, a.actor)) {
        notAuthorised('Only the umpire may confirm the toss.');
      }
      break;
  }

  return out;
}

export function isValidToss(s: TossState, a: TossAction): boolean {
  return validateToss(s, a).length === 0;
}
