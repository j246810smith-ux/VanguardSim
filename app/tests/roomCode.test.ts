/** Play Online by room code (D-032): codes, and the id the host registers under. */
import { describe, expect, it } from 'vitest';
import { codeProblem, makeCode, normalizeCode, peerIdFor } from '../renderer/online/roomCode';

describe('room codes', () => {
  it('ignore case, spaces and punctuation', async () => {
    expect(normalizeCode(' storm-4821 raven ')).toBe('STORM4821RAVEN');
    expect(await peerIdFor('storm-4821-raven')).toBe(await peerIdFor('STORM 4821 RAVEN'));
    expect(await peerIdFor('STORM-4821-RAVEN')).not.toBe(await peerIdFor('STORM-4821-RAVEM'));
  });

  it('never send the code itself to the service, only a hash', async () => {
    const id = await peerIdFor('STORM-4821-RAVEN');
    expect(id).toMatch(/^vgsim-[0-9a-f]{40}$/);
    expect(id).not.toContain('STORM');
  });

  it('must be long enough to be hard to guess', () => {
    expect(codeProblem('abc12')).toMatch(/at least 6/);
    expect(codeProblem('abc-123')).toBeNull();
    expect(codeProblem('x'.repeat(33))).toMatch(/at most 32/);
  });

  it('new codes look like WORD-1234-WORD and are valid', () => {
    let n = 7;
    const code = makeCode(() => (n = (n * 1103515245 + 12345) >>> 0));
    expect(code).toMatch(/^[A-Z]+-\d{4}-[A-Z]+$/);
    expect(codeProblem(code)).toBeNull();
    expect(makeCode()).not.toBe(makeCode());
  });
});
