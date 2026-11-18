import { afterEach, describe, expect, it, vi } from 'vitest';
// the Cloudflare Worker that hands out relay passwords (relay/README.md)
import worker from '../../relay/worker.js';

const call = (path: string, env: Record<string, string>, method = 'GET') =>
  worker.fetch(new Request(`https://relay.example${path}`, { method }), env);

describe('relay credentials Worker', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('answers 503 until its secrets are set, 404 for anything but GET /ice', async () => {
    expect((await call('/ice', {})).status).toBe(503);
    expect((await call('/', { TURN_KEY_ID: 'k', TURN_KEY_API_TOKEN: 't' })).status).toBe(404);
    expect((await call('/ice', {}, 'OPTIONS')).status).toBe(204);
  });

  it('asks Cloudflare for 24-hour credentials and passes on only the ICE servers, port 53 dropped', async () => {
    const upstream = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            iceServers: [
              {
                urls: [
                  'turn:turn.cloudflare.com:3478?transport=udp',
                  'turn:turn.cloudflare.com:53',
                ],
                username: 'u',
                credential: 'c',
              },
            ],
            secret: 'not passed on',
          }),
          { status: 201 },
        ),
    );
    vi.stubGlobal('fetch', upstream);
    const res = await call('/ice', { TURN_KEY_ID: 'KEY', TURN_KEY_API_TOKEN: 'TOKEN' });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const [url, init] = upstream.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      'https://rtc.live.cloudflare.com/v1/turn/keys/KEY/credentials/generate-ice-servers',
    );
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer TOKEN');
    expect(JSON.parse(String(init.body))).toEqual({ ttl: 86400 });
    expect(await res.json()).toEqual({
      iceServers: [
        { urls: ['turn:turn.cloudflare.com:3478?transport=udp'], username: 'u', credential: 'c' },
      ],
    });
  });
});
