/**
 * UltimateCricket toss module — types.
 *
 * Same discipline as src/engine: this module is PURE.
 *   no React, no storage, no network, no Date.now(), no Math.random().
 * Timestamps and nonces are INPUTS on the action, supplied by the caller.
 * The single impure helper lives in ./entropy.ts and is not imported here.
 *
 * Modelled on MCC Laws of Cricket:
 *   Law 13.4 — the captains toss in the presence of one or both umpires.
 *   Law 13.5 — once the winning captain notifies the bat/field decision,
 *              it cannot be changed. There is no edit path out of COMPLETE.
 */

export type TeamId = string;
export type PlayerId = string;

export type CoinFace = 'HEADS' | 'TAILS';
export type TossDecision = 'BAT' | 'FIELD';
export type TossMethod = 'DIGITAL' | 'PHYSICAL_COIN';

export type OfficialRole = 'UMPIRE_1' | 'UMPIRE_2' | 'SCORER';

/** Roles that satisfy Law 13.4's "in the presence of one or both umpires". */
export const UMPIRE_ROLES: readonly OfficialRole[] = ['UMPIRE_1', 'UMPIRE_2'];

export interface MatchOfficial {
  role: OfficialRole;
  name: string;
  /** Often a player or a parent, not a neutral official. */
  playerId?: PlayerId;
}

/**
 * Who is performing an action.
 *
 * BOTH_CAPTAINS is the fallback for gully and school cricket, where there is
 * frequently no umpire at all. The umpire is an assignable, OPTIONAL role —
 * never a required field. See validate.ts `authorised()`.
 */
export type Actor =
  | { kind: 'UMPIRE'; role: OfficialRole }
  | { kind: 'CAPTAIN'; teamId: TeamId }
  | { kind: 'BOTH_CAPTAINS' };

export type TossPhase =
  | 'SETUP'
  /** DIGITAL: commit published, waiting for the visiting captain to call. */
  | 'AWAITING_CALL'
  /** DIGITAL: call is in, waiting to reveal the nonce. */
  | 'AWAITING_REVEAL'
  /** PHYSICAL_COIN: the real coin has been tossed, record who won. */
  | 'AWAITING_OUTCOME'
  /** Winning captain picks BAT or FIELD. */
  | 'AWAITING_DECISION'
  /** Umpire (or both captains) confirms. Law 13.5 completes here. */
  | 'AWAITING_CONFIRMATION'
  | 'COMPLETE';

/**
 * The frozen, immutable outcome. Written exactly once, at CONFIRM.
 * `record !== null` is the only thing downstream code should read.
 */
export interface TossRecord {
  /** Home side tosses the coin (Law 13.4). */
  tossedBy: TeamId;
  /** Visiting side calls. */
  calledBy: TeamId;
  /**
   * Always present in DIGITAL. Optional in PHYSICAL_COIN: the two-tap fast
   * path records only who won, because the 22 people watching the real coin
   * land are the trust mechanism.
   */
  call?: CoinFace;
  result?: CoinFace;
  wonBy: TeamId;
  /** Law 13.5 — immutable once confirmed. */
  decision: TossDecision;
  method: TossMethod;
  /** Empty ⇒ fell back to both-captains-confirm. */
  witnessedBy: MatchOfficial[];
  confirmedAt: number;
  /** DIGITAL only — SHA-256 of the nonce, published before the call. */
  commitHash?: string;
  nonce?: string;
}

export interface TossState {
  phase: TossPhase;
  method: TossMethod;
  /** Home side. Tosses the coin. */
  tossedBy: TeamId;
  /** Visiting side. Calls. */
  calledBy: TeamId;
  officials: MatchOfficial[];

  call: CoinFace | null;
  result: CoinFace | null;
  wonBy: TeamId | null;
  decision: TossDecision | null;

  commitHash: string | null;
  /** Revealed nonce. Null until REVEAL. */
  nonce: string | null;

  confirmedAt: number | null;
  record: TossRecord | null;
}

export type TossAction =
  | { type: 'ASSIGN_OFFICIAL'; actor: Actor; official: MatchOfficial }
  | { type: 'REMOVE_OFFICIAL'; actor: Actor; role: OfficialRole }
  | { type: 'SET_METHOD'; actor: Actor; method: TossMethod }
  /** DIGITAL requires `commitHash`; the caller keeps the nonce secret. */
  | { type: 'START_TOSS'; actor: Actor; commitHash?: string }
  | { type: 'RECORD_CALL'; actor: Actor; call: CoinFace }
  | { type: 'REVEAL'; actor: Actor; nonce: string }
  | { type: 'RECORD_OUTCOME'; actor: Actor; wonBy: TeamId }
  | { type: 'RECORD_DECISION'; actor: Actor; decision: TossDecision }
  | { type: 'CONFIRM'; actor: Actor; at: number };

export type TossViolationCode =
  | 'TOSS_COMPLETE'
  | 'WRONG_PHASE'
  | 'NOT_AUTHORISED'
  | 'UNKNOWN_TEAM'
  | 'SAME_TEAM'
  | 'COMMIT_REQUIRED'
  | 'COMMIT_NOT_APPLICABLE'
  | 'COMMIT_MISMATCH'
  | 'EMPTY_OFFICIAL_NAME';

export interface TossViolation {
  code: TossViolationCode;
  message: string;
}
