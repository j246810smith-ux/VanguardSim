/**
 * Play Online by room code: which servers help the two games find each other, and a connection
 * report for when it fails (owner's report 2026-11-18: "Online Code only works when using a VPN").
 *
 * Finding (2026-11-18): PeerJS 1.5.5's built-in relay servers (eu-0/us-0.turn.peerjs.com) no longer
 * have DNS records, so when the two networks cannot connect directly (strict or carrier-grade NAT,
 * typical of mobile data, hotspots and some ISPs) there is no relay to fall back to and the join
 * times out. A VPN changes the network's NAT, which is why it "fixed" it. Signalling
 * (0.peerjs.com) and STUN answer normally. See docs/PLAYING_ONLINE.md "Room code does not connect".
 *
 * The report records stages, error types, candidate TYPES (host / srflx / relay) and connection
 * states with timings. It never records the room code, peer ids, IP addresses or messages.
 */

/** STUN servers (they only tell each game its public address; no game data goes through them). */
export const STUN_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

/** The ICE configuration for room-code connections: STUN, plus a relay if one is configured. */
export function iceConfig(relay: RTCIceServer[] = []): RTCConfiguration {
  return { iceServers: [...STUN_SERVERS, ...relay] };
}

export interface DiagEntry {
  /** ms since the attempt started */
  readonly t: number;
  readonly stage: string;
  readonly detail?: string;
}

const MAX_ENTRIES = 200;

/** One connection attempt's log (host or join). */
export class ConnectionLog {
  private start = 0;
  private entries: DiagEntry[] = [];
  private candidates = { host: 0, srflx: 0, prflx: 0, relay: 0 };
  role: 'host' | 'join' | null = null;
  /** relay (TURN) entries this attempt got from the relay Worker (relay.ts) */
  relays = 0;

  constructor(private readonly now: () => number = () => performance.now()) {}

  begin(role: 'host' | 'join'): void {
    this.start = this.now();
    this.entries = [];
    this.candidates = { host: 0, srflx: 0, prflx: 0, relay: 0 };
    this.role = role;
    this.relays = 0;
    this.add('start', role);
  }

  add(stage: string, detail?: string): void {
    if (this.entries.length >= MAX_ENTRIES) this.entries.shift();
    const t = Math.round(this.now() - this.start);
    this.entries.push(detail === undefined ? { t, stage } : { t, stage, detail });
  }

  /** Counts a local ICE candidate by type only (its address is never kept). */
  candidate(type: string | null | undefined): void {
    if (type === 'host' || type === 'srflx' || type === 'prflx' || type === 'relay')
      this.candidates[type]++;
  }

  /** Watches a WebRTC connection's states (listeners added, PeerJS's own handlers left alone). */
  watch(pc: RTCPeerConnection | null | undefined, onFailed?: () => void): void {
    if (!pc) return this.add('webrtc', 'no peer connection');
    pc.addEventListener('icecandidate', (e) => this.candidate(e.candidate?.type));
    pc.addEventListener('icegatheringstatechange', () => {
      this.add('ice-gathering', pc.iceGatheringState);
      if (pc.iceGatheringState === 'complete') this.add('candidates', this.candidateSummary());
    });
    pc.addEventListener('iceconnectionstatechange', () => {
      this.add('ice', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') onFailed?.();
    });
    pc.addEventListener('connectionstatechange', () => this.add('connection', pc.connectionState));
  }

  candidateSummary(): string {
    const c = this.candidates;
    return `host ${c.host}, srflx ${c.srflx}, prflx ${c.prflx}, relay ${c.relay}`;
  }

  /** True when the game found no public address (STUN unanswered: UDP blocked on this network). */
  get noPublicAddress(): boolean {
    return this.candidates.srflx === 0 && this.candidates.prflx === 0;
  }

  /** Plain text to paste into a bug report. */
  report(version: string, platform: string): string {
    const lines = [
      `VanguardSim connection report (room code, ${this.role ?? 'not started'})`,
      `version ${version}, ${platform}, relay servers: ${this.relays || 'none'}`,
      `local candidates: ${this.candidateSummary()}`,
      ...this.entries.map(
        (e) => `${String(e.t).padStart(6)} ms  ${e.stage}${e.detail ? `: ${e.detail}` : ''}`,
      ),
    ];
    return lines.join('\n');
  }

  get list(): readonly DiagEntry[] {
    return this.entries;
  }
}

/** The latest room-code attempt (Play Online and device sync share it). */
export const connectionLog = new ConnectionLog();

/** What to tell the player when the direct connection failed. */
export function directFailMessage(log: ConnectionLog): string {
  if (log.noPublicAddress)
    return 'Could not connect: your network did not let the game find its public address (it may block UDP). Try another network, or connect by address (for example over Tailscale).';
  const report = 'Use "Copy connection report" to send us the details.';
  return log.relays
    ? `Could not connect to your friend's game, not even through the relay server. Try again, try another network, or connect by address (for example over Tailscale). ${report}`
    : `Could not connect directly to your friend's game: one of your networks blocks direct connections, and no relay server is available. Try another network (mobile data or home Wi-Fi), or connect by address (for example over Tailscale). ${report}`;
}
