import type { Actor, MatchOfficial, TossAction, TossState } from '../types';
import { reduceToss } from '../reduce';

export const HOME = 'mumbai-colts';
export const AWAY = 'pune-strikers';

export const UMPIRE_1: MatchOfficial = { role: 'UMPIRE_1', name: 'R. Sharma' };
export const UMPIRE_2: MatchOfficial = { role: 'UMPIRE_2', name: 'K. Iyer' };
export const SCORER: MatchOfficial = { role: 'SCORER', name: 'A. Bose' };

export const UMP: Actor = { kind: 'UMPIRE', role: 'UMPIRE_1' };
export const CAPTAINS: Actor = { kind: 'BOTH_CAPTAINS' };
export const HOME_CAP: Actor = { kind: 'CAPTAIN', teamId: HOME };
export const AWAY_CAP: Actor = { kind: 'CAPTAIN', teamId: AWAY };

/** Apply a sequence of actions, asserting nothing. */
export function play(s: TossState, ...actions: TossAction[]): TossState {
  return actions.reduce(reduceToss, s);
}
