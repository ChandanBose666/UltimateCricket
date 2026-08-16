/**
 * Match store — Zustand + persist → AsyncStorage. No backend, no network.
 *
 * A match is up to two innings, each an APPEND-ONLY `BallEvent[]`. Everything
 * rendered is `derive(events, rules, opening)` — the fold is the truth.
 *
 * Undo appends a void pointer via the engine's `voidLast`. Nothing is ever
 * deleted or edited.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { nanoid } from 'nanoid/non-secure';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { derive, voidLast } from '../engine/derive';
import { resultOf, type MatchResult } from '../engine/summary';
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

export type Side = 'home' | 'away';

export interface InningsRecord {
  battingSide: Side;
  opening: Opening;
  events: BallEvent[];
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
  oversLimit: number;
  homeSquad: Player[];
  awaySquad: Player[];
  /** 0, 1 or 2 entries. Index 0 batted first. */
  innings: InningsRecord[];

  startInnings: (battingSide: Side, opening: Opening, oversLimit?: number) => void;
  /** Returns false and records nothing if the engine rejects the ball. */
  recordBall: (e: Omit<BallEvent, 'id'>) => boolean;
  undo: () => void;
  resetMatch: () => void;
}

export const useMatchStore = create<MatchStore>()(
  persist(
    (set, get) => ({
      oversLimit: 5,
      homeSquad: HOME_SQUAD,
      awaySquad: AWAY_SQUAD,
      innings: [],

      startInnings: (battingSide, opening, oversLimit) =>
        set((s) => ({
          oversLimit: oversLimit ?? s.oversLimit,
          innings: [...s.innings, { battingSide, opening, events: [] }],
        })),

      recordBall: (draft) => {
        const s = get();
        const idx = s.innings.length - 1;
        const rec = s.innings[idx];
        if (rec === undefined) return false;

        const rules = rulesFor(s.innings, s.oversLimit, idx);
        const e: BallEvent = { ...draft, id: nanoid() };
        if (!isValid(derive(rec.events, rules, rec.opening), e, rules)) return false;

        const innings = [...s.innings];
        innings[idx] = { ...rec, events: [...rec.events, e] };
        set({ innings });
        return true;
      },

      undo: () => {
        const s = get();
        const idx = s.innings.length - 1;
        const rec = s.innings[idx];
        if (rec === undefined) return;

        const innings = [...s.innings];
        innings[idx] = { ...rec, events: voidLast(rec.events, nanoid()) };
        set({ innings });
      },

      resetMatch: () => set({ innings: [] }),
    }),
    {
      // v2: the shape changed from one innings to a list. A new key rather
      // than a migration — this is demo data, not something to preserve.
      name: 'uc-match-v2',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

// --------------------------------------------------------------- derived ---

/**
 * Rules for innings `i`. The second innings carries the target, which is what
 * makes the engine report TARGET_CHASED on its own.
 */
export function rulesFor(innings: InningsRecord[], oversLimit: number, i: number): Rules {
  const base: Rules = { ...DEFAULT_RULES, oversLimit };
  if (i === 0) return base;

  const first = innings[0];
  if (first === undefined) return base;
  return { ...base, target: derive(first.events, base, first.opening).runs + 1 };
}

export type MatchPhase = 'NO_MATCH' | 'INNINGS_1' | 'BREAK' | 'INNINGS_2' | 'COMPLETE';

export interface InningsView {
  index: number;
  record: InningsRecord;
  state: InningsState;
  rules: Rules;
}

export interface MatchView {
  oversLimit: number;
  innings: InningsView[];
  /** The innings being scored, or null at a break / before the match. */
  current: InningsView | null;
  phase: MatchPhase;
  result: MatchResult;
}

/** The whole match as a fold. Cheap enough to recompute on every render. */
export function useMatch(): MatchView {
  const records = useMatchStore((s) => s.innings);
  const oversLimit = useMatchStore((s) => s.oversLimit);

  const innings: InningsView[] = records.map((record, index) => {
    const rules = rulesFor(records, oversLimit, index);
    return { index, record, state: derive(record.events, rules, record.opening), rules };
  });

  const last = innings[innings.length - 1];
  const live = last !== undefined && last.state.status === 'IN_PROGRESS';

  let phase: MatchPhase = 'NO_MATCH';
  if (innings.length === 1) phase = live ? 'INNINGS_1' : 'BREAK';
  else if (innings.length >= 2) phase = live ? 'INNINGS_2' : 'COMPLETE';

  const first = innings[0];
  const second = innings[1];
  const result: MatchResult =
    first !== undefined && second !== undefined
      ? resultOf(first.state, second.state, second.rules)
      : { kind: 'IN_PROGRESS' };

  return { oversLimit, innings, current: live ? (last ?? null) : null, phase, result };
}

/** Is there a ball to undo in the innings currently being scored? */
export function useCanUndo(): boolean {
  return useMatchStore((s) => {
    const rec = s.innings[s.innings.length - 1];
    return rec !== undefined && rec.events.some((e) => !e.voidedBy);
  });
}

export const otherSide = (side: Side): Side => (side === 'home' ? 'away' : 'home');
