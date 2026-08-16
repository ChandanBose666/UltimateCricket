import { describe, it, expect } from 'vitest';
import { sha256Hex, utf8Bytes } from '../sha256';
import { commitFor, coinFromNonce, verifyReveal } from '../commit';

// Published NIST / FIPS 180-4 vectors. If these pass, the implementation is
// the real thing and the commit-reveal claim on stage is honest.
describe('sha256Hex', () => {
  it('matches the empty-string vector', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('matches the "abc" vector', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('matches a 43-byte single-block vector', () => {
    expect(sha256Hex('The quick brown fox jumps over the lazy dog')).toBe(
      'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592',
    );
  });

  it('matches a 56-byte vector that spills into a second block', () => {
    expect(
      sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    ).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  });

  it('matches a 1,000,000-byte vector (padding across many blocks)', () => {
    expect(sha256Hex('a'.repeat(1000000))).toBe(
      'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
    );
  });

  it('distinguishes strings that differ only outside ASCII', () => {
    expect(sha256Hex('é')).not.toBe(sha256Hex('e'));
    expect(sha256Hex('क्रिकेट')).toMatch(/^[0-9a-f]{64}$/);
  });
});

// The encoder is tested directly rather than through a hash vector, so a bug
// in it can't hide behind a bug in the compressor.
describe('utf8Bytes', () => {
  it('encodes 1-byte ASCII', () => {
    expect(utf8Bytes('abc')).toEqual([0x61, 0x62, 0x63]);
  });

  it('encodes 2-byte code points', () => {
    expect(utf8Bytes('é')).toEqual([0xc3, 0xa9]);
  });

  it('encodes 3-byte code points', () => {
    expect(utf8Bytes('क')).toEqual([0xe0, 0xa4, 0x95]);
  });

  it('encodes a surrogate pair as one 4-byte code point', () => {
    expect(utf8Bytes('🏏')).toEqual([0xf0, 0x9f, 0x8f, 0x8f]);
  });

  it('does not crash on a lone surrogate', () => {
    expect(utf8Bytes('\ud83c').length).toBe(3);
  });

  it('always returns 64 lowercase hex characters', () => {
    for (const s of ['', 'a', 'abc', 'x'.repeat(55), 'y'.repeat(64)]) {
      expect(sha256Hex(s)).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe('commit-reveal', () => {
  it('commitFor is a domain-tagged SHA-256 of the nonce', () => {
    expect(commitFor('abc')).toBe(sha256Hex('UC-COMMIT:abc'));
  });

  it('the published commit is not the digest the coin comes from', () => {
    // If these shared a digest, showing the hash before the call would hand the
    // calling captain the answer. Domain separation is the whole safeguard.
    const nonce = 'nonce-1';
    expect(commitFor(nonce)).not.toBe(sha256Hex('UC-COIN:' + nonce));
    expect(commitFor(nonce)).not.toBe(sha256Hex(nonce));
  });

  it('verifyReveal accepts the true nonce and rejects any other', () => {
    const commit = commitFor('nonce-1');
    expect(verifyReveal(commit, 'nonce-1')).toBe(true);
    expect(verifyReveal(commit, 'nonce-2')).toBe(false);
    expect(verifyReveal(commit, '')).toBe(false);
  });

  it('coinFromNonce is deterministic', () => {
    expect(coinFromNonce('nonce-1')).toBe(coinFromNonce('nonce-1'));
  });

  it('coinFromNonce reaches both faces and is roughly balanced', () => {
    let heads = 0;
    for (let i = 0; i < 500; i++) if (coinFromNonce(`n${i}`) === 'HEADS') heads++;
    expect(heads).toBeGreaterThan(200);
    expect(heads).toBeLessThan(300);
  });
});
