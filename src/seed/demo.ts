/**
 * The seeded demo (plan §7). PURE.
 *
 * A judge landing cold must arrive mid-innings with a bracket already
 * half-played. An empty state with a "Create team" button loses them in
 * thirty seconds.
 *
 * The innings is authored as a table of overs and then EXPANDED THROUGH THE
 * ENGINE: before each ball the builder folds the events so far and reads who
 * is on strike from the result. Strike rotation is therefore never
 * re-implemented here — the seed is a consumer of the engine like any screen,
 * which is also why a future engine change breaks the seed's tests loudly.
 */

import { squadFor } from '../bracket/teams';
import type { BracketResults, TieId } from '../bracket/types';
import { derive } from '../engine/derive';
import { DEFAULT_RULES, type BallEvent, type Rules } from '../engine/types';
import type { TossAction } from '../toss/types';

/** Runs off the bat, `W` a wicket to the striker, `wd` a wide. */
type Token = number | 'W' | 'wd';

/**
 * Seven completed overs and two balls of the eighth: 61/3 at 7.2.
 * Deliberately mixed — boundaries, a wide, three wickets — so the scorecard
 * and the extras line both have something in them on first paint.
 */
const OVERS: readonly (readonly Token[])[] = [
  [1, 0, 0, 3, 1, 0],
  [0, 1, 2, 0, 4, 1],
  [0, 0, 'W', 1, 0, 4],
  [6, 0, 1, 'wd', 0, 2, 1],
  [0, 'W', 0, 1, 4, 0],
  [1, 2, 0, 4, 0, 1],
  [0, 4, 1, 'W', 0, 2],
  [6, 6],
];

/** Ten overs, not twenty: a judge should be able to finish this innings. */
const RULES: Rules = { ...DEFAULT_RULES, oversLimit: 10 };

/** QF4 — Nagpur Royals (home, batting) v Kolhapur Kings. */
const ACTIVE_TIE: TieId = 'QF4';
const BATTING = squadFor('t3');
const FIELDING = squadFor('t6');

const OPENING = {
  strikerId: 't3p1',
  nonStrikerId: 't3p2',
  bowlerId: 't6p1',
};

/** Two bowlers in rotation — nobody bowls consecutive overs. */
const BOWLERS = ['t6p1', 't6p2'];

function buildEvents(): BallEvent[] {
  const events: BallEvent[] = [];
  // Openers are squad[0] and squad[1]; the next batter in is squad[2].
  let nextBatter = 2;

  OVERS.forEach((tokens, over) => {
    const bowlerId = BOWLERS[over % BOWLERS.length] ?? OPENING.bowlerId;

    for (const token of tokens) {
      const state = derive(events, RULES, OPENING);
      const { strikerId, nonStrikerId } = state;
      if (strikerId === null || nonStrikerId === null) return;

      const base: BallEvent = {
        id: `seed-${events.length + 1}`,
        strikerId,
        nonStrikerId,
        bowlerId,
        runsOffBat: 0,
        extraType: null,
        extraRuns: 0,
        wicket: null,
      };

      if (token === 'wd') {
        events.push({ ...base, extraType: 'WIDE' });
      } else if (token === 'W') {
        const newBatter = BATTING[nextBatter];
        nextBatter += 1;
        events.push({
          ...base,
          wicket: { kind: 'BOWLED', outPlayerId: strikerId },
          ...(newBatter === undefined ? {} : { newBatterId: newBatter.id }),
        });
      } else {
        events.push({ ...base, runsOffBat: token });
      }
    }
  });

  return events;
}

/**
 * A completed toss, so the app opens on the scoring screen rather than making
 * a judge run the toss before they can score a ball. It is a real action log —
 * every entry passes `validateToss` — with an umpire assigned, because the
 * umpire-supervised toss is the part of this app that is not in CricHeroes.
 *
 * The timestamp is a fixed constant: this module is pure, so no `Date.now()`.
 */
const CONFIRMED_AT = 1_755_000_000_000;
const BY_UMPIRE = { kind: 'UMPIRE', role: 'UMPIRE_1' } as const;

const TOSS_ACTIONS: TossAction[] = [
  // Captains agree the umpire before there is an umpire to authorise it.
  {
    type: 'ASSIGN_OFFICIAL',
    actor: { kind: 'BOTH_CAPTAINS' },
    official: { role: 'UMPIRE_1', name: 'R. Sharma' },
  },
  { type: 'START_TOSS', actor: BY_UMPIRE },
  { type: 'RECORD_OUTCOME', actor: BY_UMPIRE, wonBy: 'home' },
  { type: 'RECORD_DECISION', actor: { kind: 'CAPTAIN', teamId: 'home' }, decision: 'BAT' },
  { type: 'CONFIRM', actor: BY_UMPIRE, at: CONFIRMED_AT },
];

/**
 * Three quarter-finals already played, so a judge can see a winner sitting in
 * a semi-final slot without playing a match first. SF1 is fully populated and
 * ready; SF2 waits on the tie they are about to score.
 */
const RESULTS: BracketResults = {
  QF1: { winnerId: 't1', summary: 'Mumbai Colts won by 6 wickets.' },
  QF2: { winnerId: 't5', summary: 'Thane Titans won by 12 runs.' },
  QF3: { winnerId: 't2', summary: 'Pune Strikers won by 8 wickets.' },
};

export const DEMO = {
  rules: RULES,
  oversLimit: RULES.oversLimit,
  activeTieId: ACTIVE_TIE,
  results: RESULTS,
  tossActions: TOSS_ACTIONS,
  homeSquad: BATTING,
  awaySquad: FIELDING,
  homeName: 'Nagpur Royals',
  awayName: 'Kolhapur Kings',
  innings: {
    battingSide: 'home' as const,
    opening: OPENING,
    events: buildEvents(),
  },
};
