import type { BracketState, BracketTeam, TeamId, TieId, TieResult } from '../types';

/** Eight teams, seeded 1..8. Names are positional so pairings read at a glance. */
export const TEAMS: BracketTeam[] = Array.from({ length: 8 }, (_, i) => ({
  id: `t${i + 1}`,
  seed: i + 1,
  name: `Team ${i + 1}`,
}));

export const won = (winnerId: TeamId): TieResult => ({
  winnerId,
  summary: `${winnerId} won by 10 runs`,
});

/** Lookup that throws rather than returning undefined — a missing tie is a bug. */
export function tie(s: BracketState, id: TieId) {
  const found = s.ties.find((t) => t.id === id);
  if (found === undefined) throw new Error(`no such tie: ${id}`);
  return found;
}
