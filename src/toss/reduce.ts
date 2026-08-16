/**
 * Toss reducer. Mirrors src/engine/reduce.ts.
 *
 * Invalid actions are NO-OPS returning the same state object, exactly as the
 * scoring engine does — `validateToss()` is what the UI consults to disable the
 * button in the first place, so a rejected action here means a bug upstream,
 * not something to surface to the user mid-toss.
 *
 * PURE: no clock, no randomness. `CONFIRM` carries its own timestamp and
 * `START_TOSS` carries a commit hash the caller computed from its own nonce.
 */

import { coinFromNonce } from './commit';
import { isValidToss } from './validate';
import type { MatchOfficial, TossAction, TossMethod, TossRecord, TossState, TeamId } from './types';

export function initialTossState(
  tossedBy: TeamId,
  calledBy: TeamId,
  method: TossMethod = 'PHYSICAL_COIN',
): TossState {
  return {
    phase: 'SETUP',
    method,
    tossedBy,
    calledBy,
    officials: [],
    call: null,
    result: null,
    wonBy: null,
    decision: null,
    commitHash: null,
    nonce: null,
    confirmedAt: null,
    record: null,
  };
}

export function reduceToss(s: TossState, a: TossAction): TossState {
  if (!isValidToss(s, a)) return s;

  switch (a.type) {
    case 'ASSIGN_OFFICIAL': {
      const officials = s.officials.filter((o) => o.role !== a.official.role);
      officials.push(a.official);
      return { ...s, officials };
    }

    case 'REMOVE_OFFICIAL':
      return { ...s, officials: s.officials.filter((o) => o.role !== a.role) };

    case 'SET_METHOD':
      return { ...s, method: a.method };

    case 'START_TOSS':
      return {
        ...s,
        phase: s.method === 'DIGITAL' ? 'AWAITING_CALL' : 'AWAITING_OUTCOME',
        commitHash: a.commitHash ?? null,
      };

    case 'RECORD_CALL':
      return { ...s, call: a.call, phase: 'AWAITING_REVEAL' };

    case 'REVEAL': {
      const result = coinFromNonce(a.nonce);
      return {
        ...s,
        nonce: a.nonce,
        result,
        // The caller wins if the coin matched the call; otherwise the tosser does.
        wonBy: result === s.call ? s.calledBy : s.tossedBy,
        phase: 'AWAITING_DECISION',
      };
    }

    case 'RECORD_OUTCOME':
      return { ...s, wonBy: a.wonBy, phase: 'AWAITING_DECISION' };

    case 'RECORD_DECISION':
      return { ...s, decision: a.decision, phase: 'AWAITING_CONFIRMATION' };

    case 'CONFIRM':
      return {
        ...s,
        phase: 'COMPLETE',
        confirmedAt: a.at,
        record: freezeRecord(buildRecord(s, a.at)),
      };
  }
}

function buildRecord(s: TossState, at: number): TossRecord {
  return {
    tossedBy: s.tossedBy,
    calledBy: s.calledBy,
    // Non-null by construction: CONFIRM is only valid from AWAITING_CONFIRMATION,
    // which is only reachable once wonBy and decision are both set.
    wonBy: s.wonBy!,
    decision: s.decision!,
    method: s.method,
    witnessedBy: s.officials.map((o) => ({ ...o })),
    confirmedAt: at,
    ...(s.call !== null ? { call: s.call } : {}),
    ...(s.result !== null ? { result: s.result } : {}),
    ...(s.commitHash !== null ? { commitHash: s.commitHash } : {}),
    ...(s.nonce !== null ? { nonce: s.nonce } : {}),
  };
}

/** Law 13.5, enforced at runtime as well as in the type. */
function freezeRecord(r: TossRecord): TossRecord {
  r.witnessedBy.forEach((o: MatchOfficial) => Object.freeze(o));
  Object.freeze(r.witnessedBy);
  return Object.freeze(r);
}
