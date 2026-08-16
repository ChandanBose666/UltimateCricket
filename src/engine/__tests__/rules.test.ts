import { describe, it, expect } from 'vitest';
import { reduce, initialState } from '../reduce';
import { validate } from '../validate';
import { derive, formatOvers, voidLast, totalExtras } from '../derive';
import { ball, RULES, OPENING } from './helpers';
import type { Rules } from '../types';

const S0 = () => initialState('A', 'B', 'X');

// ---------------------------------------------------------------------------
describe('runs off the bat', () => {
  it('credits the striker and the team', () => {
    const s = reduce(S0(), ball({ runsOffBat: 4 }), RULES);
    expect(s.runs).toBe(4);
    expect(s.batters['A']!.runs).toBe(4);
    expect(s.batters['A']!.balls).toBe(1);
    expect(s.batters['A']!.fours).toBe(1);
    expect(s.bowlers['X']!.runs).toBe(4);
    expect(s.legalBalls).toBe(1);
  });

  it('counts a six', () => {
    const s = reduce(S0(), ball({ runsOffBat: 6 }), RULES);
    expect(s.batters['A']!.sixes).toBe(1);
    expect(s.batters['A']!.fours).toBe(0);
  });

  it('a dot ball advances the over but scores nothing', () => {
    const s = reduce(S0(), ball(), RULES);
    expect(s.runs).toBe(0);
    expect(s.legalBalls).toBe(1);
    expect(s.batters['A']!.balls).toBe(1);
  });
});

// ---------------------------------------------------------------------------
describe('WIDE', () => {
  it('adds a penalty run, is not a legal ball, and the batter faces nothing', () => {
    const s = reduce(S0(), ball({ extraType: 'WIDE' }), RULES);
    expect(s.runs).toBe(1);
    expect(s.legalBalls).toBe(0);          // does NOT advance the over
    expect(s.batters['A']!.balls).toBe(0); // batter does not face a wide
    expect(s.batters['A']!.runs).toBe(0);  // nothing credited to the batter
    expect(s.extras.wides).toBe(1);
    expect(s.bowlers['X']!.runs).toBe(1);  // charged to the bowler
    expect(s.bowlers['X']!.balls).toBe(0);
  });

  it('a wide to the boundary is 5 wides', () => {
    const s = reduce(S0(), ball({ extraType: 'WIDE', extraRuns: 4 }), RULES);
    expect(s.runs).toBe(5);
    expect(s.extras.wides).toBe(5);
    expect(s.bowlers['X']!.runs).toBe(5);
  });

  it('rejects runs off the bat on a wide', () => {
    const v = validate(S0(), ball({ extraType: 'WIDE', runsOffBat: 2 }), RULES);
    expect(v.map((x) => x.code)).toContain('RUNS_OFF_BAT_ON_DEAD_EXTRA');
  });
});

// ---------------------------------------------------------------------------
describe('NO_BALL', () => {
  it('adds a penalty, is not legal, but runs off the bat DO credit the batter', () => {
    const s = reduce(S0(), ball({ extraType: 'NO_BALL', runsOffBat: 4 }), RULES);
    expect(s.runs).toBe(5);                // 1 nb + 4 bat
    expect(s.legalBalls).toBe(0);
    expect(s.batters['A']!.runs).toBe(4);  // credited, unlike a wide
    expect(s.batters['A']!.balls).toBe(1); // the batter DOES face a no-ball
    expect(s.batters['A']!.fours).toBe(1);
    expect(s.extras.noBalls).toBe(1);
    expect(s.bowlers['X']!.runs).toBe(5);
  });

  it('byes off a no-ball are not charged to the bowler', () => {
    const s = reduce(S0(), ball({ extraType: 'NO_BALL', extraRuns: 2 }), RULES);
    expect(s.runs).toBe(3);               // 1 nb + 2 byes
    expect(s.extras.noBalls).toBe(1);
    expect(s.extras.byes).toBe(2);
    expect(s.bowlers['X']!.runs).toBe(1); // only the penalty
  });

  it('sets a free hit for the next delivery', () => {
    const s = reduce(S0(), ball({ extraType: 'NO_BALL' }), RULES);
    expect(s.freeHitNext).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('FREE HIT', () => {
  const noBall = () => reduce(S0(), ball({ extraType: 'NO_BALL' }), RULES);

  it('protects the batter from being bowled — runs still count', () => {
    const s1 = noBall();
    const s2 = reduce(
      s1,
      ball({ runsOffBat: 2, wicket: { kind: 'BOWLED', outPlayerId: 'A' } }),
      RULES,
    );
    expect(s2.wickets).toBe(0);
    expect(s2.batters['A']!.out).toBeNull();
    expect(s2.runs).toBe(3); // 1 nb + 2
  });

  it('protects against caught, lbw, stumped and hit wicket', () => {
    for (const kind of ['CAUGHT', 'LBW', 'STUMPED', 'HIT_WICKET'] as const) {
      const s = reduce(noBall(), ball({ wicket: { kind, outPlayerId: 'A' } }), RULES);
      expect(s.wickets, `${kind} should not count on a free hit`).toBe(0);
    }
  });

  it('does NOT protect against a run out', () => {
    const s = reduce(
      noBall(),
      ball({ wicket: { kind: 'RUN_OUT', outPlayerId: 'A' }, newBatterId: 'C' }),
      RULES,
    );
    expect(s.wickets).toBe(1);
    expect(s.batters['A']!.out?.kind).toBe('RUN_OUT');
  });

  it('PERSISTS through a following wide', () => {
    const s1 = noBall();
    expect(s1.freeHitNext).toBe(true);
    const s2 = reduce(s1, ball({ extraType: 'WIDE' }), RULES);
    expect(s2.freeHitNext, 'a wide must not consume the free hit').toBe(true);
    const s3 = reduce(s2, ball({ wicket: { kind: 'BOWLED', outPlayerId: 'A' } }), RULES);
    expect(s3.wickets).toBe(0);
  });

  it('is consumed by the next legal delivery', () => {
    const s = reduce(noBall(), ball({ runsOffBat: 1 }), RULES);
    expect(s.freeHitNext).toBe(false);
  });

  it('validate() flags an illegal free-hit dismissal', () => {
    const v = validate(noBall(), ball({ wicket: { kind: 'LBW', outPlayerId: 'A' } }), RULES);
    expect(v.map((x) => x.code)).toContain('FREE_HIT_ILLEGAL_DISMISSAL');
  });
});

// ---------------------------------------------------------------------------
describe('BYE and LEG_BYE', () => {
  it('leg byes: legal ball, batter faces it, no runs to batter, not charged to bowler', () => {
    const s = reduce(S0(), ball({ extraType: 'LEG_BYE', extraRuns: 2 }), RULES);
    expect(s.runs).toBe(2);
    expect(s.legalBalls).toBe(1);          // legal delivery
    expect(s.batters['A']!.balls).toBe(1); // batter faced it
    expect(s.batters['A']!.runs).toBe(0);  // but scored nothing
    expect(s.extras.legByes).toBe(2);
    expect(s.bowlers['X']!.runs).toBe(0);  // NOT charged to the bowler
    expect(s.bowlers['X']!.balls).toBe(1);
  });

  it('byes behave the same but land in the byes column', () => {
    const s = reduce(S0(), ball({ extraType: 'BYE', extraRuns: 4 }), RULES);
    expect(s.extras.byes).toBe(4);
    expect(s.extras.legByes).toBe(0);
    expect(s.bowlers['X']!.runs).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe('strike rotation', () => {
  it('swaps on an odd number of runs', () => {
    const s = reduce(S0(), ball({ runsOffBat: 1 }), RULES);
    expect(s.strikerId).toBe('B');
    expect(s.nonStrikerId).toBe('A');
  });

  it('does not swap on an even number of runs', () => {
    const s = reduce(S0(), ball({ runsOffBat: 2 }), RULES);
    expect(s.strikerId).toBe('A');
  });

  it('does not swap on a boundary', () => {
    expect(reduce(S0(), ball({ runsOffBat: 4 }), RULES).strikerId).toBe('A');
    expect(reduce(S0(), ball({ runsOffBat: 6 }), RULES).strikerId).toBe('A');
  });

  it('swaps at the end of an over', () => {
    let s = S0();
    for (let i = 0; i < 6; i++) s = reduce(s, ball({ strikerId: 'A', nonStrikerId: 'B' }), RULES);
    expect(s.legalBalls).toBe(6);
    expect(s.strikerId).toBe('B'); // ends changed
  });

  it('odd runs off the LAST ball of an over = NO NET SWAP', () => {
    let s = S0();
    for (let i = 0; i < 5; i++) s = reduce(s, ball({ strikerId: 'A', nonStrikerId: 'B' }), RULES);
    expect(s.strikerId).toBe('A');
    // single off the 6th ball: rotate for the run, then rotate for the over
    s = reduce(s, ball({ strikerId: 'A', nonStrikerId: 'B', runsOffBat: 1 }), RULES);
    expect(s.legalBalls).toBe(6);
    expect(s.strikerId, 'both swaps fire, so the striker is unchanged').toBe('A');
    expect(s.nonStrikerId).toBe('B');
  });

  it('swaps on odd runs run off a wide', () => {
    const s = reduce(S0(), ball({ extraType: 'WIDE', extraRuns: 1 }), RULES);
    expect(s.strikerId).toBe('B');
  });

  it('swaps on odd leg byes', () => {
    const s = reduce(S0(), ball({ extraType: 'LEG_BYE', extraRuns: 1 }), RULES);
    expect(s.strikerId).toBe('B');
  });
});

// ---------------------------------------------------------------------------
describe('wickets', () => {
  it('bowled: new batter takes strike', () => {
    const s = reduce(
      S0(),
      ball({ wicket: { kind: 'BOWLED', outPlayerId: 'A' }, newBatterId: 'C' }),
      RULES,
    );
    expect(s.wickets).toBe(1);
    expect(s.strikerId).toBe('C');
    expect(s.nonStrikerId).toBe('B');
    expect(s.batters['A']!.out?.kind).toBe('BOWLED');
    expect(s.bowlers['X']!.wickets).toBe(1);
    expect(s.battingOrder).toEqual(['A', 'B', 'C']);
  });

  it('caught with the batters CROSSED: new batter is NOT on strike', () => {
    const s = reduce(
      S0(),
      ball({
        wicket: { kind: 'CAUGHT', outPlayerId: 'A', fielderId: 'F', crossed: true },
        newBatterId: 'C',
      }),
      RULES,
    );
    expect(s.wickets).toBe(1);
    expect(s.strikerId).toBe('B');
    expect(s.nonStrikerId).toBe('C');
  });

  it('a run out is not credited to the bowler', () => {
    const s = reduce(
      S0(),
      ball({ wicket: { kind: 'RUN_OUT', outPlayerId: 'A' }, newBatterId: 'C' }),
      RULES,
    );
    expect(s.wickets).toBe(1);
    expect(s.bowlers['X']!.wickets).toBe(0);
  });

  it('the NON-STRIKER can be run out', () => {
    const s = reduce(
      S0(),
      ball({ wicket: { kind: 'RUN_OUT', outPlayerId: 'B' }, newBatterId: 'C' }),
      RULES,
    );
    expect(s.batters['B']!.out?.kind).toBe('RUN_OUT');
    expect(s.strikerId).toBe('A');
    expect(s.nonStrikerId).toBe('C');
  });

  it('newBatterOnStrike overrides the default end', () => {
    const s = reduce(
      S0(),
      ball({
        wicket: { kind: 'RUN_OUT', outPlayerId: 'B' },
        newBatterId: 'C',
        newBatterOnStrike: true,
      }),
      RULES,
    );
    expect(s.strikerId).toBe('C');
    expect(s.nonStrikerId).toBe('A');
  });

  it('validate() requires a new batter when the innings continues', () => {
    const v = validate(S0(), ball({ wicket: { kind: 'BOWLED', outPlayerId: 'A' } }), RULES);
    expect(v.map((x) => x.code)).toContain('MISSING_NEW_BATTER');
  });

  it('validate() rejects dismissing a player who is not at the crease', () => {
    const v = validate(
      S0(),
      ball({ wicket: { kind: 'BOWLED', outPlayerId: 'Z' }, newBatterId: 'C' }),
      RULES,
    );
    expect(v.map((x) => x.code)).toContain('OUT_PLAYER_NOT_AT_CREASE');
  });
});

// ---------------------------------------------------------------------------
describe('overs are balls, never decimals', () => {
  it('formats correctly', () => {
    expect(formatOvers(0)).toBe('0.0');
    expect(formatOvers(5)).toBe('0.5');
    expect(formatOvers(6)).toBe('1.0');
    expect(formatOvers(117)).toBe('19.3');
    expect(formatOvers(120)).toBe('20.0');
  });

  it('19.3 overs is 117 balls, not 19.5', () => {
    expect(formatOvers(117)).toBe('19.3');
    expect(117 / 6).toBeCloseTo(19.5); // the trap: never use this for display
  });

  it('wides and no-balls do not advance the over', () => {
    let s = S0();
    s = reduce(s, ball({ extraType: 'WIDE' }), RULES);
    s = reduce(s, ball({ extraType: 'NO_BALL' }), RULES);
    s = reduce(s, ball(), RULES);
    expect(formatOvers(s.legalBalls)).toBe('0.1');
  });
});

// ---------------------------------------------------------------------------
describe('bowler restrictions', () => {
  it('blocks two consecutive overs', () => {
    let s = S0();
    for (let i = 0; i < 6; i++) s = reduce(s, ball(), RULES);
    expect(s.previousBowlerId).toBe('X');
    const v = validate(s, ball({ bowlerId: 'X', strikerId: 'B', nonStrikerId: 'A' }), RULES);
    expect(v.map((x) => x.code)).toContain('CONSECUTIVE_OVERS');
  });

  it('allows a different bowler', () => {
    let s = S0();
    for (let i = 0; i < 6; i++) s = reduce(s, ball(), RULES);
    const v = validate(s, ball({ bowlerId: 'Y', strikerId: 'B', nonStrikerId: 'A' }), RULES);
    expect(v.map((x) => x.code)).not.toContain('CONSECUTIVE_OVERS');
  });

  it('counts a maiden only when the bowler concedes nothing', () => {
    let s = S0();
    for (let i = 0; i < 6; i++) s = reduce(s, ball(), RULES);
    expect(s.bowlers['X']!.maidens).toBe(1);
  });

  it('leg byes still leave a maiden intact; a wide does not', () => {
    let s = S0();
    for (let i = 0; i < 5; i++) s = reduce(s, ball(), RULES);
    s = reduce(s, ball({ extraType: 'LEG_BYE', extraRuns: 1 }), RULES);
    expect(s.bowlers['X']!.maidens).toBe(1);

    let t = S0();
    t = reduce(t, ball({ extraType: 'WIDE' }), RULES);
    for (let i = 0; i < 6; i++) t = reduce(t, ball(), RULES);
    expect(t.bowlers['X']!.maidens).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe('innings end', () => {
  it('ALL_OUT at playersPerSide - 1 wickets', () => {
    const r: Rules = { ...RULES, playersPerSide: 3 }; // all out at 2
    let s = initialState('A', 'B', 'X');
    s = reduce(s, ball({ wicket: { kind: 'BOWLED', outPlayerId: 'A' }, newBatterId: 'C' }), r);
    expect(s.status).toBe('IN_PROGRESS');
    s = reduce(
      s,
      ball({ strikerId: 'C', wicket: { kind: 'BOWLED', outPlayerId: 'C' } }),
      r,
    );
    expect(s.status).toBe('ALL_OUT');
  });

  it('lastManStands pushes all-out to playersPerSide', () => {
    const r: Rules = { ...RULES, playersPerSide: 3, lastManStands: true };
    let s = initialState('A', 'B', 'X');
    s = reduce(s, ball({ wicket: { kind: 'BOWLED', outPlayerId: 'A' }, newBatterId: 'C' }), r);
    s = reduce(s, ball({ strikerId: 'C', wicket: { kind: 'BOWLED', outPlayerId: 'C' }, newBatterId: 'D' }), r);
    expect(s.status).toBe('IN_PROGRESS');
  });

  it('OVERS_DONE when the quota is bowled', () => {
    const r: Rules = { ...RULES, oversLimit: 1 };
    let s = initialState('A', 'B', 'X');
    for (let i = 0; i < 6; i++) s = reduce(s, ball(), r);
    expect(s.status).toBe('OVERS_DONE');
  });

  it('TARGET_CHASED when the target is reached', () => {
    const r: Rules = { ...RULES, target: 5 };
    let s = initialState('A', 'B', 'X');
    s = reduce(s, ball({ runsOffBat: 4 }), r);
    expect(s.status).toBe('IN_PROGRESS');
    s = reduce(s, ball({ runsOffBat: 1 }), r);
    expect(s.status).toBe('TARGET_CHASED');
  });

  it('validate() blocks scoring after the innings is over', () => {
    const r: Rules = { ...RULES, oversLimit: 1 };
    let s = initialState('A', 'B', 'X');
    for (let i = 0; i < 6; i++) s = reduce(s, ball(), r);
    expect(validate(s, ball(), r).map((x) => x.code)).toContain('INNINGS_OVER');
  });
});

// ---------------------------------------------------------------------------
describe('undo / event sourcing', () => {
  it('derive() skips voided events', () => {
    const e1 = ball({ runsOffBat: 4 });
    const e2 = ball({ runsOffBat: 6 });
    const all = [e1, e2];
    expect(derive(all, RULES, OPENING).runs).toBe(10);
    const undone = voidLast(all, 'undo-1');
    expect(derive(undone, RULES, OPENING).runs).toBe(4);
    expect(derive(undone, RULES, OPENING).legalBalls).toBe(1);
  });

  it('undo is repeatable and reaches zero', () => {
    let evts = [ball({ runsOffBat: 1 }), ball({ runsOffBat: 2 }), ball({ runsOffBat: 3 })];
    evts = voidLast(evts, 'u1');
    evts = voidLast(evts, 'u2');
    evts = voidLast(evts, 'u3');
    const s = derive(evts, RULES, OPENING);
    expect(s.runs).toBe(0);
    expect(s.legalBalls).toBe(0);
  });

  it('never mutates the input events or state', () => {
    const s0 = S0();
    const e = ball({ runsOffBat: 4 });
    const frozen = JSON.stringify({ s0, e });
    reduce(s0, e, RULES);
    expect(JSON.stringify({ s0, e })).toBe(frozen);
  });

  it('derive() is deterministic', () => {
    const evts = [ball({ runsOffBat: 1 }), ball({ extraType: 'WIDE' }), ball({ runsOffBat: 4 })];
    expect(derive(evts, RULES, OPENING)).toEqual(derive(evts, RULES, OPENING));
  });
});

// ---------------------------------------------------------------------------
describe('extras accounting', () => {
  it('team total always equals bat runs + extras', () => {
    const evts = [
      ball({ runsOffBat: 1 }),
      ball({ extraType: 'WIDE', extraRuns: 4 }),
      ball({ extraType: 'NO_BALL', runsOffBat: 2 }),
      ball({ extraType: 'BYE', extraRuns: 4 }),
      ball({ extraType: 'LEG_BYE', extraRuns: 1 }),
      ball({ runsOffBat: 6 }),
    ];
    const s = derive(evts, RULES, OPENING);
    const batRuns = Object.values(s.batters).reduce((a, b) => a + b.runs, 0);
    expect(batRuns + totalExtras(s)).toBe(s.runs);
  });
});
