import { describe, expect, it } from 'vitest';
import { cleanIceServers, fetchRelayServers } from '../renderer/online/relay';
import {
  connectionLog,
  ConnectionLog,
  directFailMessage,
  iceConfig,
  STUN_SERVERS,
} from '../renderer/online/connectionDiag';

// owner's report 2026-11-18: "Online Code only works when using a VPN"
describe('room-code connection diagnostics', () => {
  it('uses our STUN list and none of the PeerJS relay hosts that no longer exist', () => {
    const urls = iceConfig()
      .iceServers!.flatMap((s) => (Array.isArray(s.urls) ? s.urls : [s.urls]))
      .join(' ');
    expect(urls).toContain('stun:stun.l.google.com:19302');
    expect(urls).not.toContain('turn.peerjs.com');
    expect(iceConfig([{ urls: 'turn:relay.example:3478' }]).iceServers).toHaveLength(
      STUN_SERVERS.length + 1,
    );
  });

  /** A stand-in RTCPeerConnection: only the events the log listens to. */
  class FakePc extends EventTarget {
    iceGatheringState = 'new';
    iceConnectionState = 'new';
    connectionState = 'new';
    candidate(type: string) {
      this.dispatchEvent(Object.assign(new Event('icecandidate'), { candidate: { type } }));
    }
    set(key: 'iceGatheringState' | 'iceConnectionState' | 'connectionState', v: string) {
      this[key] = v;
      const ev = {
        iceGatheringState: 'icegatheringstatechange',
        iceConnectionState: 'iceconnectionstatechange',
        connectionState: 'connectionstatechange',
      }[key];
      this.dispatchEvent(new Event(ev));
    }
  }

  it('records stages, candidate types and states, and reports an ICE failure once', () => {
    let clock = 1000;
    const log = new ConnectionLog(() => clock);
    log.begin('join');
    log.add('service', 'open');
    const pc = new FakePc();
    let failed = 0;
    log.watch(pc as unknown as RTCPeerConnection, () => failed++);
    pc.candidate('host');
    pc.candidate('host');
    pc.candidate('srflx');
    clock = 1250;
    pc.set('iceGatheringState', 'complete');
    pc.set('iceConnectionState', 'checking');
    clock = 9000;
    pc.set('iceConnectionState', 'failed');
    expect(failed).toBe(1);
    expect(log.noPublicAddress).toBe(false);
    const text = log.report('0.46.0-alpha', 'Windows');
    expect(text).toContain('local candidates: host 2, srflx 1, prflx 0, relay 0');
    expect(text).toContain('250 ms  candidates: host 2, srflx 1');
    expect(text).toContain('8000 ms  ice: failed');
    expect(directFailMessage(log)).toContain('blocks direct connections');
  });

  it('without a public address it says the network may block UDP', () => {
    const log = new ConnectionLog(() => 0);
    log.begin('host');
    log.candidate('host');
    expect(log.noPublicAddress).toBe(true);
    expect(directFailMessage(log)).toContain('block UDP');
  });

  it('never keeps addresses: only candidate types are counted', () => {
    const log = new ConnectionLog(() => 0);
    log.begin('join');
    log.candidate('srflx');
    log.candidate('nonsense');
    expect(log.report('x', 'y')).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
    expect(log.candidateSummary()).toBe('host 0, srflx 1, prflx 0, relay 0');
  });
});

describe('relay servers (Cloudflare TURN through the relay Worker)', () => {
  const cf = {
    iceServers: [
      { urls: ['stun:stun.cloudflare.com:3478'] },
      {
        urls: [
          'turn:turn.cloudflare.com:3478?transport=udp',
          'turn:turn.cloudflare.com:53?transport=udp',
          'turns:turn.cloudflare.com:443?transport=tcp',
          'javascript:alert(1)',
        ],
        username: 'u',
        credential: 'c',
      },
      { urls: ['turn:no-password.example:3478'] },
    ],
  };

  it('keeps well-formed entries, drops port 53, junk URLs and relays without a password', () => {
    expect(cleanIceServers(cf)).toEqual([
      { urls: ['stun:stun.cloudflare.com:3478'] },
      {
        urls: [
          'turn:turn.cloudflare.com:3478?transport=udp',
          'turns:turn.cloudflare.com:443?transport=tcp',
        ],
        username: 'u',
        credential: 'c',
      },
    ]);
    expect(cleanIceServers({ nope: 1 })).toEqual([]);
    expect(cleanIceServers(null)).toEqual([]);
  });

  const answer = (status: number, body: unknown) =>
    (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it('asks the Worker and records how many relays it got', async () => {
    connectionLog.begin('join');
    const servers = await fetchRelayServers('https://relay.example/ice', answer(200, cf));
    expect(servers).toHaveLength(2);
    expect(connectionLog.relays).toBe(1);
    expect(connectionLog.report('v', 'p')).toContain('relay servers: 1');
  });

  it('carries on without a relay when none is set up, the Worker fails or does not answer', async () => {
    connectionLog.begin('host');
    expect(await fetchRelayServers('', answer(200, cf))).toEqual([]);
    expect(await fetchRelayServers('https://relay.example/ice', answer(503, {}))).toEqual([]);
    const broken = (async () => {
      throw new TypeError('network');
    }) as unknown as typeof fetch;
    expect(await fetchRelayServers('https://relay.example/ice', broken)).toEqual([]);
    expect(connectionLog.relays).toBe(0);
    const stages = connectionLog.list.map((e) => `${e.stage} ${e.detail}`);
    expect(stages).toEqual(
      expect.arrayContaining(['relay not set up', 'relay HTTP 503', 'relay unreachable']),
    );
  });
});
