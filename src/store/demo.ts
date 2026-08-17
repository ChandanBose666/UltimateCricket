/**
 * "Reset demo" (plan §7) — judge #3 must not inherit judge #2's mess.
 *
 * This puts every store back to the SEEDED state, not to an empty one. An
 * empty app is exactly the dead end §7 warns about, so the reset that a bored
 * or stuck judge reaches for has to land them somewhere alive.
 *
 * It lives outside the three stores because it spans all of them, and because
 * each store's own `reset*` is a narrower primitive used by `startTie`.
 */

import { useBracketStore } from './bracketStore';
import { seededInnings, useMatchStore } from './matchStore';
import { useTossStore } from './tossStore';
import { DEMO } from '../seed/demo';

export function resetToDemo(): void {
  useMatchStore.setState({
    oversLimit: DEMO.oversLimit,
    homeSquad: [...DEMO.homeSquad],
    awaySquad: [...DEMO.awaySquad],
    innings: [seededInnings()],
  });

  useTossStore.setState({
    home: { id: 'home', name: DEMO.homeName },
    away: { id: 'away', name: DEMO.awayName },
    actions: [...DEMO.tossActions],
    pendingNonce: null,
  });

  useBracketStore.setState({
    results: { ...DEMO.results },
    activeTieId: DEMO.activeTieId,
    view: 'MATCH',
  });
}
