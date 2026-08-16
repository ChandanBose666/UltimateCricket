import { describe, it, expect } from 'vitest';
import { initialTossState, reduceToss } from '../reduce';
import { validateToss, isValidToss } from '../validate';
import { deriveToss, tossSummary, umpires, isCaptainsConfirmFallback } from '../derive';
import { commitFor, coinFromNonce } from '../commit';
import {
  HOME,
  AWAY,
  UMPIRE_1,
  UMPIRE_2,
  SCORER,
  UMP,
  CAPTAINS,
  HOME_CAP,
  AWAY_CAP,
  play,
} from './helpers';
import type { TossAction, TossState } from '../types';

const S0 = (method: 'DIGITAL' | 'PHYSICAL_COIN' = 'PHYSICAL_COIN') =>
  initialTossState(HOME, AWAY, method);

const codes = (s: TossState, a: TossAction) => validateToss(s, a).map((v) => v.code);

/** A state with one umpire assigned and the toss started. */
const startedPhysical = () =>
  play(
    S0(),
    { type: 'ASSIGN_OFFICIAL', actor: UMP, official: UMPIRE_1 },
    { type: 'START_TOSS', actor: UMP },
  );

// ---------------------------------------------------------------------------
describe('setup: officials are optional and assignable', () => {
  it('starts in SETUP with no officials', () => {
    const s = S0();
    expect(s.phase).toBe('SETUP');
    expect(s.officials).toEqual([]);
    expect(s.record).toBeNull();
  });

  it('assigns an umpire', () => {
    const s = play(S0(), { type: 'ASSIGN_OFFICIAL', actor: CAPTAINS, official: UMPIRE_1 });
    expect(s.officials).toEqual([UMPIRE_1]);
    expect(umpires(s)).toEqual([UMPIRE_1]);
  });

  it('assigning the same role twice replaces rather than duplicates', () => {
    const s = play(
      S0(),
      { type: 'ASSIGN_OFFICIAL', actor: CAPTAINS, official: UMPIRE_1 },
      {
        type: 'ASSIGN_OFFICIAL',
        actor: CAPTAINS,
        official: { role: 'UMPIRE_1', name: 'S. Patel' },
      },
    );
    expect(s.officials).toHaveLength(1);
    expect(s.officials[0]!.name).toBe('S. Patel');
  });

  it('rejects an official with a blank name', () => {
    expect(
      codes(S0(), { type: 'ASSIGN_OFFICIAL', actor: CAPTAINS, official: { role: 'UMPIRE_1', name: '  ' } }),
    ).toContain('EMPTY_OFFICIAL_NAME');
  });

  it('removes an official', () => {
    const s = play(
      S0(),
      { type: 'ASSIGN_OFFICIAL', actor: CAPTAINS, official: UMPIRE_1 },
      { type: 'ASSIGN_OFFICIAL', actor: CAPTAINS, official: UMPIRE_2 },
      { type: 'REMOVE_OFFICIAL', actor: CAPTAINS, role: 'UMPIRE_2' },
    );
    expect(s.officials).toEqual([UMPIRE_1]);
  });

  it('a SCORER is not an umpire and does not satisfy Law 13.4', () => {
    const s = play(S0(), { type: 'ASSIGN_OFFICIAL', actor: CAPTAINS, official: SCORER });
    expect(umpires(s)).toEqual([]);
    expect(isCaptainsConfirmFallback(s)).toBe(true);
  });

  it('officials cannot be changed once the toss has started', () => {
    const s = startedPhysical();
    expect(codes(s, { type: 'ASSIGN_OFFICIAL', actor: UMP, official: UMPIRE_2 })).toContain(
      'WRONG_PHASE',
    );
    expect(codes(s, { type: 'SET_METHOD', actor: UMP, method: 'DIGITAL' })).toContain(
      'WRONG_PHASE',
    );
  });
});

// ---------------------------------------------------------------------------
describe('Law 13.4 — the umpire starts the toss, nobody else', () => {
  it('an assigned umpire may start it', () => {
    const s = startedPhysical();
    expect(s.phase).toBe('AWAITING_OUTCOME');
  });

  it('a captain may not start it when an umpire is assigned', () => {
    const s = play(S0(), { type: 'ASSIGN_OFFICIAL', actor: CAPTAINS, official: UMPIRE_1 });
    expect(codes(s, { type: 'START_TOSS', actor: HOME_CAP })).toContain('NOT_AUTHORISED');
    expect(codes(s, { type: 'START_TOSS', actor: CAPTAINS })).toContain('NOT_AUTHORISED');
  });

  it('an unassigned umpire role may not start it', () => {
    const s = play(S0(), { type: 'ASSIGN_OFFICIAL', actor: CAPTAINS, official: UMPIRE_1 });
    expect(codes(s, { type: 'START_TOSS', actor: { kind: 'UMPIRE', role: 'UMPIRE_2' } })).toContain(
      'NOT_AUTHORISED',
    );
  });

  it('with no umpire assigned, both captains may start it — the umpire is never required', () => {
    const s = play(S0(), { type: 'START_TOSS', actor: CAPTAINS });
    expect(s.phase).toBe('AWAITING_OUTCOME');
  });

  it('with no umpire assigned, a single captain still may not start it alone', () => {
    expect(codes(S0(), { type: 'START_TOSS', actor: HOME_CAP })).toContain('NOT_AUTHORISED');
  });

  it('rejects a toss where both sides are the same team', () => {
    const s = initialTossState(HOME, HOME, 'PHYSICAL_COIN');
    expect(codes(s, { type: 'START_TOSS', actor: CAPTAINS })).toContain('SAME_TEAM');
  });
});

// ---------------------------------------------------------------------------
describe('PHYSICAL_COIN — the two-tap path', () => {
  it('completes in four actions: start, who won, what they chose, confirm', () => {
    const s = play(
      S0(),
      { type: 'ASSIGN_OFFICIAL', actor: UMP, official: UMPIRE_1 },
      { type: 'START_TOSS', actor: UMP },
      { type: 'RECORD_OUTCOME', actor: UMP, wonBy: AWAY },
      { type: 'RECORD_DECISION', actor: AWAY_CAP, decision: 'FIELD' },
      { type: 'CONFIRM', actor: UMP, at: 1_700_000_000_000 },
    );

    expect(s.phase).toBe('COMPLETE');
    expect(s.record).not.toBeNull();
    expect(s.record!.wonBy).toBe(AWAY);
    expect(s.record!.decision).toBe('FIELD');
    expect(s.record!.method).toBe('PHYSICAL_COIN');
    expect(s.record!.witnessedBy).toEqual([UMPIRE_1]);
    expect(s.record!.confirmedAt).toBe(1_700_000_000_000);
  });

  it('does not require call or result — the watching crowd is the trust mechanism', () => {
    const s = play(
      startedPhysical(),
      { type: 'RECORD_OUTCOME', actor: UMP, wonBy: HOME },
      { type: 'RECORD_DECISION', actor: HOME_CAP, decision: 'BAT' },
      { type: 'CONFIRM', actor: UMP, at: 1 },
    );
    expect(s.record!.call).toBeUndefined();
    expect(s.record!.result).toBeUndefined();
    expect(s.record!.commitHash).toBeUndefined();
    expect(s.record!.nonce).toBeUndefined();
  });

  it('rejects a winner who is not one of the two teams', () => {
    expect(
      codes(startedPhysical(), { type: 'RECORD_OUTCOME', actor: UMP, wonBy: 'delhi-XI' }),
    ).toContain('UNKNOWN_TEAM');
  });

  it('rejects a commit hash — physical coins do not commit', () => {
    const s = play(S0(), { type: 'ASSIGN_OFFICIAL', actor: UMP, official: UMPIRE_1 });
    expect(codes(s, { type: 'START_TOSS', actor: UMP, commitHash: commitFor('n') })).toContain(
      'COMMIT_NOT_APPLICABLE',
    );
  });

  it('has no call step — RECORD_CALL is not part of this flow', () => {
    expect(codes(startedPhysical(), { type: 'RECORD_CALL', actor: AWAY_CAP, call: 'HEADS' })).toContain(
      'WRONG_PHASE',
    );
  });
});

// ---------------------------------------------------------------------------
describe('DIGITAL — commit-reveal', () => {
  const NONCE = 'nonce-for-the-demo';

  const started = () =>
    play(
      S0('DIGITAL'),
      { type: 'ASSIGN_OFFICIAL', actor: UMP, official: UMPIRE_1 },
      { type: 'START_TOSS', actor: UMP, commitHash: commitFor(NONCE) },
    );

  it('requires a commit hash before the call is entered', () => {
    const s = play(S0('DIGITAL'), { type: 'ASSIGN_OFFICIAL', actor: UMP, official: UMPIRE_1 });
    expect(codes(s, { type: 'START_TOSS', actor: UMP })).toContain('COMMIT_REQUIRED');
  });

  it('publishes the commit hash and waits for the call, with the nonce still secret', () => {
    const s = started();
    expect(s.phase).toBe('AWAITING_CALL');
    expect(s.commitHash).toBe(commitFor(NONCE));
    expect(s.nonce).toBeNull();
  });

  it('only the visiting captain calls', () => {
    const s = started();
    expect(codes(s, { type: 'RECORD_CALL', actor: HOME_CAP, call: 'HEADS' })).toContain(
      'NOT_AUTHORISED',
    );
    expect(codes(s, { type: 'RECORD_CALL', actor: UMP, call: 'HEADS' })).toContain(
      'NOT_AUTHORISED',
    );
    expect(isValidToss(s, { type: 'RECORD_CALL', actor: AWAY_CAP, call: 'HEADS' })).toBe(true);
  });

  it('cannot reveal before the call — that is the whole point', () => {
    expect(codes(started(), { type: 'REVEAL', actor: UMP, nonce: NONCE })).toContain('WRONG_PHASE');
  });

  it('rejects a nonce that does not match the published commit', () => {
    const s = play(started(), { type: 'RECORD_CALL', actor: AWAY_CAP, call: 'HEADS' });
    expect(codes(s, { type: 'REVEAL', actor: UMP, nonce: 'a-different-nonce' })).toContain(
      'COMMIT_MISMATCH',
    );
    expect(s.phase).toBe('AWAITING_REVEAL');
  });

  it('reveals the nonce and derives the result from it', () => {
    const s = play(
      started(),
      { type: 'RECORD_CALL', actor: AWAY_CAP, call: 'HEADS' },
      { type: 'REVEAL', actor: UMP, nonce: NONCE },
    );
    expect(s.nonce).toBe(NONCE);
    expect(s.result).toBe(coinFromNonce(NONCE));
    expect(s.phase).toBe('AWAITING_DECISION');
  });

  it('the caller wins when the call matches the coin', () => {
    const nonce = findNonce('HEADS');
    const s = play(
      S0('DIGITAL'),
      { type: 'START_TOSS', actor: CAPTAINS, commitHash: commitFor(nonce) },
      { type: 'RECORD_CALL', actor: AWAY_CAP, call: 'HEADS' },
      { type: 'REVEAL', actor: CAPTAINS, nonce },
    );
    expect(s.result).toBe('HEADS');
    expect(s.wonBy).toBe(AWAY);
  });

  it('the tossing side wins when the call does not match the coin', () => {
    const nonce = findNonce('TAILS');
    const s = play(
      S0('DIGITAL'),
      { type: 'START_TOSS', actor: CAPTAINS, commitHash: commitFor(nonce) },
      { type: 'RECORD_CALL', actor: AWAY_CAP, call: 'HEADS' },
      { type: 'REVEAL', actor: CAPTAINS, nonce },
    );
    expect(s.result).toBe('TAILS');
    expect(s.wonBy).toBe(HOME);
  });

  it('records the commit and the nonce so the result stays checkable afterwards', () => {
    const s = play(
      started(),
      { type: 'RECORD_CALL', actor: AWAY_CAP, call: 'TAILS' },
      { type: 'REVEAL', actor: UMP, nonce: NONCE },
      { type: 'RECORD_DECISION', actor: { kind: 'CAPTAIN', teamId: winner(NONCE, 'TAILS') }, decision: 'BAT' },
      { type: 'CONFIRM', actor: UMP, at: 42 },
    );
    expect(s.record!.commitHash).toBe(commitFor(NONCE));
    expect(s.record!.nonce).toBe(NONCE);
    expect(s.record!.call).toBe('TAILS');
    expect(s.record!.result).toBe(coinFromNonce(NONCE));
  });
});

// ---------------------------------------------------------------------------
describe('Law 13.5 — the decision belongs to the winning captain and is immutable', () => {
  const atDecision = () =>
    play(startedPhysical(), { type: 'RECORD_OUTCOME', actor: UMP, wonBy: AWAY });

  it('only the winning captain may choose', () => {
    const s = atDecision();
    expect(codes(s, { type: 'RECORD_DECISION', actor: HOME_CAP, decision: 'BAT' })).toContain(
      'NOT_AUTHORISED',
    );
    expect(codes(s, { type: 'RECORD_DECISION', actor: UMP, decision: 'BAT' })).toContain(
      'NOT_AUTHORISED',
    );
    expect(isValidToss(s, { type: 'RECORD_DECISION', actor: AWAY_CAP, decision: 'BAT' })).toBe(true);
  });

  it('the decision may still be corrected before the umpire confirms', () => {
    const s = play(
      atDecision(),
      { type: 'RECORD_DECISION', actor: AWAY_CAP, decision: 'BAT' },
      { type: 'RECORD_DECISION', actor: AWAY_CAP, decision: 'FIELD' },
    );
    expect(s.decision).toBe('FIELD');
    expect(s.phase).toBe('AWAITING_CONFIRMATION');
  });

  it('cannot confirm before a decision exists', () => {
    expect(codes(atDecision(), { type: 'CONFIRM', actor: UMP, at: 1 })).toContain('WRONG_PHASE');
  });

  it('the umpire confirms — the same authority that started it', () => {
    const s = play(atDecision(), { type: 'RECORD_DECISION', actor: AWAY_CAP, decision: 'BAT' });
    expect(codes(s, { type: 'CONFIRM', actor: AWAY_CAP, at: 1 })).toContain('NOT_AUTHORISED');
    expect(isValidToss(s, { type: 'CONFIRM', actor: UMP, at: 1 })).toBe(true);
  });

  it('once confirmed, EVERY further action is refused', () => {
    const s = play(
      atDecision(),
      { type: 'RECORD_DECISION', actor: AWAY_CAP, decision: 'BAT' },
      { type: 'CONFIRM', actor: UMP, at: 1 },
    );

    const attempts: TossAction[] = [
      { type: 'RECORD_DECISION', actor: AWAY_CAP, decision: 'FIELD' },
      { type: 'RECORD_OUTCOME', actor: UMP, wonBy: HOME },
      { type: 'RECORD_CALL', actor: AWAY_CAP, call: 'HEADS' },
      { type: 'START_TOSS', actor: UMP },
      { type: 'CONFIRM', actor: UMP, at: 2 },
      { type: 'ASSIGN_OFFICIAL', actor: UMP, official: UMPIRE_2 },
      { type: 'SET_METHOD', actor: UMP, method: 'DIGITAL' },
    ];

    for (const a of attempts) {
      expect(codes(s, a)).toContain('TOSS_COMPLETE');
      // and the reducer refuses it too, not just the validator
      expect(reduceToss(s, a)).toBe(s);
    }
    expect(s.record!.decision).toBe('BAT');
  });

  it('freezes the record so it cannot be edited in place', () => {
    const s = play(
      atDecision(),
      { type: 'RECORD_DECISION', actor: AWAY_CAP, decision: 'BAT' },
      { type: 'CONFIRM', actor: UMP, at: 1 },
    );
    expect(Object.isFrozen(s.record)).toBe(true);
    expect(Object.isFrozen(s.record!.witnessedBy)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('captains-confirm fallback', () => {
  it('runs the whole flow with no officials at all', () => {
    const s = play(
      S0(),
      { type: 'START_TOSS', actor: CAPTAINS },
      { type: 'RECORD_OUTCOME', actor: CAPTAINS, wonBy: HOME },
      { type: 'RECORD_DECISION', actor: HOME_CAP, decision: 'BAT' },
      { type: 'CONFIRM', actor: CAPTAINS, at: 7 },
    );
    expect(s.phase).toBe('COMPLETE');
    expect(s.record!.witnessedBy).toEqual([]);
  });

  it('an empty witnessedBy is what marks the fallback', () => {
    const s = play(
      S0(),
      { type: 'START_TOSS', actor: CAPTAINS },
      { type: 'RECORD_OUTCOME', actor: CAPTAINS, wonBy: HOME },
      { type: 'RECORD_DECISION', actor: HOME_CAP, decision: 'BAT' },
      { type: 'CONFIRM', actor: CAPTAINS, at: 7 },
    );
    expect(isCaptainsConfirmFallback(s)).toBe(true);
  });

  it('a scorer alone does not promote the toss out of the fallback', () => {
    const s = play(
      S0(),
      { type: 'ASSIGN_OFFICIAL', actor: CAPTAINS, official: SCORER },
      { type: 'START_TOSS', actor: CAPTAINS },
    );
    expect(s.phase).toBe('AWAITING_OUTCOME');
  });
});

// ---------------------------------------------------------------------------
describe('purity and the fold', () => {
  it('reduceToss never mutates its input', () => {
    const s = startedPhysical();
    const before = JSON.stringify(s);
    reduceToss(s, { type: 'RECORD_OUTCOME', actor: UMP, wonBy: AWAY });
    expect(JSON.stringify(s)).toBe(before);
  });

  it('an invalid action is a no-op returning the same state', () => {
    const s = startedPhysical();
    expect(reduceToss(s, { type: 'RECORD_OUTCOME', actor: HOME_CAP, wonBy: AWAY })).toBe(s);
  });

  it('deriveToss folds an action log to the same state as sequential reduce', () => {
    const actions: TossAction[] = [
      { type: 'ASSIGN_OFFICIAL', actor: UMP, official: UMPIRE_1 },
      { type: 'START_TOSS', actor: UMP },
      { type: 'RECORD_OUTCOME', actor: UMP, wonBy: AWAY },
      { type: 'RECORD_DECISION', actor: AWAY_CAP, decision: 'FIELD' },
      { type: 'CONFIRM', actor: UMP, at: 99 },
    ];
    expect(deriveToss(HOME, AWAY, 'PHYSICAL_COIN', actions)).toEqual(play(S0(), ...actions));
  });

  it('deriveToss ignores invalid actions in the log', () => {
    const s = deriveToss(HOME, AWAY, 'PHYSICAL_COIN', [
      { type: 'START_TOSS', actor: HOME_CAP }, // not authorised — ignored
      { type: 'START_TOSS', actor: CAPTAINS },
    ]);
    expect(s.phase).toBe('AWAITING_OUTCOME');
  });
});

// ---------------------------------------------------------------------------
describe('tossSummary', () => {
  const names = { [HOME]: 'Mumbai Colts', [AWAY]: 'Pune Strikers' };

  const complete = (decision: 'BAT' | 'FIELD', officials: boolean) =>
    play(
      S0(),
      ...(officials
        ? ([{ type: 'ASSIGN_OFFICIAL', actor: UMP, official: UMPIRE_1 }] as TossAction[])
        : []),
      { type: 'START_TOSS', actor: officials ? UMP : CAPTAINS },
      { type: 'RECORD_OUTCOME', actor: officials ? UMP : CAPTAINS, wonBy: HOME },
      { type: 'RECORD_DECISION', actor: HOME_CAP, decision },
      { type: 'CONFIRM', actor: officials ? UMP : CAPTAINS, at: 1 },
    );

  it('reads as a scorecard header', () => {
    expect(tossSummary(complete('BAT', true).record!, names)).toBe(
      'Mumbai Colts won the toss and elected to bat. Umpire: R. Sharma.',
    );
  });

  it('says "field" for a bowl-first decision', () => {
    expect(tossSummary(complete('FIELD', true).record!, names)).toContain('elected to field');
  });

  it('omits the umpire clause when the captains confirmed it themselves', () => {
    expect(tossSummary(complete('BAT', false).record!, names)).toBe(
      'Mumbai Colts won the toss and elected to bat.',
    );
  });

  it('falls back to the team id when a name is missing', () => {
    expect(tossSummary(complete('BAT', false).record!, {})).toContain(HOME);
  });
});

// Search deterministically for a nonce producing the wanted face, so the
// win/lose tests assert real behaviour rather than a hard-coded string.
function findNonce(face: 'HEADS' | 'TAILS'): string {
  for (let i = 0; i < 1000; i++) {
    const n = `probe-${i}`;
    if (coinFromNonce(n) === face) return n;
  }
  throw new Error(`no nonce found for ${face}`);
}

function winner(nonce: string, call: 'HEADS' | 'TAILS'): string {
  return coinFromNonce(nonce) === call ? AWAY : HOME;
}
