/**
 * Commit-reveal for the DIGITAL toss.
 *
 * The app picks a secret nonce and publishes `commitFor(nonce)` BEFORE the
 * visiting captain calls. After the call it reveals the nonce; anyone can
 * recompute the hash and check it matches, so the result provably was not
 * chosen after seeing the call.
 *
 * The two digests are DOMAIN-SEPARATED on purpose. If the coin were derived
 * from the commit hash itself, the hash shown on screen would let the calling
 * captain compute the outcome before calling — which defeats the entire point.
 * With separate tags, the commit reveals nothing about the face.
 *
 * PURE: the nonce is an input. See ./entropy.ts for where one comes from.
 */

import { sha256Hex } from './sha256';
import type { CoinFace } from './types';

const COMMIT_TAG = 'UC-COMMIT:';
const COIN_TAG = 'UC-COIN:';

/** The hash published before the call. */
export function commitFor(nonce: string): string {
  return sha256Hex(COMMIT_TAG + nonce);
}

/** Does this nonce match the hash that was published earlier? */
export function verifyReveal(commitHash: string, nonce: string): boolean {
  return commitFor(nonce) === commitHash;
}

/** The coin face this nonce commits to. Independent of the published commit. */
export function coinFromNonce(nonce: string): CoinFace {
  const digest = sha256Hex(COIN_TAG + nonce);
  return parseInt(digest[digest.length - 1]!, 16) % 2 === 0 ? 'HEADS' : 'TAILS';
}

/** First 8 hex chars — what to put on screen. The full 64 is unreadable. */
export function shortHash(hash: string): string {
  return hash.slice(0, 8);
}
