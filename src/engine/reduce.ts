import {
  type BallEvent,
  type BatterCard,
  type BowlerFigures,
  type InningsState,
  type PlayerId,
  type Rules,
  FREE_HIT_LEGAL_DISMISSALS,
} from './types';

export function emptyBatter(playerId: PlayerId): BatterCard {
  return { playerId, runs: 0, balls: 0, fours: 0, sixes: 0, out: null };
}

export function emptyBowler(playerId: PlayerId): BowlerFigures {
  return { playerId, balls: 0, runs: 0, wickets: 0, maidens: 0 };
}

export function initialState(
  strikerId: PlayerId,
  nonStrikerId: PlayerId,
  bowlerId: PlayerId,
): InningsState {
  return {
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    strikerId,
    nonStrikerId,
    bowlerId,
    previousBowlerId: null,
    freeHitNext: false,
    batters: {
      [strikerId]: emptyBatter(strikerId),
      [nonStrikerId]: emptyBatter(nonStrikerId),
    },
    bowlers: { [bowlerId]: emptyBowler(bowlerId) },
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
    battingOrder: [strikerId, nonStrikerId],
    status: 'IN_PROGRESS',
    runsThisOver: 0,
  };
}

/** A wide or no-ball is not a legal delivery and does not advance the over. */
export function isLegalDelivery(e: BallEvent): boolean {
  return e.extraType !== 'WIDE' && e.extraType !== 'NO_BALL';
}

/** Does the striker face this ball for the purpose of "balls faced"? */
export function batterFacesBall(e: BallEvent): boolean {
  // Everything except a wide. The batter does face a no-ball.
  return e.extraType !== 'WIDE';
}

const isOdd = (n: number) => n % 2 === 1;

/**
 * The core reducer. Pure: (state, event, rules) -> new state.
 * Never mutates its arguments.
 */
export function reduce(state: InningsState, e: BallEvent, rules: Rules): InningsState {
  if (e.voidedBy) return state;

  const s: InningsState = {
    ...state,
    batters: { ...state.batters },
    bowlers: { ...state.bowlers },
    extras: { ...state.extras },
    battingOrder: [...state.battingOrder],
  };

  const legal = isLegalDelivery(e);
  const wasFreeHit = state.freeHitNext;

  // ---------------------------------------------------------------- runs ---
  let teamRuns = 0;
  let bowlerRuns = 0;
  let runsRun = 0; // runs physically run/scored that determine crossing

  switch (e.extraType) {
    case 'WIDE': {
      const total = rules.wideRuns + e.extraRuns;
      teamRuns += total;
      bowlerRuns += total;
      s.extras.wides += total;
      runsRun = e.extraRuns;
      break;
    }
    case 'NO_BALL': {
      teamRuns += rules.noBallRuns + e.runsOffBat + e.extraRuns;
      // Bowler wears the no-ball penalty and the runs off the bat, but not
      // byes taken off a no-ball.
      bowlerRuns += rules.noBallRuns + e.runsOffBat;
      s.extras.noBalls += rules.noBallRuns;
      s.extras.byes += e.extraRuns;
      runsRun = e.runsOffBat + e.extraRuns;
      break;
    }
    case 'BYE': {
      teamRuns += e.extraRuns;
      s.extras.byes += e.extraRuns; // not charged to the bowler
      runsRun = e.extraRuns;
      break;
    }
    case 'LEG_BYE': {
      teamRuns += e.extraRuns;
      s.extras.legByes += e.extraRuns; // not charged to the bowler
      runsRun = e.extraRuns;
      break;
    }
    default: {
      teamRuns += e.runsOffBat;
      bowlerRuns += e.runsOffBat;
      runsRun = e.runsOffBat;
    }
  }

  s.runs += teamRuns;

  // ------------------------------------------------------------- batter ---
  const striker = s.batters[e.strikerId] ?? emptyBatter(e.strikerId);
  const updatedStriker: BatterCard = { ...striker };

  // Runs off the bat only credit the batter on a legal ball or a no-ball.
  // Byes and leg-byes are team extras, never the batter's.
  if (e.extraType === null || e.extraType === 'NO_BALL') {
    updatedStriker.runs += e.runsOffBat;
    if (e.runsOffBat === 4) updatedStriker.fours += 1;
    if (e.runsOffBat === 6) updatedStriker.sixes += 1;
  }
  if (batterFacesBall(e)) updatedStriker.balls += 1;
  s.batters[e.strikerId] = updatedStriker;

  if (!s.batters[e.nonStrikerId]) {
    s.batters[e.nonStrikerId] = emptyBatter(e.nonStrikerId);
  }

  // ------------------------------------------------------------- bowler ---
  const bowler = s.bowlers[e.bowlerId] ?? emptyBowler(e.bowlerId);
  const updatedBowler: BowlerFigures = { ...bowler, runs: bowler.runs + bowlerRuns };
  if (legal) updatedBowler.balls += 1;
  s.bowlers[e.bowlerId] = updatedBowler;
  s.bowlerId = e.bowlerId;
  s.runsThisOver += bowlerRuns;

  // ------------------------------------------------------------- wicket ---
  // On a free hit only a run-out (etc.) counts; everything else is not out
  // and the runs still stand.
  const wicketCounts =
    e.wicket !== null &&
    (!wasFreeHit || FREE_HIT_LEGAL_DISMISSALS.includes(e.wicket.kind));

  let outPlayerId: PlayerId | null = null;
  if (e.wicket && wicketCounts) {
    outPlayerId = e.wicket.outPlayerId;
    s.wickets += 1;
    const card = s.batters[outPlayerId] ?? emptyBatter(outPlayerId);
    s.batters[outPlayerId] = { ...card, out: e.wicket };
    // Run-outs and retirements are not credited to the bowler.
    if (e.wicket.kind !== 'RUN_OUT') {
      const bw = s.bowlers[e.bowlerId]!;
      s.bowlers[e.bowlerId] = { ...bw, wickets: bw.wickets + 1 };
    }
  }

  // --------------------------------------------------------- ends/strike ---
  // Parity of runs run governs crossing. `crossed` is only consulted when no
  // runs were completed (e.g. a catch taken after the batters had crossed).
  const crossedOnDismissal = Boolean(e.wicket?.crossed) && wicketCounts;
  const swapForRuns = runsRun > 0 ? isOdd(runsRun) : crossedOnDismissal;

  let striker_ = e.strikerId;
  let nonStriker_ = e.nonStrikerId;
  if (swapForRuns) [striker_, nonStriker_] = [nonStriker_, striker_];

  // The new batter takes the end vacated by the dismissed player.
  if (outPlayerId !== null) {
    const incoming = e.newBatterId ?? null;
    if (incoming !== null) {
      if (!s.batters[incoming]) s.batters[incoming] = emptyBatter(incoming);
      if (!s.battingOrder.includes(incoming)) s.battingOrder.push(incoming);

      if (e.newBatterOnStrike !== undefined) {
        // Explicit scorer override.
        const other = outPlayerId === striker_ ? nonStriker_ : striker_;
        striker_ = e.newBatterOnStrike ? incoming : other;
        nonStriker_ = e.newBatterOnStrike ? other : incoming;
      } else if (outPlayerId === striker_) {
        striker_ = incoming;
      } else {
        nonStriker_ = incoming;
      }
    } else {
      if (outPlayerId === striker_) striker_ = null as unknown as PlayerId;
      else nonStriker_ = null as unknown as PlayerId;
    }
  }

  // -------------------------------------------------------------- over ---
  if (legal) {
    s.legalBalls += 1;
    if (s.legalBalls % 6 === 0) {
      // Over complete: ends change, and this bowler cannot bowl the next over.
      [striker_, nonStriker_] = [nonStriker_, striker_];
      if (s.runsThisOver === 0) {
        const bw = s.bowlers[e.bowlerId]!;
        s.bowlers[e.bowlerId] = { ...bw, maidens: bw.maidens + 1 };
      }
      s.previousBowlerId = e.bowlerId;
      s.runsThisOver = 0;
    }
  }

  s.strikerId = striker_;
  s.nonStrikerId = nonStriker_;

  // ---------------------------------------------------------- free hit ---
  if (e.extraType === 'NO_BALL') {
    s.freeHitNext = rules.freeHitAfterNoBall;
  } else if (!legal) {
    // A wide does not consume the free hit — it persists to the next delivery.
    s.freeHitNext = state.freeHitNext;
  } else {
    s.freeHitNext = false;
  }

  // ------------------------------------------------------------ status ---
  s.status = computeStatus(s, rules);
  return s;
}

export function computeStatus(s: InningsState, rules: Rules): InningsState['status'] {
  if (rules.target !== undefined && s.runs >= rules.target) return 'TARGET_CHASED';
  const allOutAt = rules.lastManStands ? rules.playersPerSide : rules.playersPerSide - 1;
  if (s.wickets >= allOutAt) return 'ALL_OUT';
  if (s.legalBalls >= rules.oversLimit * 6) return 'OVERS_DONE';
  return 'IN_PROGRESS';
}
