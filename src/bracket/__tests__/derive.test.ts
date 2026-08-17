/**
 * The bracket is a fold, exactly like the innings: the only recorded state is a
 * map of tie -> result, and every participant is derived by propagating winners
 * up the tree. "Auto-advance" is therefore not a feature, it is a consequence.
 */

import { describe, expect, test } from 'vitest';

import { deriveBracket } from '../derive';
import type { BracketResults } from '../types';
import { TEAMS, tie, won } from './helpers';

const empty: BracketResults = {};

describe('bracket shape', () => {
  test('lays out seven ties across three rounds', () => {
    const s = deriveBracket(TEAMS, empty);

    expect(s.ties.map((t) => t.id)).toEqual(['QF1', 'QF2', 'QF3', 'QF4', 'SF1', 'SF2', 'F']);
    expect(s.ties.filter((t) => t.round === 0)).toHaveLength(4);
    expect(s.ties.filter((t) => t.round === 1)).toHaveLength(2);
    expect(s.ties.filter((t) => t.round === 2)).toHaveLength(1);
  });

  test('pairs the quarter-finals 1v8, 4v5, 2v7, 3v6', () => {
    const s = deriveBracket(TEAMS, empty);
    const pair = (id: 'QF1' | 'QF2' | 'QF3' | 'QF4') => [tie(s, id).homeId, tie(s, id).awayId];

    expect(pair('QF1')).toEqual(['t1', 't8']);
    expect(pair('QF2')).toEqual(['t4', 't5']);
    expect(pair('QF3')).toEqual(['t2', 't7']);
    expect(pair('QF4')).toEqual(['t3', 't6']);
  });

  test('keeps the top two seeds apart until the final', () => {
    // Seed 1 can only reach the final through SF1, seed 2 only through SF2.
    const s = deriveBracket(TEAMS, {
      QF1: won('t1'),
      QF2: won('t4'),
      QF3: won('t2'),
      QF4: won('t3'),
      SF1: won('t1'),
      SF2: won('t2'),
    });

    expect([tie(s, 'F').homeId, tie(s, 'F').awayId]).toEqual(['t1', 't2']);
  });
});

describe('propagation', () => {
  test('leaves later rounds unfilled until their feeders are decided', () => {
    const s = deriveBracket(TEAMS, empty);

    expect(tie(s, 'SF1').homeId).toBeNull();
    expect(tie(s, 'SF1').awayId).toBeNull();
    expect(tie(s, 'F').homeId).toBeNull();
    expect(tie(s, 'F').awayId).toBeNull();
  });

  test('sends the QF1 winner to SF1 home and the QF2 winner to SF1 away', () => {
    const s = deriveBracket(TEAMS, { QF1: won('t8'), QF2: won('t4') });

    expect(tie(s, 'SF1').homeId).toBe('t8');
    expect(tie(s, 'SF1').awayId).toBe('t4');
  });

  test('makes both semi-finals playable once all four quarter-finals are recorded', () => {
    const s = deriveBracket(TEAMS, {
      QF1: won('t1'),
      QF2: won('t5'),
      QF3: won('t7'),
      QF4: won('t3'),
    });

    expect(tie(s, 'SF1').playable).toBe(true);
    expect(tie(s, 'SF2').playable).toBe(true);
    expect(tie(s, 'F').playable).toBe(false);
  });

  test('marks a tie that already has a result as not playable', () => {
    const s = deriveBracket(TEAMS, { QF1: won('t1') });

    expect(tie(s, 'QF1').playable).toBe(false);
    expect(tie(s, 'QF1').result?.winnerId).toBe('t1');
  });
});

describe('champion', () => {
  test('names no champion until the final is recorded', () => {
    const s = deriveBracket(TEAMS, {
      QF1: won('t1'),
      QF2: won('t4'),
      QF3: won('t2'),
      QF4: won('t3'),
      SF1: won('t1'),
      SF2: won('t2'),
    });

    expect(s.champion).toBeNull();
  });

  test('names the champion once the final is recorded', () => {
    const s = deriveBracket(TEAMS, {
      QF1: won('t1'),
      QF2: won('t4'),
      QF3: won('t2'),
      QF4: won('t3'),
      SF1: won('t1'),
      SF2: won('t2'),
      F: won('t2'),
    });

    expect(s.champion).toBe('t2');
  });
});

describe('stale results', () => {
  test('drops a downstream result when a quarter-final is replayed the other way', () => {
    const played: BracketResults = {
      QF1: won('t1'),
      QF2: won('t4'),
      SF1: won('t1'),
    };

    // The scorer replays QF1 and t8 wins this time. t1 is no longer in SF1,
    // so the recorded SF1 result refers to a team that is not playing it.
    const s = deriveBracket(TEAMS, { ...played, QF1: won('t8') });

    expect(tie(s, 'SF1').homeId).toBe('t8');
    expect(tie(s, 'SF1').result).toBeNull();
    expect(tie(s, 'SF1').playable).toBe(true);
  });

  test('drops a result recorded against a tie whose participants are unknown', () => {
    const s = deriveBracket(TEAMS, { SF1: won('t1') });

    expect(tie(s, 'SF1').result).toBeNull();
    expect(s.champion).toBeNull();
  });

  test('a replayed quarter-final does not disturb the other half of the draw', () => {
    const s = deriveBracket(TEAMS, {
      QF1: won('t1'),
      QF2: won('t4'),
      QF3: won('t2'),
      QF4: won('t3'),
      SF1: won('t1'),
      SF2: won('t2'),
      F: won('t1'),
    });
    const replayed = deriveBracket(TEAMS, {
      QF1: won('t8'),
      QF2: won('t4'),
      QF3: won('t2'),
      QF4: won('t3'),
      SF1: won('t1'),
      SF2: won('t2'),
      F: won('t1'),
    });

    expect(tie(s, 'F').result?.winnerId).toBe('t1');
    // SF2 is untouched; only the QF1 half collapses, and the final with it.
    expect(tie(replayed, 'SF2').result?.winnerId).toBe('t2');
    expect(tie(replayed, 'SF1').result).toBeNull();
    expect(tie(replayed, 'F').result).toBeNull();
    expect(replayed.champion).toBeNull();
  });
});
