/**
 * Bracket validation. Mirrors src/engine/validate.ts and src/toss/validate.ts:
 * it returns reasons, never throws, never mutates — and it drives the UI, so an
 * un-recordable tie is a DISABLED button, not an error toast.
 */

import { describe, expect, test } from 'vitest';

import { deriveBracket } from '../derive';
import { canRecord, validateResult } from '../validate';
import { TEAMS, won } from './helpers';

const opening = deriveBracket(TEAMS, {});

describe('recording a result', () => {
  test('accepts a participant of a playable tie', () => {
    expect(validateResult(opening, 'QF1', 't8')).toEqual([]);
    expect(canRecord(opening, 'QF1', 't8')).toBe(true);
  });

  test('rejects a winner who is not playing in that tie', () => {
    const [violation] = validateResult(opening, 'QF1', 't5');

    expect(violation?.code).toBe('WINNER_NOT_IN_TIE');
    expect(canRecord(opening, 'QF1', 't5')).toBe(false);
  });

  test('rejects a tie whose participants are not yet known', () => {
    const [violation] = validateResult(opening, 'SF1', 't1');

    expect(violation?.code).toBe('PARTICIPANTS_UNKNOWN');
    expect(canRecord(opening, 'SF1', 't1')).toBe(false);
  });

  test('rejects a tie that is not in the draw', () => {
    const [violation] = validateResult(opening, 'QF9' as 'QF1', 't1');

    expect(violation?.code).toBe('UNKNOWN_TIE');
  });

  test('allows replaying a tie that already has a result', () => {
    // Law-of-the-hackathon: judges mis-tap, so a decided tie can be played
    // again. deriveBracket drops whatever downstream results that invalidates.
    const played = deriveBracket(TEAMS, { QF1: won('t1') });

    expect(canRecord(played, 'QF1', 't8')).toBe(true);
  });
});
