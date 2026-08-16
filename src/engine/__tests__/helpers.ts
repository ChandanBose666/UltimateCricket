import { type BallEvent, type Rules, DEFAULT_RULES } from '../types';

let n = 0;
export const nextId = () => `e${++n}`;

/** Terse ball builder for tests. Defaults to a legal dot ball. */
export function ball(p: Partial<BallEvent> = {}): BallEvent {
  return {
    id: nextId(),
    strikerId: 'A',
    nonStrikerId: 'B',
    bowlerId: 'X',
    runsOffBat: 0,
    extraType: null,
    extraRuns: 0,
    wicket: null,
    ...p,
  };
}

export const RULES: Rules = { ...DEFAULT_RULES, oversLimit: 20, playersPerSide: 11 };

export const OPENING = { strikerId: 'A', nonStrikerId: 'B', bowlerId: 'X' };
