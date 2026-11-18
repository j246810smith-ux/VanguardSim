/**
 * Relay (TURN) servers for room-code games (owner's choice 2026-11-18: Cloudflare TURN). When two
 * networks cannot connect directly, the game data goes through Cloudflare's relay instead.
 *
 * The long-term TURN key never ships with the game: a small Cloudflare Worker (relay/worker.js)
 * holds it and hands out relay passwords that expire after 24 hours. The game asks the Worker when
 * it hosts or joins; if the Worker is not set up (app/main/relay.json empty), unreachable or
 * answers nonsense, the game carries on with direct connections only.
 */
import relayConfig from '../../main/relay.json';
import { connectionLog } from './connectionDiag';

export const RELAY_URL: string = relayConfig.credentialsUrl;
const TIMEOUT_MS = 5000;

const isUrl = (u: unknown): u is string => typeof u === 'string' && /^(stun|turns?):/.test(u);

/**
 * Keeps only well-formed STUN/TURN entries from the Worker's answer and drops port-53 URLs
 * (browsers block them; without trickle ICE they only cause a wait: Cloudflare's docs).
 */
export function cleanIceServers(body: unknown): RTCIceServer[] {
  const list = (body as { iceServers?: unknown })?.iceServers;
  if (!Array.isArray(list)) return [];
  const out: RTCIceServer[] = [];
  for (const s of list) {
    const raw = (s as { urls?: unknown })?.urls;
    const urls = (Array.isArray(raw) ? raw : [raw])
      .filter(isUrl)
      .filter((u) => !/:53(\?|$)/.test(u));
    if (urls.length === 0) continue;
    const { username, credential } = s as { username?: unknown; credential?: unknown };
    const turn = urls.some((u) => u.startsWith('turn'));
    if (turn && (typeof username !== 'string' || typeof credential !== 'string')) continue;
    out.push(
      turn ? { urls, username: username as string, credential: credential as string } : { urls },
    );
  }
  return out;
}

/** Relay servers for this attempt ([] when there are none: direct connections only). */
export async function fetchRelayServers(
  url: string = RELAY_URL,
  fetchFn: typeof fetch = fetch,
): Promise<RTCIceServer[]> {
  if (!url) {
    connectionLog.add('relay', 'not set up');
    return [];
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchFn(url, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) {
      connectionLog.add('relay', `HTTP ${res.status}`);
      return [];
    }
    const servers = cleanIceServers(await res.json());
    const turns = servers.filter((s) => [s.urls].flat().some((u) => u.startsWith('turn'))).length;
    connectionLog.add('relay', turns ? `ready (${turns} relay entries)` : 'answer had no relay');
    connectionLog.relays = turns;
    return servers;
  } catch (err) {
    connectionLog.add('relay', (err as Error).name === 'AbortError' ? 'timeout' : 'unreachable');
    return [];
  } finally {
    clearTimeout(timer);
  }
}
