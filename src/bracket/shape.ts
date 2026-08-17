/**
 * The draw. A static tree — which seeds meet in round one, and which tie feeds
 * which slot after that. PURE data.
 */

import type { Round, TieId } from './types';

export type SlotSource =
  | { kind: 'SEED'; seed: number }
  | { kind: 'WINNER'; of: TieId };

export interface TieShape {
  id: TieId;
  round: Round;
  home: SlotSource;
  away: SlotSource;
}

const seed = (n: number): SlotSource => ({ kind: 'SEED', seed: n });
const winner = (of: TieId): SlotSource => ({ kind: 'WINNER', of });

/**
 * Standard knockout seeding: 1v8, 4v5, 2v7, 3v6. It is arranged so the top two
 * seeds are in opposite halves and can only meet in the final.
 *
 * Order matters: a tie's feeders always appear before it, so one pass over this
 * list resolves the whole tree.
 */
export const TIES: readonly TieShape[] = [
  { id: 'QF1', round: 0, home: seed(1), away: seed(8) },
  { id: 'QF2', round: 0, home: seed(4), away: seed(5) },
  { id: 'QF3', round: 0, home: seed(2), away: seed(7) },
  { id: 'QF4', round: 0, home: seed(3), away: seed(6) },
  { id: 'SF1', round: 1, home: winner('QF1'), away: winner('QF2') },
  { id: 'SF2', round: 1, home: winner('QF3'), away: winner('QF4') },
  { id: 'F', round: 2, home: winner('SF1'), away: winner('SF2') },
];

export const FINAL_TIE: TieId = 'F';

export const ROUND_NAMES: Record<Round, string> = {
  0: 'Quarter-finals',
  1: 'Semi-finals',
  2: 'Final',
};
