import http from 'http';
import path from 'path';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';

interface ConnectedPeer {
  socket: WebSocket;
  deviceId: string;
  room: string;
  connectedAt: number;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Zero-knowledge health check — signaling server stores NO question data
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'questbook-signaling-relay',
      storesQuestionData: false,
      connectedPeers: peers.size,
      timestamp: Date.now(),
    });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws/sync' });

  // Ephemeral in-memory routing table only (deviceId -> peer socket)
  const peers = new Map<string, ConnectedPeer>();
  // Ephemeral single-use pairing tokens (token -> { hostDeviceId, expiresAt, used })
  const pairingTokens = new Map<string, { hostDeviceId: string; expiresAt: number; used: boolean }>();

  // Periodic cleanup of expired pairing tokens
  setInterval(() => {
    const now = Date.now();
    for (const [token, info] of pairingTokens.entries()) {
      if (info.expiresAt < now || info.used) {
        pairingTokens.delete(token);
      }
    }
  }, 30_000);

  wss.on('connection', (socket) => {
    let registeredDeviceId: string | null = null;

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type: string;
          deviceId?: string;
          targetDeviceId?: string;
          room?: string;
          token?: string;
          expiresAt?: number;
          payload?: unknown;
        };

        if (msg.type === 'REGISTER' && msg.deviceId) {
          registeredDeviceId = msg.deviceId;
          peers.set(msg.deviceId, {
            socket,
            deviceId: msg.deviceId,
            room: msg.room || 'default',
            connectedAt: Date.now(),
          });
          socket.send(
            JSON.stringify({
              type: 'REGISTERED',
              deviceId: msg.deviceId,
              onlinePeers: Array.from(peers.keys()).filter((id) => id !== msg.deviceId),
            }),
          );
          // Notify other peers in same room of presence
          for (const [id, peer] of peers.entries()) {
            if (id !== msg.deviceId && peer.socket.readyState === WebSocket.OPEN) {
              peer.socket.send(JSON.stringify({ type: 'PEER_ONLINE', deviceId: msg.deviceId }));
            }
          }
          return;
        }

        if (msg.type === 'PAIR_TOKEN_CREATE' && msg.token && msg.deviceId) {
          pairingTokens.set(msg.token, {
            hostDeviceId: msg.deviceId,
            expiresAt: msg.expiresAt || Date.now() + 5 * 60 * 1000,
            used: false,
          });
          socket.send(JSON.stringify({ type: 'PAIR_TOKEN_READY', token: msg.token }));
          return;
        }

        if (msg.type === 'PAIR_TOKEN_CLAIM' && msg.token && msg.deviceId) {
          const entry = pairingTokens.get(msg.token);
          if (!entry) {
            socket.send(JSON.stringify({ type: 'PAIR_ERROR', reason: 'Invalid or unknown pairing token.' }));
            return;
          }
          if (entry.used) {
            socket.send(JSON.stringify({ type: 'PAIR_ERROR', reason: 'Pairing token has already been used (single-use).' }));
            return;
          }
          if (entry.expiresAt < Date.now()) {
            pairingTokens.delete(msg.token);
            socket.send(JSON.stringify({ type: 'PAIR_ERROR', reason: 'Pairing token has expired.' }));
            return;
          }
          entry.used = true;
          const hostPeer = peers.get(entry.hostDeviceId);
          if (hostPeer && hostPeer.socket.readyState === WebSocket.OPEN) {
            hostPeer.socket.send(
              JSON.stringify({
                type: 'PAIR_REQUEST',
                fromDeviceId: msg.deviceId,
                token: msg.token,
                payload: msg.payload,
              }),
            );
          } else {
            socket.send(
              JSON.stringify({
                type: 'PAIR_ERROR',
                reason: 'Host device is not currently connected to the signaling relay.',
              }),
            );
          }
          return;
        }

        // Ephemeral relay for encrypted sync envelopes, pairing confirmations, and WebRTC SDP/ICE
        if (msg.targetDeviceId) {
          const target = peers.get(msg.targetDeviceId);
          if (target && target.socket.readyState === WebSocket.OPEN) {
            target.socket.send(
              JSON.stringify({
                ...msg,
                fromDeviceId: registeredDeviceId ?? msg.deviceId,
              }),
            );
          } else {
            socket.send(
              JSON.stringify({
                type: 'PEER_UNREACHABLE',
                targetDeviceId: msg.targetDeviceId,
                reason: 'Target peer is currently offline.',
              }),
            );
          }
        }
      } catch {
        socket.send(JSON.stringify({ type: 'ERROR', reason: 'Malformed JSON envelope.' }));
      }
    });

    socket.on('close', () => {
      if (registeredDeviceId) {
        peers.delete(registeredDeviceId);
        for (const peer of peers.values()) {
          if (peer.socket.readyState === WebSocket.OPEN) {
            peer.socket.send(JSON.stringify({ type: 'PEER_OFFLINE', deviceId: registeredDeviceId }));
          }
        }
      }
    });
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`QuestBook server & zero-knowledge signaling relay listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start QuestBook server:', err);
  process.exit(1);
});
