/**
 * The tournament roster is static data, and static data is where typos hide.
 * These assert the invariants the rest of the bracket assumes.
 */

import { describe, expect, test } from 'vitest';

import { deriveBracket } from '../derive';
import { TOURNAMENT_TEAMS, squadFor } from '../teams';

describe('tournament roster', () => {
  test('is eight teams seeded 1 to 8', () => {
    expect(TOURNAMENT_TEAMS).toHaveLength(8);
    expect([...TOURNAMENT_TEAMS].map((t) => t.seed).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
  });

  test('has unique team ids and names', () => {
    expect(new Set(TOURNAMENT_TEAMS.map((t) => t.id)).size).toBe(8);
    expect(new Set(TOURNAMENT_TEAMS.map((t) => t.name)).size).toBe(8);
  });

  test('gives every team eleven players with ids unique across the tournament', () => {
    const all: string[] = [];

    for (const team of TOURNAMENT_TEAMS) {
      const squad = squadFor(team.id);
      expect(squad, team.name).toHaveLength(11);
      expect(new Set(squad.map((p) => p.name)).size, team.name).toBe(11);
      all.push(...squad.map((p) => p.id));
    }

    // Ids collide across teams and the scorecard attributes runs to the wrong
    // player the moment a team plays a second tie.
    expect(new Set(all).size).toBe(88);
  });

  test('fills the whole draw from the roster', () => {
    const s = deriveBracket(TOURNAMENT_TEAMS, {});
    const quarterFinals = s.ties.filter((t) => t.round === 0);

    expect(quarterFinals.every((t) => t.homeId !== null && t.awayId !== null)).toBe(true);
    expect(quarterFinals.every((t) => t.playable)).toBe(true);
  });
});
