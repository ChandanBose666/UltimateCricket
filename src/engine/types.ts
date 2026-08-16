/**
 * UltimateCricket scoring engine — types.
 *
 * This module (and every module in src/engine) is PURE:
 *   no React, no storage, no network, no Date.now(), no Math.random().
 * Inputs in, state out. That is what makes it testable and shareable.
 */

export type PlayerId = string;

export type WicketKind =
  | 'BOWLED'
  | 'CAUGHT'
  | 'LBW'
  | 'RUN_OUT'
  | 'STUMPED'
  | 'HIT_WICKET';

/** Dismissals still valid on a free hit. */
export const FREE_HIT_LEGAL_DISMISSALS: readonly WicketKind[] = ['RUN_OUT'];

export type ExtraType = 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE';

export interface Wicket {
  kind: WicketKind;
  /** Who is out. NOT necessarily the striker — run-outs can dismiss either batter. */
  outPlayerId: PlayerId;
  fielderId?: PlayerId;
  /**
   * Did the batters physically cross before the dismissal completed?
   * Only consulted when no runs were completed off the ball; otherwise the
   * parity of runs run governs which end the new batter takes.
   */
  crossed?: boolean;
}

export interface BallEvent {
  id: string;

  /** Who was where when the ball was bowled. */
  strikerId: PlayerId;
  nonStrikerId: PlayerId;
  bowlerId: PlayerId;

  /** Runs off the bat. Only credited to the batter on a legal ball or a no-ball. */
  runsOffBat: number;

  extraType: ExtraType | null;

  /**
   * Additional runs beyond the automatic penalty.
   *  WIDE     -> extra runs run/boundary on top of rules.wideRuns
   *  NO_BALL  -> byes taken off the no-ball (NOT charged to the bowler)
   *  BYE/LEG_BYE -> the byes/leg-byes themselves
   *  null     -> must be 0
   */
  extraRuns: number;

  wicket: Wicket | null;

  /** Required when `wicket` is set and a replacement batter comes in. */
  newBatterId?: PlayerId;

  /**
   * Manual override for which end the new batter takes. The engine's default
   * (see reduce.ts) is right for the common cases; run-outs at the far end are
   * genuinely ambiguous, so the scorer can force it.
   */
  newBatterOnStrike?: boolean;

  /** Undo: points at the event that voided this one. Never delete, never mutate. */
  voidedBy?: string | null;
}

export interface Rules {
  oversLimit: number;
  playersPerSide: number;
  wideRuns: number;
  noBallRuns: number;
  freeHitAfterNoBall: boolean;
  /** Batter may continue alone after the second-last wicket. */
  lastManStands: boolean;
  /** Chase target (runs needed to win). Undefined in the first innings. */
  target?: number;
}

export const DEFAULT_RULES: Rules = {
  oversLimit: 20,
  playersPerSide: 11,
  wideRuns: 1,
  noBallRuns: 1,
  freeHitAfterNoBall: true,
  lastManStands: false,
};

export interface BatterCard {
  playerId: PlayerId;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: Wicket | null;
}

export interface BowlerFigures {
  playerId: PlayerId;
  /** Legal deliveries only. Format with formatOvers(). */
  balls: number;
  /** Runs off bat + wides + no-ball penalties. Byes and leg-byes excluded. */
  runs: number;
  wickets: number;
  maidens: number;
}

export interface Extras {
  wides: number;
  noBalls: number;
  byes: number;
  legByes: number;
}

export type InningsStatus =
  | 'IN_PROGRESS'
  | 'ALL_OUT'
  | 'OVERS_DONE'
  | 'TARGET_CHASED';

export interface InningsState {
  runs: number;
  wickets: number;
  /** Legal deliveries bowled. Overs are ALWAYS balls internally, never decimals. */
  legalBalls: number;

  strikerId: PlayerId | null;
  nonStrikerId: PlayerId | null;
  bowlerId: PlayerId | null;
  /** Bowler of the previous completed over — may not bowl the next one. */
  previousBowlerId: PlayerId | null;

  /** True when the NEXT delivery is a free hit. */
  freeHitNext: boolean;

  batters: Record<PlayerId, BatterCard>;
  bowlers: Record<PlayerId, BowlerFigures>;
  extras: Extras;

  /** Batting order as players arrived at the crease. */
  battingOrder: PlayerId[];

  status: InningsStatus;

  /** Runs conceded by the current bowler in the current over (for maidens). */
  runsThisOver: number;
}

export type ViolationCode =
  | 'INNINGS_OVER'
  | 'CONSECUTIVE_OVERS'
  | 'UNKNOWN_STRIKER'
  | 'STRIKER_IS_NON_STRIKER'
  | 'NEGATIVE_RUNS'
  | 'RUNS_OFF_BAT_ON_DEAD_EXTRA'
  | 'EXTRA_RUNS_WITHOUT_EXTRA'
  | 'FREE_HIT_ILLEGAL_DISMISSAL'
  | 'MISSING_NEW_BATTER'
  | 'OUT_PLAYER_NOT_AT_CREASE';

export interface Violation {
  code: ViolationCode;
  message: string;
}
