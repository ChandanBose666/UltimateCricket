/**
 * Bracket store — Zustand + persist → AsyncStorage. No backend, no network.
 *
 * Holds the recorded results and nothing derived, exactly as the toss store
 * holds an action log. `useBracket()` is the fold.
 *
 * One match slot exists at a time. Starting a tie rebinds that slot — squads,
 * team names and a cleared toss — and `activeTieId` remembers which tie the
 * live match belongs to, so the result can be posted back to the draw.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { deriveBracket, tieById } from '../bracket/derive';
import { TOURNAMENT_TEAMS, squadFor, teamNameFor } from '../bracket/teams';
import { canRecord } from '../bracket/validate';
import type { BracketResults, BracketState, TieId, TieResult } from '../bracket/types';
import { useMatchStore } from './matchStore';
import { useTossStore } from './tossStore';

/** Which half of the app is showing. Persisted so a reload lands where you were. */
export type AppView = 'MATCH' | 'BRACKET';

interface BracketStore {
  results: BracketResults;
  /** The tie the live match belongs to. Null for a friendly. */
  activeTieId: TieId | null;
  view: AppView;

  setView: (view: AppView) => void;
  /** Binds the match slot to a tie and clears the toss. False if not yet playable. */
  startTie: (tieId: TieId) => boolean;
  /** Posts a finished match back to the draw. False if the engine's winner isn't in the tie. */
  recordResult: (tieId: TieId, result: TieResult) => boolean;
  /** Leave the tie without recording — the match slot stays as it is. */
  clearActiveTie: () => void;
  resetBracket: () => void;
}

export const useBracketStore = create<BracketStore>()(
  persist(
    (set, get) => ({
      results: {},
      activeTieId: null,
      view: 'MATCH',

      setView: (view) => set({ view }),

      startTie: (tieId) => {
        const tie = tieById(deriveBracket(TOURNAMENT_TEAMS, get().results), tieId);
        // Participants, not `playable`: a decided tie may be replayed.
        if (tie === null || tie.homeId === null || tie.awayId === null) return false;

        const match = useMatchStore.getState();
        match.setSquads(squadFor(tie.homeId), squadFor(tie.awayId));
        match.resetMatch();

        const toss = useTossStore.getState();
        toss.setTeamName('home', teamNameFor(tie.homeId));
        toss.setTeamName('away', teamNameFor(tie.awayId));
        toss.resetToss();

        set({ activeTieId: tieId, view: 'MATCH' });
        return true;
      },

      recordResult: (tieId, result) => {
        const { results } = get();
        if (!canRecord(deriveBracket(TOURNAMENT_TEAMS, results), tieId, result.winnerId)) {
          return false;
        }

        set({ results: { ...results, [tieId]: result }, activeTieId: null, view: 'BRACKET' });
        return true;
      },

      clearActiveTie: () => set({ activeTieId: null }),

      // Demo reset (plan §7). The match and toss stores are reset alongside it
      // by App's reset button; this only clears the draw.
      resetBracket: () => set({ results: {}, activeTieId: null, view: 'MATCH' }),
    }),
    {
      name: 'uc-bracket-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** The fold. Cheap enough to recompute on every render. */
export function useBracket(): BracketState {
  const results = useBracketStore((s) => s.results);
  return deriveBracket(TOURNAMENT_TEAMS, results);
}

/** The tie the live match belongs to, or null for a friendly. */
export function useActiveTie() {
  const activeTieId = useBracketStore((s) => s.activeTieId);
  const bracket = useBracket();
  return activeTieId === null ? null : tieById(bracket, activeTieId);
}
