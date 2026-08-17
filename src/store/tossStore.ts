/**
 * Toss store — Zustand + persist → AsyncStorage. No backend, no network.
 *
 * The store holds an APPEND-ONLY action log and nothing derived. State is
 * `deriveToss(...)` over that log, exactly as the innings is a fold over the
 * ball log. Invalid actions are never appended, so the log stays a clean audit
 * trail of the toss — which is what makes "provably fair" more than a slogan.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEMO } from '../seed/demo';
import { deriveToss } from '../toss/derive';
import { isValidToss } from '../toss/validate';
import type { TossAction, TossMethod, TossState } from '../toss/types';

/** The method the log starts from. SET_METHOD actions move it from here. */
const INITIAL_METHOD: TossMethod = 'PHYSICAL_COIN';

export interface Team {
  id: string;
  name: string;
}

interface TossStore {
  /** Home side. Tosses the coin (Law 13.4). */
  home: Team;
  /** Visiting side. Calls. */
  away: Team;

  actions: TossAction[];

  /**
   * The secret nonce for a digital toss, held from START_TOSS until REVEAL.
   * Persisted deliberately: a page reload mid-toss must not strand a toss that
   * has already published its commit hash.
   */
  pendingNonce: string | null;

  dispatch: (a: TossAction) => boolean;
  setPendingNonce: (n: string | null) => void;
  setTeamName: (side: 'home' | 'away', name: string) => void;
  /**
   * Clear the toss log so a fresh one can be run. Used when a bracket tie
   * starts. Never an edit of a confirmed toss — the old log is discarded
   * whole, which is not a path Law 13.5 forbids.
   */
  resetToss: () => void;
}

export const useTossStore = create<TossStore>()(
  persist(
    (set, get) => ({
      home: { id: 'home', name: DEMO.homeName },
      away: { id: 'away', name: DEMO.awayName },
      // The seeded toss is already confirmed, so the app opens on the scoring
      // screen rather than making a judge run a toss first (§7).
      actions: [...DEMO.tossActions],
      pendingNonce: null,

      dispatch: (a) => {
        const { home, away, actions } = get();
        const current = deriveToss(home.id, away.id, INITIAL_METHOD, actions);
        if (!isValidToss(current, a)) return false;
        set({ actions: [...actions, a] });
        return true;
      },

      setPendingNonce: (pendingNonce) => set({ pendingNonce }),

      setTeamName: (side, name) =>
        set((s) => ({ [side]: { ...s[side], name } }) as Pick<TossStore, 'home' | 'away'>),

      resetToss: () => set({ actions: [], pendingNonce: null }),
    }),
    {
      // v2: the seeded, already-confirmed toss replaced the empty action log.
      name: 'uc-toss-v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        home: s.home,
        away: s.away,
        actions: s.actions,
        pendingNonce: s.pendingNonce,
      }),
    },
  ),
);

/**
 * The fold, read imperatively. Needed inside event handlers that dispatch more
 * than once — the actor for START_TOSS depends on officials assigned moments
 * earlier in the same handler.
 */
export function getTossState(): TossState {
  const { home, away, actions } = useTossStore.getState();
  return deriveToss(home.id, away.id, INITIAL_METHOD, actions);
}

/** The fold. Cheap enough to recompute on every render. */
export function useTossState(): TossState {
  const home = useTossStore((s) => s.home);
  const away = useTossStore((s) => s.away);
  const actions = useTossStore((s) => s.actions);
  return deriveToss(home.id, away.id, INITIAL_METHOD, actions);
}
