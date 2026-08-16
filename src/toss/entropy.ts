/**
 * The ONLY impure file in src/toss.
 *
 * Everything else takes the nonce and the timestamp as inputs so it stays
 * testable. This is where the UI gets them from. Keep it out of the reducer.
 */

/** Wall clock, for the `at` field on CONFIRM. */
export function nowMs(): number {
  return Date.now();
}

/**
 * A secret nonce for the digital toss.
 *
 * Uses the platform CSPRNG where one exists (browsers, React Native Web, and
 * Hermes with the standard polyfill) and degrades to Math.random otherwise.
 * The fallback is not cryptographically strong — say so if a judge asks. It
 * still delivers the actual property being claimed: the result is fixed and
 * published as a hash before the call is entered, so it cannot be changed
 * afterwards.
 */
export function randomNonce(): string {
  const g = globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } };
  const bytes = new Uint8Array(16);

  if (typeof g.crypto?.getRandomValues === 'function') {
    g.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i]!.toString(16).padStart(2, '0');
  return hex;
}
