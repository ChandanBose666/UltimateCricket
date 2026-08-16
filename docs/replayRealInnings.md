# Validating the engine against a real scorecard

The golden fixture in `src/engine/__tests__/golden.test.ts` is **synthetic** — hand-computed
and hand-verified. It proves the engine is internally consistent and that every awkward rule
fires correctly.

It does **not** prove you agree with the rest of the world. For that you need one real innings.
Do this once, early. It takes ~30 minutes and it is the difference between "my tests pass" and
"my engine is correct".

## Procedure

1. Pick a **completed T20 innings** with full ball-by-ball commentary — ESPNcricinfo or
   Cricbuzz. Prefer a low-scoring one (fewer balls to transcribe) that contains at least one
   wide, one no-ball, one leg bye, and one run out.
2. Transcribe it into an array of `BallEvent` in
   `src/engine/__tests__/real-innings.fixture.ts`. Roughly 130 entries. Tedious, mechanical,
   worth it. A 45-minute job while you drink the coffee.
3. Assert against the **published** figures, not against your engine's output:

```ts
import { describe, it, expect } from 'vitest';
import { derive, formatOvers, totalExtras } from '../derive';
import { REAL_INNINGS, REAL_OPENING, REAL_RULES } from './real-innings.fixture';

describe('real innings: <Team A> v <Team B>, <date>', () => {
  const s = derive(REAL_INNINGS, REAL_RULES, REAL_OPENING);

  it('matches the published total', () => {
    expect(s.runs).toBe(/* published */ 0);
    expect(s.wickets).toBe(0);
    expect(formatOvers(s.legalBalls)).toBe('20.0');
  });

  it('matches the published extras breakdown', () => {
    expect(s.extras).toEqual({ wides: 0, noBalls: 0, byes: 0, legByes: 0 });
    expect(totalExtras(s)).toBe(0);
  });

  it('matches every batter', () => {
    expect(s.batters['<id>']).toMatchObject({ runs: 0, balls: 0, fours: 0, sixes: 0 });
    // ...one line per batter
  });

  it('matches every bowler', () => {
    expect(s.bowlers['<id>']).toMatchObject({ balls: 0, runs: 0, wickets: 0, maidens: 0 });
  });
});
```

## If it disagrees

The disagreement is almost always one of these five. Check in this order:

1. **Wide count** — the over advanced when it shouldn't have. You'll be a few balls long.
2. **Leg byes charged to the bowler** — bowler's runs will be too high, team total right.
3. **A no-ball's runs not credited to the batter** — batter short, team total right.
4. **Strike wrong after a 3 or a 1 on the last ball** — a batter's *balls faced* drifts while
   runs stay right. This is the sneakiest one.
5. **New batter at the wrong end after a catch** — same symptom as (4).

If the **team total** is right but a **card** is wrong, it's attribution (2, 3, 4, 5).
If the **team total** is wrong, it's extras arithmetic (1, 2).

## Definition of done

Total, wickets, overs, all four extras columns, every batter's runs and balls, and every
bowler's overs/runs/wickets all match the published scorecard exactly. Then the engine is done
and you can build UI without fear.
