/**
 * The bracket fold. PURE.
 *
 * `deriveBracket(teams, results)` is to the tournament what `derive(events)` is
 * to an innings: the recorded results are the truth, and the tree of who plays
 * whom is recomputed from them every time. Nothing is cached, so a winner can
 * never advance to one place while the bracket shows another.
 */

import { FINAL_TIE, TIES, type SlotSource } from './shape';
import type { BracketResults, BracketState, BracketTeam, TeamId, Tie, TieId } from './types';

export function deriveBracket(
  teams: readonly BracketTeam[],
  results: BracketResults,
): BracketState {
  const bySeed = new Map<number, TeamId>(teams.map((t) => [t.seed, t.id]));
  const winners = new Map<TieId, TeamId>();

  const resolve = (src: SlotSource): TeamId | null =>
    (src.kind === 'SEED' ? bySeed.get(src.seed) : winners.get(src.of)) ?? null;

  const ties: Tie[] = TIES.map((shape) => {
    const homeId = resolve(shape.home);
    const awayId = resolve(shape.away);

    // A recorded result only counts while its winner is actually playing the
    // tie. That single check is what makes replaying an earlier round drop the
    // now-meaningless rounds beneath it — no cascade, no cleanup pass.
    const recorded = results[shape.id];
    const result =
      recorded !== undefined && (recorded.winnerId === homeId || recorded.winnerId === awayId)
        ? recorded
        : null;

    if (result !== null) winners.set(shape.id, result.winnerId);

    return {
      id: shape.id,
      round: shape.round,
      homeId,
      awayId,
      result,
      playable: homeId !== null && awayId !== null && result === null,
    };
  });

  return { ties, champion: winners.get(FINAL_TIE) ?? null };
}

/** Lookup helpers for the UI. */
export function tieById(s: BracketState, id: TieId): Tie | null {
  return s.ties.find((t) => t.id === id) ?? null;
}

export function teamById(teams: readonly BracketTeam[], id: TeamId | null): BracketTeam | null {
  if (id === null) return null;
  return teams.find((t) => t.id === id) ?? null;
}

/** The next tie a scorer can actually play, in draw order. Null when finished. */
export function nextPlayableTie(s: BracketState): Tie | null {
  return s.ties.find((t) => t.playable) ?? null;
}
