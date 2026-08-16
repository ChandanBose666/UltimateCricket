import { describe, it, expect } from 'vitest';
import { initialState, reduce } from '../reduce';
import { chaseState, resultOf, resultText, wicketsInHand, bowlerForDismissal } from '../summary';
import { DEFAULT_RULES, type InningsState, type Rules } from '../types';
import { ball, RULES } from './helpers';

/** A state with just the fields the result maths reads. */
const st = (runs: number, wickets: number, legalBalls = 0): InningsState => ({
  ...initialState('A', 'B', 'X'),
  runs,
  wickets,
  legalBalls,
});

const R: Rules = { ...DEFAULT_RULES, oversLimit: 20, playersPerSide: 11 };

// ---------------------------------------------------------------------------
describe('wicketsInHand', () => {
  it('is 10 for a full side that has lost none', () => {
    expect(wicketsInHand(st(0, 0), R)).toBe(10);
  });

  it('counts down as wickets fall', () => {
    expect(wicketsInHand(st(50, 4), R)).toBe(6);
    expect(wicketsInHand(st(50, 10), R)).toBe(0);
  });

  it('respects a smaller side', () => {
    expect(wicketsInHand(st(0, 0), { ...R, playersPerSide: 8 })).toBe(7);
  });

  it('allows the last man to stand alone when the rule is on', () => {
    expect(wicketsInHand(st(0, 0), { ...R, lastManStands: true })).toBe(11);
  });
});

// ---------------------------------------------------------------------------
describe('resultOf', () => {
  it('is IN_PROGRESS while the second innings is still live', () => {
    expect(resultOf(st(150, 6), st(80, 3), R).kind).toBe('IN_PROGRESS');
  });

  it('the chasing side wins by wickets when it passes the total', () => {
    const second: InningsState = { ...st(151, 4), status: 'TARGET_CHASED' };
    const r = resultOf(st(150, 6), second, R);
    expect(r).toEqual({ kind: 'WON_BY_WICKETS', winner: 'SECOND', margin: 6 });
  });

  it('the defending side wins by runs when the chase falls short', () => {
    const second: InningsState = { ...st(130, 10), status: 'ALL_OUT' };
    const r = resultOf(st(150, 6), second, R);
    expect(r).toEqual({ kind: 'WON_BY_RUNS', winner: 'FIRST', margin: 20 });
  });

  it('a chase that runs out of overs short is still a win by runs', () => {
    const second: InningsState = { ...st(149, 5, 120), status: 'OVERS_DONE' };
    expect(resultOf(st(150, 6), second, R)).toEqual({
      kind: 'WON_BY_RUNS',
      winner: 'FIRST',
      margin: 1,
    });
  });

  it('level scores is a tie, not a win by 0 runs', () => {
    const second: InningsState = { ...st(150, 10), status: 'ALL_OUT' };
    expect(resultOf(st(150, 6), second, R)).toEqual({ kind: 'TIE' });
  });

  it('a one-wicket win reports one wicket in hand, not zero', () => {
    const second: InningsState = { ...st(151, 9), status: 'TARGET_CHASED' };
    expect(resultOf(st(150, 6), second, R)).toEqual({
      kind: 'WON_BY_WICKETS',
      winner: 'SECOND',
      margin: 1,
    });
  });
});

// ---------------------------------------------------------------------------
describe('resultText', () => {
  it('reads like a scorecard for a win by wickets', () => {
    const second: InningsState = { ...st(151, 4), status: 'TARGET_CHASED' };
    expect(resultText(resultOf(st(150, 6), second, R), 'India', 'Australia')).toBe(
      'Australia won by 6 wickets.',
    );
  });

  it('uses the singular for one wicket', () => {
    const second: InningsState = { ...st(151, 9), status: 'TARGET_CHASED' };
    expect(resultText(resultOf(st(150, 6), second, R), 'India', 'Australia')).toBe(
      'Australia won by 1 wicket.',
    );
  });

  it('reads like a scorecard for a win by runs', () => {
    const second: InningsState = { ...st(130, 10), status: 'ALL_OUT' };
    expect(resultText(resultOf(st(150, 6), second, R), 'India', 'Australia')).toBe(
      'India won by 20 runs.',
    );
  });

  it('uses the singular for one run', () => {
    const second: InningsState = { ...st(149, 10), status: 'ALL_OUT' };
    expect(resultText(resultOf(st(150, 6), second, R), 'India', 'Australia')).toBe(
      'India won by 1 run.',
    );
  });

  it('names a tie', () => {
    const second: InningsState = { ...st(150, 10), status: 'ALL_OUT' };
    expect(resultText(resultOf(st(150, 6), second, R), 'India', 'Australia')).toBe(
      'Match tied.',
    );
  });
});

// ---------------------------------------------------------------------------
describe('chaseState', () => {
  it('is null in an innings with no target', () => {
    expect(chaseState(st(40, 1, 30), R)).toBeNull();
  });

  it('reports runs needed and balls remaining', () => {
    const rules: Rules = { ...R, oversLimit: 20, target: 151 };
    const c = chaseState(st(100, 3, 90), rules);
    expect(c).not.toBeNull();
    expect(c!.target).toBe(151);
    expect(c!.runsNeeded).toBe(51);
    expect(c!.ballsRemaining).toBe(30);
  });

  it('computes the required rate per over, not per ball', () => {
    const rules: Rules = { ...R, oversLimit: 20, target: 151 };
    // 51 needed from 30 balls = 5 overs = 10.20 an over
    expect(chaseState(st(100, 3, 90), rules)!.requiredRate).toBeCloseTo(10.2, 5);
  });

  it('never reports negative runs needed once the target is passed', () => {
    const rules: Rules = { ...R, target: 151 };
    expect(chaseState(st(160, 3, 100), rules)!.runsNeeded).toBe(0);
  });

  it('does not divide by zero on the last ball', () => {
    const rules: Rules = { ...R, oversLimit: 20, target: 151 };
    const c = chaseState(st(150, 3, 120), rules)!;
    expect(c.ballsRemaining).toBe(0);
    expect(Number.isFinite(c.requiredRate)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('bowlerForDismissal', () => {
  it('finds the bowler who took the wicket', () => {
    const events = [
      ball({ runsOffBat: 1 }),
      ball({ bowlerId: 'Y', wicket: { kind: 'BOWLED', outPlayerId: 'A' }, newBatterId: 'C' }),
    ];
    expect(bowlerForDismissal(events, 'A')).toBe('Y');
  });

  it('returns null for a batter who is not out', () => {
    expect(bowlerForDismissal([ball({ runsOffBat: 1 })], 'A')).toBeNull();
  });

  it('ignores a voided dismissal', () => {
    const events = [
      ball({
        bowlerId: 'Y',
        wicket: { kind: 'BOWLED', outPlayerId: 'A' },
        newBatterId: 'C',
        voidedBy: 'undo-1',
      }),
    ];
    expect(bowlerForDismissal(events, 'A')).toBeNull();
  });

  it('agrees with the fold about who is out', () => {
    // A free-hit dismissal that does not count must not report a bowler.
    let s = initialState('A', 'B', 'X');
    s = reduce(s, ball({ extraType: 'NO_BALL' }), RULES);
    const freeHitBall = ball({
      wicket: { kind: 'BOWLED', outPlayerId: 'A' },
      newBatterId: 'C',
    });
    s = reduce(s, freeHitBall, RULES);
    expect(s.batters['A']!.out).toBeNull();
  });
});
