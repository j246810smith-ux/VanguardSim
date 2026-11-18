/* global fetch, Response, URL -- Cloudflare Workers runtime */
/**
 * VanguardSim relay credentials (Cloudflare Worker). Room-code games ask this Worker for TURN
 * servers; it asks Cloudflare Realtime TURN for credentials that expire after 24 hours and passes
 * them on. The long-term TURN key stays here, as Worker secrets, and never ships with the game.
 *
 * Secrets (set with `npx wrangler secret put <NAME>`): TURN_KEY_ID, TURN_KEY_API_TOKEN.
 * API: https://developers.cloudflare.com/realtime/turn/generate-credentials/ (checked 2026-11-18).
 */
const TTL_SECONDS = 86400; // 24 h: longer than any game; Cloudflare allows up to 48 h

const HEADERS = {
  'content-type': 'application/json',
  'cache-control': 'no-store',
  // the Windows game asks from a file:// page (origin "null"), the phone from its app origin
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
};

const reply = (status, body) =>
  new Response(body === null ? null : JSON.stringify(body), { status, headers: HEADERS });

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return reply(204, null);
    const { pathname } = new URL(request.url);
    if (request.method !== 'GET' || pathname !== '/ice') return reply(404, { error: 'not found' });
    if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN)
      return reply(503, { error: 'relay not configured' });

    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ ttl: TTL_SECONDS }),
      },
    );
    if (!res.ok) return reply(502, { error: `turn service answered ${res.status}` });
    const data = await res.json();
    // only the ICE servers go back (port 53 dropped: browsers block it, Cloudflare's docs)
    const iceServers = (data.iceServers ?? []).map((s) => ({
      ...s,
      urls: [s.urls].flat().filter((u) => !/:53(\?|$)/.test(u)),
    }));
    return reply(200, { iceServers });
  },
};
