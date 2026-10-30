// Online play, stage 1 (DECISIONS D-032): the network connection, in the main process only.
// The game window stays offline; it talks to this module over IPC.
//
// Host: a TCP server for one guest. Guest: a TCP client. Messages are JSON, one per line. Lines
// longer than the limit are dropped and the connection closed (the guest only sends small
// messages; the host sends views of a few hundred kB at most). Nothing here reads the messages:
// the renderer parses and checks them (src/net/protocol.ts).
const net = require('node:net');
const os = require('node:os');

const MAX_FROM_GUEST = 64 * 1024;
const MAX_FROM_HOST = 8 * 1024 * 1024;

/** Calls `onLine` for each complete line; returns false (and stops) if one is too long. */
function lineReader(maxBytes, onLine, onTooLong) {
  let buffer = '';
  return (chunk) => {
    buffer += chunk;
    let at;
    while ((at = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, at);
      buffer = buffer.slice(at + 1);
      if (line.length > maxBytes) return onTooLong();
      if (line.length > 0) onLine(line);
    }
    if (buffer.length > maxBytes) onTooLong();
  };
}

/** This machine's IPv4 addresses a friend could connect to (LAN, Tailscale, ZeroTier, …). */
function localAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal) out.push({ name, address: a.address });
    }
  }
  return out;
}

/**
 * One online connection at a time. `emit(kind, data)` sends an event to the game window:
 * hosting / guest-connected / guest-left / connected / disconnected / message / error.
 */
function createOnline(emit) {
  let server = null;
  let socket = null;

  const closeSocket = () => {
    if (socket) {
      const s = socket;
      s.removeAllListeners();
      s.on('error', () => {});
      // end() sends what is still queued (e.g. a goodbye message) before closing
      s.end();
      setTimeout(() => s.destroy(), 1000).unref?.();
      socket = null;
    }
  };
  const stop = () => {
    closeSocket();
    if (server) {
      server.close();
      server = null;
    }
  };

  const attach = (s, maxBytes, leftKind) => {
    socket = s;
    s.setEncoding('utf8');
    s.setNoDelay(true);
    s.setKeepAlive(true, 10000);
    s.on(
      'data',
      lineReader(
        maxBytes,
        (line) => emit('message', line),
        () => {
          emit('error', 'The other player sent a message that was too large.');
          closeSocket();
          emit(leftKind, null);
        },
      ),
    );
    s.on('error', (err) => emit('error', err.message));
    s.on('close', () => {
      if (socket === s) socket = null;
      emit(leftKind, null);
    });
  };

  return {
    host(port) {
      stop();
      return new Promise((resolve) => {
        server = net.createServer((s) => {
          if (socket) {
            // one guest at a time
            s.end(`${JSON.stringify({ t: 'reject', reason: 'This game already has a guest.' })}\n`);
            return;
          }
          attach(s, MAX_FROM_GUEST, 'guest-left');
          emit('guest-connected', { address: s.remoteAddress });
        });
        server.on('error', (err) => {
          emit('error', err.message);
          resolve({ ok: false, error: err.message });
        });
        server.listen(port, '0.0.0.0', () =>
          resolve({ ok: true, port, addresses: localAddresses() }),
        );
      });
    },
    join(address, port) {
      stop();
      return new Promise((resolve) => {
        const s = net.connect({ host: address, port, timeout: 10000 });
        s.once('connect', () => {
          s.setTimeout(0);
          attach(s, MAX_FROM_HOST, 'disconnected');
          emit('connected', null);
          resolve({ ok: true });
        });
        s.once('timeout', () => {
          s.destroy();
          resolve({
            ok: false,
            error: 'No answer from that address (check it, the port and any firewall).',
          });
        });
        s.once('error', (err) => resolve({ ok: false, error: err.message }));
      });
    },
    send(line) {
      if (!socket || typeof line !== 'string' || line.includes('\n')) return false;
      socket.write(`${line}\n`);
      return true;
    },
    /** Host: disconnects the current guest and keeps listening. */
    drop() {
      const s = socket;
      closeSocket();
      if (s && server) emit('guest-left', null);
    },
    /** Drops the guest (host) or leaves (guest); hosting stops too. */
    stop,
  };
}

module.exports = { createOnline, lineReader };
