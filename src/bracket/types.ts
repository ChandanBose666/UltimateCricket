/**
 * UltimateCricket knockout bracket — types.
 *
 * This module (and every module in src/bracket) is PURE:
 *   no React, no storage, no network, no Date.now(), no Math.random().
 *
 * The only recorded state is `BracketResults` — who won each tie. Everything
 * else, including who is playing whom, is derived. Same discipline as the ball
 * log in src/engine and the action log in src/toss.
 */

export type TeamId = string;

/** Seven ties: four quarter-finals, two semi-finals, one final. */
export type TieId = 'QF1' | 'QF2' | 'QF3' | 'QF4' | 'SF1' | 'SF2' | 'F';

/** 0 = quarter-finals, 1 = semi-finals, 2 = final. */
export type Round = 0 | 1 | 2;

export interface BracketTeam {
  id: TeamId;
  /** 1..8. Determines the first-round pairings — see shape.ts. */
  seed: number;
  name: string;
}

export interface TieResult {
  winnerId: TeamId;
  /**
   * The finished match in one line, e.g. "Mumbai Colts won by 14 runs".
   * A snapshot, not a link: the ball log of a finished tie is not retained.
   */
  summary: string;
}

/** The whole recorded state of a tournament. */
export type BracketResults = Partial<Record<TieId, TieResult>>;

export interface Tie {
  id: TieId;
  round: Round;
  /** Null until the feeding tie has been decided. */
  homeId: TeamId | null;
  awayId: TeamId | null;
  result: TieResult | null;
  /** Both participants known and nothing recorded yet — this tie can be played. */
  playable: boolean;
}

export interface BracketState {
  /** Fixed order: QF1..QF4, SF1, SF2, F. Feeders always precede their tie. */
  ties: Tie[];
  champion: TeamId | null;
}

export type BracketViolationCode =
  | 'UNKNOWN_TIE'
  | 'PARTICIPANTS_UNKNOWN'
  | 'WINNER_NOT_IN_TIE';

export interface BracketViolation {
  code: BracketViolationCode;
  message: string;
}
