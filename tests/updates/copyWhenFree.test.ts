/** The updater's copy over a file that may be briefly locked (v0.29.1). */
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const { copyWhenFree } = createRequire(import.meta.url)('../../app/main/updateInstall.cjs') as {
  copyWhenFree: (
    from: string,
    to: string,
    options: {
      copy: (from: string, to: string) => Promise<void>;
      delayMs: number;
      attempts?: number;
    },
  ) => Promise<void>;
};

const failing = (code: string) => Object.assign(new Error(code), { code });

/** A copy that fails with `codes` in turn, then works; counts its calls. */
function copyThat(...codes: string[]) {
  const state = { calls: 0 };
  const copy = async () => {
    const code = codes[state.calls++];
    if (code) throw failing(code);
  };
  return { state, copy };
}

describe('copyWhenFree', () => {
  it.each(['EBUSY', 'EPERM', 'EACCES'])(
    'tries again while the file is locked (%s)',
    async (code) => {
      const { state, copy } = copyThat(code, code);
      await copyWhenFree('a', 'b', { copy, delayMs: 0 });
      expect(state.calls).toBe(3);
    },
  );

  it('does not wait when nothing is wrong', async () => {
    const { state, copy } = copyThat();
    await copyWhenFree('a', 'b', { copy, delayMs: 0 });
    expect(state.calls).toBe(1);
  });

  it('does not retry an error that waiting cannot fix', async () => {
    const { state, copy } = copyThat('ENOSPC');
    await expect(copyWhenFree('a', 'b', { copy, delayMs: 0 })).rejects.toThrow('ENOSPC');
    expect(state.calls).toBe(1);
  });

  it('gives up in the end, and reports the failure', async () => {
    const { state, copy } = copyThat(...Array<string>(20).fill('EBUSY'));
    await expect(copyWhenFree('a', 'b', { copy, delayMs: 0, attempts: 4 })).rejects.toThrow(
      'EBUSY',
    );
    expect(state.calls).toBe(4);
  });
});
