/**
 * The seeded demo (plan §7): a judge landing cold must arrive mid-innings with
 * a bracket already half-played, not on a "Create team" button.
 *
 * These assert the seed against the ENGINE's own fold. If a future engine
 * change moves a run or a ball, this fails here rather than in front of a judge.
 */

import { describe, expect, test } from 'vitest';

import { deriveBracket } from '../../bracket/derive';
import { TOURNAMENT_TEAMS } from '../../bracket/teams';
import { derive } from '../../engine/derive';
import { isValid } from '../../engine/validate';
import { battingFirst, deriveToss, isCaptainsConfirmFallback, umpires } from '../../toss/derive';
import { isValidToss } from '../../toss/validate';
import { DEMO } from '../demo';

const rules = { ...DEMO.rules };

describe('the seeded live innings', () => {
  const innings = DEMO.innings;
  const state = derive(innings.events, rules, innings.opening);

  test('lands the judge mid-innings at 61/3 after 7.2 overs', () => {
    expect(state.runs).toBe(61);
    expect(state.wickets).toBe(3);
    expect(state.legalBalls).toBe(44);
  });

  test('is still in progress, so the scoring screen opens live', () => {
    expect(state.status).toBe('IN_PROGRESS');
    expect(state.strikerId).not.toBeNull();
    expect(state.bowlerId).not.toBeNull();
  });

  test('includes a wide, so the extras line is not all zeroes', () => {
    expect(state.extras.wides).toBe(1);
  });

  test('records no ball the engine would reject', () => {
    // Every seeded event must be legal at the moment it was played. A seed
    // built by appending straight to the array could sneak past validate()
    // and prove nothing, so replay each prefix and re-validate the next ball.
    const rejected: string[] = [];
    for (let i = 0; i < innings.events.length; i++) {
      const before = derive(innings.events.slice(0, i), rules, innings.opening);
      const next = innings.events[i]!;
      if (!isValid(before, next, rules)) rejected.push(next.id);
    }

    expect(rejected).toEqual([]);
    expect(innings.events).toHaveLength(45);
  });

  test('brings three replacement batters to the crease', () => {
    expect(state.battingOrder).toEqual(['t3p1', 't3p2', 't3p3', 't3p4', 't3p5']);
  });
});

describe('the seeded toss', () => {
  const toss = deriveToss('home', 'away', 'PHYSICAL_COIN', DEMO.tossActions);

  test('is already confirmed, so the app opens on the scoring screen', () => {
    expect(toss.phase).toBe('COMPLETE');
    expect(toss.record).not.toBeNull();
  });

  test('puts the seeded batting side in first', () => {
    // The innings the seed ships is `battingSide: 'home'`, so the toss must
    // agree — otherwise the scorecard header contradicts the toss line.
    expect(battingFirst(toss)).toBe(DEMO.innings.battingSide);
  });

  test('was witnessed by an umpire, which is the feature worth demoing', () => {
    expect(umpires(toss).map((o) => o.name)).toEqual(['R. Sharma']);
    expect(isCaptainsConfirmFallback(toss)).toBe(false);
  });

  test('records every action legally, exactly as a real toss would', () => {
    const rejected: string[] = [];
    let state = deriveToss('home', 'away', 'PHYSICAL_COIN', []);
    for (const action of DEMO.tossActions) {
      if (!isValidToss(state, action)) rejected.push(action.type);
      state = deriveToss('home', 'away', 'PHYSICAL_COIN', [
        ...DEMO.tossActions.slice(0, DEMO.tossActions.indexOf(action) + 1),
      ]);
    }

    expect(rejected).toEqual([]);
  });
});

describe('the seeded bracket', () => {
  const bracket = deriveBracket(TOURNAMENT_TEAMS, DEMO.results);

  test('is half-played: three quarter-finals decided, one live', () => {
    const decided = bracket.ties.filter((t) => t.result !== null);
    expect(decided.map((t) => t.id)).toEqual(['QF1', 'QF2', 'QF3']);
  });

  test('leaves the live tie playable and unfinished', () => {
    const live = bracket.ties.find((t) => t.id === DEMO.activeTieId);
    expect(live?.playable).toBe(true);
  });

  test('has one semi-final already half-filled, so advancement is visible', () => {
    const sf1 = bracket.ties.find((t) => t.id === 'SF1');
    expect(sf1?.homeId).not.toBeNull();
    expect(sf1?.awayId).not.toBeNull();
    expect(sf1?.playable).toBe(true);
  });

  test('names no champion — there is a tournament left to play', () => {
    expect(bracket.champion).toBeNull();
  });
});
