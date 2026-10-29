/** Online play (D-032): the main-process TCP transport, host and guest on this machine. */
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { createOnline, lineReader } = require('../../app/main/online.cjs') as {
  createOnline: (emit: (kind: string, data: unknown) => void) => {
    host(port: number): Promise<{ ok: boolean; port?: number }>;
    join(address: string, port: number): Promise<{ ok: boolean; error?: string }>;
    send(line: string): boolean;
    stop(): void;
  };
  lineReader: (
    max: number,
    onLine: (l: string) => void,
    onTooLong: () => void,
  ) => (c: string) => void;
};

const until = async (cond: () => boolean) => {
  for (let i = 0; i < 200 && !cond(); i++) await new Promise((r) => setTimeout(r, 10));
  expect(cond()).toBe(true);
};

describe('online transport', () => {
  it('splits a stream into lines and refuses an over-long one', () => {
    const lines: string[] = [];
    let tooLong = false;
    const read = lineReader(
      10,
      (l) => lines.push(l),
      () => (tooLong = true),
    );
    read('ab\ncd');
    read('e\n\n');
    expect(lines).toEqual(['ab', 'cde']);
    read('x'.repeat(20));
    expect(tooLong).toBe(true);
  });

  it('a guest joins the host; lines go both ways; a second guest is turned away', async () => {
    const hostEvents: [string, unknown][] = [];
    const guestEvents: [string, unknown][] = [];
    const host = createOnline((k, d) => hostEvents.push([k, d]));
    const guest = createOnline((k, d) => guestEvents.push([k, d]));
    const port = 47000 + Math.floor(Math.random() * 900);
    try {
      expect((await host.host(port)).ok).toBe(true);
      expect((await guest.join('127.0.0.1', port)).ok).toBe(true);
      await until(() => hostEvents.some(([k]) => k === 'guest-connected'));
      expect(guest.send('{"t":"rematch"}')).toBe(true);
      await until(() => hostEvents.some(([k, d]) => k === 'message' && d === '{"t":"rematch"}'));
      expect(host.send('{"t":"error","message":"x"}')).toBe(true);
      await until(() => guestEvents.some(([k]) => k === 'message'));
      expect(guest.send('two\nlines')).toBe(false);

      const third: [string, unknown][] = [];
      const other = createOnline((k, d) => third.push([k, d]));
      await other.join('127.0.0.1', port);
      await until(() => third.some(([k, d]) => k === 'message' && String(d).includes('reject')));
      other.stop();

      guest.stop();
      await until(() => hostEvents.some(([k]) => k === 'guest-left'));
    } finally {
      guest.stop();
      host.stop();
    }
  });

  it('joining an address with nobody hosting fails cleanly', async () => {
    const guest = createOnline(() => {});
    const r = await guest.join('127.0.0.1', 47999);
    expect(r.ok).toBe(false);
    guest.stop();
  });
});
