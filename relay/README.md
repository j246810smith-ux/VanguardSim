# Relay for room-code games (Cloudflare TURN)

Why: room-code games connect the two players directly. Some networks block that (strict routers,
carrier-grade NAT on mobile data and hotspots). Then the game data has to go through a relay
(TURN) server. PeerJS's own free relays no longer exist (found 2026-11-18), which is why Online
Code only worked over a VPN. The owner chose Cloudflare Realtime TURN (2026-11-18).

How it fits together:

- `worker.js` is a tiny Cloudflare Worker. It keeps the long-term TURN key as a secret and answers
  `GET /ice` with relay passwords that expire after 24 hours.
- `app/main/relay.json` → `credentialsUrl` holds the Worker's address (`https://…/ice`). The game
  asks it when hosting or joining by room code (`app/renderer/online/relay.ts`). Empty means no
  relay, direct connections only, as before.
- Windows lets that one address through its network block while hosting or joining
  (`app/main/main.cjs`); the Android build adds it to its CSP (`vite.config.ts`).

Cost: Cloudflare's docs (checked 2026-11-18) give a free tier of 1,000 GB of relayed data, then
$0.05 per GB. Only games that cannot connect directly use the relay; a game sends very little.
STUN is free. Worker requests are within the free Workers plan.

## One-time setup (owner)

1. Make a free Cloudflare account at https://dash.cloudflare.com/sign-up.
2. In the dashboard open **Realtime** (formerly Calls; direct link
   https://dash.cloudflare.com/?to=/:account/calls) → **TURN** → create a TURN key. Copy the
   **Key ID** and the **API token** (shown once).
3. In a terminal in this folder (`relay\`), sign in and deploy (Claude can run these with you):

   ```
   npx wrangler login
   npx wrangler secret put TURN_KEY_ID
   npx wrangler secret put TURN_KEY_API_TOKEN
   npx wrangler deploy
   ```

   `deploy` prints the Worker's address, e.g. `https://vanguardsim-relay.<name>.workers.dev`.

4. Put `https://vanguardsim-relay.<name>.workers.dev/ice` into `app/main/relay.json` →
   `credentialsUrl`, then build and release as usual. Check it with
   `curl https://vanguardsim-relay.<name>.workers.dev/ice` (an `iceServers` list with
   `turn.cloudflare.com` entries).

Never commit the Key ID's API token. If it leaks, delete the TURN key in the dashboard and make a
new one (step 2, then the two `secret put` lines).
