/**
 * Match store — Zustand + persist → AsyncStorage. No backend, no network.
 *
 * Holds the APPEND-ONLY `BallEvent[]` and the openers. Everything shown on the
 * scoring screen is `derive(events, rules, opening)` — the fold is the truth,
 * the render is a cache of it.
 *
 * Undo appends a void pointer via the engine's `voidLast`. Nothing is ever
 * deleted or edited.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { nanoid } from 'nanoid/non-secure';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { derive, voidLast } from '../engine/derive';
import { DEFAULT_RULES, type BallEvent, type InningsState, type PlayerId, type Rules } from '../engine/types';
import { isValid } from '../engine/validate';

export interface Player {
  id: PlayerId;
  name: string;
}

export interface Opening {
  strikerId: PlayerId;
  nonStrikerId: PlayerId;
  bowlerId: PlayerId;
}

/**
 * Seeded squads. A judge landing on a "Create Team" button creates one team,
 * gets bored and leaves (§7) — so the match is playable the second it opens.
 */
const HOME_SQUAD: Player[] = [
  'A. Rane', 'V. Kohli-Patil', 'S. Gill', 'R. Pandya', 'K. Yadav', 'M. Shaikh',
  'T. Desai', 'N. Bhosale', 'P. Chavan', 'D. Kulkarni', 'G. Naik',
].map((name, i) => ({ id: `h${i + 1}`, name }));

const AWAY_SQUAD: Player[] = [
  'J. Fernandes', 'H. Joshi', 'B. Salvi', 'C. Mane', 'I. Sheikh', 'L. Gaikwad',
  'O. Pawar', 'U. More', 'Y. Jadhav', 'Z. Khan', 'E. Dsouza',
].map((name, i) => ({ id: `a${i + 1}`, name }));

interface MatchStore {
  rules: Rules;
  homeSquad: Player[];
  awaySquad: Player[];

  /** Which side is batting this innings. Set from the toss. */
  battingSide: 'home' | 'away' | null;
  opening: Opening | null;
  events: BallEvent[];

  startInnings: (battingSide: 'home' | 'away', opening: Opening, oversLimit: number) => void;
  /** Returns false and records nothing if the engine rejects the ball. */
  recordBall: (e: Omit<BallEvent, 'id'>) => boolean;
  undo: () => void;
  resetMatch: () => void;
}

export const useMatchStore = create<MatchStore>()(
  persist(
    (set, get) => ({
      rules: DEFAULT_RULES,
      homeSquad: HOME_SQUAD,
      awaySquad: AWAY_SQUAD,
      battingSide: null,
      opening: null,
      events: [],

      startInnings: (battingSide, opening, oversLimit) =>
        set((s) => ({
          battingSide,
          opening,
          events: [],
          rules: { ...s.rules, oversLimit },
        })),

      recordBall: (draft) => {
        const { events, rules, opening } = get();
        if (opening === null) return false;

        const e: BallEvent = { ...draft, id: nanoid() };
        const state = derive(events, rules, opening);
        if (!isValid(state, e, rules)) return false;

        set({ events: [...events, e] });
        return true;
      },

      undo: () => {
        const { events } = get();
        set({ events: voidLast(events, nanoid()) });
      },

      resetMatch: () => set({ battingSide: null, opening: null, events: [] }),
    }),
    {
      name: 'uc-match-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** The fold. Null until the innings has openers. */
export function useInnings(): InningsState | null {
  const events = useMatchStore((s) => s.events);
  const rules = useMatchStore((s) => s.rules);
  const opening = useMatchStore((s) => s.opening);
  if (opening === null) return null;
  return derive(events, rules, opening);
}

/** How many non-voided balls are on the log — is there anything to undo? */
export function useCanUndo(): boolean {
  return useMatchStore((s) => s.events.some((e) => !e.voidedBy));
}
