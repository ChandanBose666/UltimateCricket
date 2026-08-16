import {
  type BallEvent,
  type InningsState,
  type Rules,
  type Violation,
  FREE_HIT_LEGAL_DISMISSALS,
} from './types';
import { isLegalDelivery } from './reduce';

/**
 * Is this event legal in this state? Drives DISABLED BUTTONS in the UI,
 * not error toasts. If validate() returns a violation the user should never
 * have been able to tap the control in the first place.
 */
export function validate(state: InningsState, e: BallEvent, rules: Rules): Violation[] {
  const v: Violation[] = [];
  const push = (code: Violation['code'], message: string) => v.push({ code, message });

  if (state.status !== 'IN_PROGRESS') {
    push('INNINGS_OVER', `The innings is already over (${state.status}).`);
  }

  if (e.strikerId === e.nonStrikerId) {
    push('STRIKER_IS_NON_STRIKER', 'Striker and non-striker cannot be the same player.');
  }

  if (e.runsOffBat < 0 || e.extraRuns < 0) {
    push('NEGATIVE_RUNS', 'Runs cannot be negative.');
  }

  // A wide is not struck, so nothing can come off the bat.
  if (e.extraType === 'WIDE' && e.runsOffBat > 0) {
    push('RUNS_OFF_BAT_ON_DEAD_EXTRA', 'A wide cannot have runs off the bat.');
  }
  // Byes and leg-byes are by definition not off the bat.
  if ((e.extraType === 'BYE' || e.extraType === 'LEG_BYE') && e.runsOffBat > 0) {
    push('RUNS_OFF_BAT_ON_DEAD_EXTRA', 'Byes and leg-byes cannot have runs off the bat.');
  }
  if (e.extraType === null && e.extraRuns > 0) {
    push('EXTRA_RUNS_WITHOUT_EXTRA', 'extraRuns requires an extraType.');
  }

  // A bowler may not bowl two overs in succession.
  const atOverStart = state.legalBalls % 6 === 0;
  if (
    atOverStart &&
    isLegalDelivery(e) &&
    state.previousBowlerId !== null &&
    e.bowlerId === state.previousBowlerId
  ) {
    push('CONSECUTIVE_OVERS', 'A bowler cannot bowl two consecutive overs.');
  }

  if (e.wicket) {
    if (
      state.freeHitNext &&
      !FREE_HIT_LEGAL_DISMISSALS.includes(e.wicket.kind)
    ) {
      push(
        'FREE_HIT_ILLEGAL_DISMISSAL',
        `On a free hit the batter cannot be out ${e.wicket.kind.toLowerCase().replace('_', ' ')}.`,
      );
    }

    const atCrease =
      e.wicket.outPlayerId === e.strikerId || e.wicket.outPlayerId === e.nonStrikerId;
    if (!atCrease) {
      push('OUT_PLAYER_NOT_AT_CREASE', 'The dismissed player is not at the crease.');
    }

    // A replacement is needed unless this wicket ends the innings.
    const allOutAt = rules.lastManStands
      ? rules.playersPerSide
      : rules.playersPerSide - 1;
    const endsInnings = state.wickets + 1 >= allOutAt;
    if (!endsInnings && !e.newBatterId) {
      push('MISSING_NEW_BATTER', 'A new batter must be selected.');
    }
  }

  return v;
}

export const isValid = (s: InningsState, e: BallEvent, r: Rules): boolean =>
  validate(s, e, r).length === 0;
