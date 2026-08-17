/**
 * Bracket validation. Mirrors src/engine/validate.ts: it returns reasons, it
 * never throws and never mutates.
 *
 * This is what drives the UI. A tie that cannot be recorded is a DISABLED
 * button, not an error toast — ask `canRecord()` before rendering a control and
 * use the violation message to explain why.
 *
 * PURE.
 */

import { tieById } from './derive';
import type {
  BracketState,
  BracketViolation,
  BracketViolationCode,
  TeamId,
  TieId,
} from './types';

const v = (code: BracketViolationCode, message: string): BracketViolation => ({ code, message });

export function validateResult(
  s: BracketState,
  tieId: TieId,
  winnerId: TeamId,
): BracketViolation[] {
  const tie = tieById(s, tieId);
  if (tie === null) return [v('UNKNOWN_TIE', 'That tie is not in the draw.')];

  if (tie.homeId === null || tie.awayId === null) {
    return [
      v('PARTICIPANTS_UNKNOWN', 'Both sides of this tie must be decided before it can be played.'),
    ];
  }

  if (winnerId !== tie.homeId && winnerId !== tie.awayId) {
    return [v('WINNER_NOT_IN_TIE', 'That team is not playing this tie.')];
  }

  // A decided tie is deliberately still recordable. Judges mis-tap, and the
  // fold in derive.ts drops whatever later results a replay invalidates.
  return [];
}

export function canRecord(s: BracketState, tieId: TieId, winnerId: TeamId): boolean {
  return validateResult(s, tieId, winnerId).length === 0;
}
