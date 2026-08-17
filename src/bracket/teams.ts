/**
 * The eight-team roster. PURE static data.
 *
 * Seeds are fixed rather than drawn, because a hackathon demo wants the same
 * bracket every time it is reset — a judge and the person pitching to them
 * should be looking at the same draw.
 */

import type { BracketTeam, TeamId } from './types';

/** Structurally the store's `Player`; declared here so src/bracket imports nothing. */
export interface SquadPlayer {
  id: string;
  name: string;
}

export const TOURNAMENT_TEAMS: readonly BracketTeam[] = [
  { id: 't1', seed: 1, name: 'Mumbai Colts' },
  { id: 't2', seed: 2, name: 'Pune Strikers' },
  { id: 't3', seed: 3, name: 'Nagpur Royals' },
  { id: 't4', seed: 4, name: 'Nashik XI' },
  { id: 't5', seed: 5, name: 'Thane Titans' },
  { id: 't6', seed: 6, name: 'Kolhapur Kings' },
  { id: 't7', seed: 7, name: 'Solapur Sabres' },
  { id: 't8', seed: 8, name: 'Aurangabad Aces' },
];

const SQUAD_NAMES: Record<TeamId, readonly string[]> = {
  t1: ['A. Rane', 'V. Kohli-Patil', 'S. Gill', 'R. Pandya', 'K. Yadav', 'M. Shaikh',
       'T. Desai', 'N. Bhosale', 'P. Chavan', 'D. Kulkarni', 'G. Naik'],
  t2: ['J. Fernandes', 'H. Joshi', 'B. Salvi', 'C. Mane', 'I. Sheikh', 'L. Gaikwad',
       'O. Pawar', 'U. More', 'Y. Jadhav', 'Z. Khan', 'E. Dsouza'],
  t3: ['S. Deshmukh', 'A. Wankhede', 'R. Meshram', 'K. Thakre', 'P. Ingle', 'V. Dhote',
       'M. Raut', 'T. Bawankule', 'N. Kale', 'D. Gadge', 'H. Selokar'],
  t4: ['F. Sonawane', 'G. Wagh', 'R. Ahire', 'S. Nikam', 'A. Bagul', 'P. Shirsath',
       'V. Pagar', 'K. Borse', 'M. Jagtap', 'T. Aher', 'N. Khairnar'],
  t5: ['D. Bhoir', 'R. Mhatre', 'S. Kadam', 'A. Tare', 'V. Sawant', 'J. Vaity',
       'P. Koli', 'K. Bhandari', 'M. Shelar', 'T. Dalvi', 'G. Pednekar'],
  t6: ['S. Powar', 'A. Shinde', 'R. Kamble', 'N. Sutar', 'V. Magdum', 'P. Ghatge',
       'M. Chougule', 'K. Patne', 'D. Salunkhe', 'T. Kore', 'H. Mali'],
  t7: ['B. Shetty', 'R. Hiremath', 'A. Biradar', 'S. Kolhe', 'V. Waghmare', 'P. Dandekar',
       'M. Awate', 'K. Ubale', 'N. Phadtare', 'T. Bansode', 'G. Nimbalkar'],
  t8: ['I. Qureshi', 'R. Ambore', 'A. Kulthe', 'S. Dhage', 'V. Tribhuvan', 'P. Kshirsagar',
       'M. Rathod', 'K. Bhalerao', 'N. Sirsat', 'T. Autade', 'H. Gawali'],
};

/**
 * Player ids are namespaced by team (`t3p7`). They end up as keys in the
 * engine's batter and bowler cards, so a collision across teams would attribute
 * runs to the wrong player the moment a side plays its second tie.
 */
const SQUADS: Record<TeamId, readonly SquadPlayer[]> = Object.fromEntries(
  Object.entries(SQUAD_NAMES).map(([teamId, names]) => [
    teamId,
    names.map((name, i) => ({ id: `${teamId}p${i + 1}`, name })),
  ]),
);

export function squadFor(teamId: TeamId): SquadPlayer[] {
  return [...(SQUADS[teamId] ?? [])];
}

export function teamNameFor(teamId: TeamId): string {
  return TOURNAMENT_TEAMS.find((t) => t.id === teamId)?.name ?? 'TBC';
}
