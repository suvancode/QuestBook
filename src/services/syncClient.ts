import { db } from '../db/database';
import { QuestBookRepo, uuid } from '../db/repository';
import {
  decryptText,
  deriveSharedSessionKey,
  encryptText,
  generatePairingToken,
  signPayload,
  verifySignature,
} from '../core/crypto';
import { createSyncMessage, filterMissingOperations, SyncProtocolMessage } from '../core/syncEngine';
import { DeviceRecord, SyncOperation } from '../types/questbook';

export interface PairingQRData {
  v: 1;
  token: string;
  expiresAt: number;
  deviceId: string;
  deviceName: string;
  deviceType: DeviceRecord['deviceType'];
  ed25519PublicKey: string;
  x25519PublicKey: string;
  fingerprint: string;
  relayUrl: string;
}

export interface SyncSessionResult {
  peerDeviceId: string;
  peerDeviceName: string;
  transport: 'websocket_relay' | 'webrtc_datachannel';
  pushedCount: number;
  pulledCount: number;
  conflictsCount: number;
  status: 'success' | 'failed';
  message: string;
}

type Listener = (event: { type: string; detail?: unknown }) => void;

export class QuestBookSyncService {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private onlinePeerIds = new Set<string>();
  private peerConnections = new Map<string, RTCPeerConnection>();
  private dataChannels = new Map<string, RTCDataChannel>();
  private pendingPairRequests = new Map<string, PairingQRData & { fromDeviceId: string }>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(type: string, detail?: unknown) {
    for (const fn of this.listeners) {
      fn({ type, detail });
    }
  }

  getDefaultRelayUrl(): string {
    if (typeof window === 'undefined') return 'ws://localhost:3000/ws/sync';
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws/sync`;
  }

  getOnlinePeerIds(): string[] {
    return Array.from(this.onlinePeerIds);
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  async connect(customUrl?: string): Promise<void> {
    const secret = await QuestBookRepo.getLocalSecret();
    const prefs = await QuestBookRepo.getPreferences();
    const targetUrl = customUrl?.trim() || prefs.signalingUrl?.trim() || this.getDefaultRelayUrl();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const socket = new WebSocket(targetUrl);
        this.ws = socket;

        const timer = setTimeout(() => {
          if (socket.readyState !== WebSocket.OPEN) {
            socket.close();
            reject(new Error(`Connection to ${targetUrl} timed out.`));
          }
        }, 6000);

        socket.onopen = () => {
          clearTimeout(timer);
          socket.send(JSON.stringify({ type: 'REGISTER', deviceId: secret.deviceId, room: 'default' }));
          this.emit('status', { connected: true, url: targetUrl });
          resolve();
        };

        socket.onmessage = async (ev) => {
          await this.handleSocketMessage(String(ev.data));
        };

        socket.onclose = () => {
          clearTimeout(timer);
          this.onlinePeerIds.clear();
          this.emit('status', { connected: false, url: targetUrl });
        };

        socket.onerror = () => {
          clearTimeout(timer);
          reject(new Error(`Unable to reach signaling relay at ${targetUrl}.`));
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    for (const pc of this.peerConnections.values()) {
      pc.close();
    }
    this.peerConnections.clear();
    this.dataChannels.clear();
    this.onlinePeerIds.clear();
    this.emit('status', { connected: false });
  }

  async generatePairingQR(): Promise<PairingQRData> {
    const secret = await QuestBookRepo.getLocalSecret();
    const selfDevice = await db.devices.get(secret.deviceId);
    const token = generatePairingToken();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5-minute single-use expiry
    const relayUrl = this.getDefaultRelayUrl();

    if (!this.isConnected()) {
      await this.connect().catch(() => {});
    }
    if (this.isConnected()) {
      this.ws?.send(
        JSON.stringify({
          type: 'PAIR_TOKEN_CREATE',
          deviceId: secret.deviceId,
          token,
          expiresAt,
        }),
      );
    }

    return {
      v: 1,
      token,
      expiresAt,
      deviceId: secret.deviceId,
      deviceName: secret.deviceName,
      deviceType: selfDevice?.deviceType ?? 'desktop',
      ed25519PublicKey: secret.ed25519PublicKeyHex,
      x25519PublicKey: secret.x25519PublicKeyHex,
      fingerprint: secret.fingerprint,
      relayUrl,
    };
  }

  async initiatePairingFromQR(qrJson: string): Promise<DeviceRecord> {
    let parsed: PairingQRData;
    try {
      parsed = JSON.parse(qrJson) as PairingQRData;
    } catch {
      throw new Error('Invalid pairing QR payload.');
    }
    if (parsed.v !== 1 || !parsed.token || !parsed.deviceId || !parsed.ed25519PublicKey) {
      throw new Error('Incomplete device identity information in pairing QR.');
    }
    if (parsed.expiresAt < Date.now()) {
      throw new Error('This pairing QR code has expired. Generate a fresh QR on the host device.');
    }

    const secret = await QuestBookRepo.getLocalSecret();
    if (parsed.deviceId === secret.deviceId) {
      throw new Error('Cannot pair a device with itself.');
    }

    // Connect to the host's relay if reachable
    if (!this.isConnected()) {
      await this.connect(parsed.relayUrl);
    }

    const selfDevice = await db.devices.get(secret.deviceId);
    const myIdentity = {
      v: 1,
      token: parsed.token,
      expiresAt: parsed.expiresAt,
      deviceId: secret.deviceId,
      deviceName: secret.deviceName,
      deviceType: selfDevice?.deviceType ?? 'desktop',
      ed25519PublicKey: secret.ed25519PublicKeyHex,
      x25519PublicKey: secret.x25519PublicKeyHex,
      fingerprint: secret.fingerprint,
      relayUrl: parsed.relayUrl,
    };

    // Send single-use token claim over signaling server
    this.ws?.send(
      JSON.stringify({
        type: 'PAIR_TOKEN_CLAIM',
        deviceId: secret.deviceId,
        token: parsed.token,
        payload: myIdentity,
      }),
    );

    const paired = await QuestBookRepo.pairTrustedDevice({
      id: parsed.deviceId,
      name: parsed.deviceName,
      deviceType: parsed.deviceType,
      ed25519PublicKey: parsed.ed25519PublicKey,
      x25519PublicKey: parsed.x25519PublicKey,
      fingerprint: parsed.fingerprint,
    });
    this.emit('paired', paired);
    return paired;
  }

  async confirmIncomingPairing(req: PairingQRData): Promise<DeviceRecord> {
    const paired = await QuestBookRepo.pairTrustedDevice({
      id: req.deviceId,
      name: req.deviceName,
      deviceType: req.deviceType,
      ed25519PublicKey: req.ed25519PublicKey,
      x25519PublicKey: req.x25519PublicKey,
      fingerprint: req.fingerprint,
    });
    this.pendingPairRequests.delete(req.deviceId);
    this.emit('paired', paired);
    return paired;
  }

  // Establish WebRTC DataChannel with a trusted peer
  async connectWebRTCPeer(peerDeviceId: string): Promise<RTCDataChannel> {
    const existing = this.dataChannels.get(peerDeviceId);
    if (existing && existing.readyState === 'open') return existing;

    if (!this.isConnected()) {
      await this.connect();
    }

    const prefs = await QuestBookRepo.getPreferences();
    const secret = await QuestBookRepo.getLocalSecret();
    const iceServers: RTCIceServer[] = prefs.stunServers.map((urls) => ({ urls }));
    if (prefs.turnServerUrl) {
      iceServers.push({ urls: prefs.turnServerUrl, username: prefs.turnUsername || undefined });
    }

    const pc = new RTCPeerConnection({ iceServers });
    this.peerConnections.set(peerDeviceId, pc);

    const dc = pc.createDataChannel('questbook-sync-v1', { ordered: true });
    this.attachDataChannelHandlers(peerDeviceId, dc);

    pc.onicecandidate = (e) => {
      if (e.candidate && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: 'WEBRTC_ICE',
            deviceId: secret.deviceId,
            targetDeviceId: peerDeviceId,
            payload: e.candidate,
          }),
        );
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.ws?.send(
      JSON.stringify({
        type: 'WEBRTC_OFFER',
        deviceId: secret.deviceId,
        targetDeviceId: peerDeviceId,
        payload: offer,
      }),
    );

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WebRTC DataChannel negotiation timed out.')), 8000);
      dc.onopen = () => {
        clearTimeout(timeout);
        this.dataChannels.set(peerDeviceId, dc);
        resolve(dc);
      };
    });
  }

  private attachDataChannelHandlers(peerDeviceId: string, dc: RTCDataChannel) {
    dc.onmessage = async (ev) => {
      await this.handleEncryptedSyncEnvelope(peerDeviceId, String(ev.data), 'webrtc_datachannel', dc);
    };
  }

  async syncWithPeer(
    peerDeviceId: string,
    preferWebRTC = false,
  ): Promise<SyncSessionResult> {
    const peer = await db.devices.get(peerDeviceId);
    if (!peer) throw new Error('Peer device not found.');
    if (peer.trustStatus === 'revoked') {
      throw new Error(`Device "${peer.name}" is revoked. Synchronization blocked.`);
    }

    const secret = await QuestBookRepo.getLocalSecret();
    if (!this.isConnected()) {
      await this.connect();
    }

    let transport: 'websocket_relay' | 'webrtc_datachannel' = 'websocket_relay';
    let dc: RTCDataChannel | undefined;

    if (preferWebRTC) {
      try {
        dc = await this.connectWebRTCPeer(peerDeviceId);
        transport = 'webrtc_datachannel';
      } catch {
        // Fall back to authenticated E2E encrypted WebSocket relay if ICE fails
        transport = 'websocket_relay';
      }
    }

    const checkpoint = await db.syncCheckpoints.get(peerDeviceId);
    const seenIds = new Set(checkpoint?.lastAckedOperationIds ?? []);
    const allOps = await db.syncOperations.toArray();
    const missingOps = filterMissingOperations(allOps, seenIds);

    const sessionKey = deriveSharedSessionKey(secret.x25519SecretKeyHex, peer.x25519PublicKey);
    const syncMessage = createSyncMessage(
      'CHANGE_BATCH',
      secret.deviceId,
      { ops: missingOps },
      peerDeviceId,
    );

    const plaintext = JSON.stringify(syncMessage);
    const encrypted = encryptText(plaintext, sessionKey, `${secret.deviceId}->${peerDeviceId}`);
    const signature = signPayload(encrypted.cipherHex, secret.ed25519SecretKeyHex);

    const envelope = JSON.stringify({
      type: 'SYNC_ENVELOPE',
      deviceId: secret.deviceId,
      targetDeviceId: peerDeviceId,
      nonceHex: encrypted.nonceHex,
      cipherHex: encrypted.cipherHex,
      signature,
    });

    if (transport === 'webrtc_datachannel' && dc && dc.readyState === 'open') {
      dc.send(envelope);
    } else if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(envelope);
    } else {
      throw new Error('No active network transport available. Changes remain queued locally.');
    }

    await db.syncCheckpoints.put({
      peerDeviceId,
      lastAckedTimestamp: Date.now(),
      lastAckedOperationIds: Array.from(new Set([...seenIds, ...missingOps.map((o) => o.operationId)])).slice(-200),
      lastSyncDirection: 'push',
      lastSyncStatus: 'success',
      lastSyncSummary: `Pushed ${missingOps.length} encrypted operations via ${transport}`,
      updatedAt: Date.now(),
    });
    await db.devices.update(peerDeviceId, { lastSyncedAt: Date.now(), lastConnectedAt: Date.now() });

    const res: SyncSessionResult = {
      peerDeviceId,
      peerDeviceName: peer.name,
      transport,
      pushedCount: missingOps.length,
      pulledCount: 0,
      conflictsCount: 0,
      status: 'success',
      message: `Sent ${missingOps.length} encrypted operation(s) to ${peer.name} over ${transport}.`,
    };
    this.emit('synced', res);
    return res;
  }

  private async handleSocketMessage(raw: string) {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }

    const type = String(msg.type || '');
    if (type === 'REGISTERED') {
      const list = (msg.onlinePeers as string[]) || [];
      this.onlinePeerIds = new Set(list);
      this.emit('peers', Array.from(this.onlinePeerIds));
      return;
    }
    if (type === 'PEER_ONLINE' && typeof msg.deviceId === 'string') {
      this.onlinePeerIds.add(msg.deviceId);
      this.emit('peers', Array.from(this.onlinePeerIds));
      return;
    }
    if (type === 'PEER_OFFLINE' && typeof msg.deviceId === 'string') {
      this.onlinePeerIds.delete(msg.deviceId);
      this.emit('peers', Array.from(this.onlinePeerIds));
      return;
    }
    if (type === 'PAIR_REQUEST' && msg.payload) {
      const qr = msg.payload as PairingQRData;
      this.pendingPairRequests.set(qr.deviceId, { ...qr, fromDeviceId: String(msg.fromDeviceId || qr.deviceId) });
      this.emit('pair_request', qr);
      return;
    }
    if (type === 'PAIR_ERROR') {
      this.emit('pair_error', msg.reason);
      return;
    }
    if (type === 'PEER_UNREACHABLE') {
      this.emit('sync_error', msg.reason || 'Peer device is currently offline.');
      return;
    }

    const fromDeviceId = String(msg.fromDeviceId || msg.deviceId || '');
    if (!fromDeviceId) return;

    if (type === 'WEBRTC_OFFER' && msg.payload) {
      await this.handleIncomingOffer(fromDeviceId, msg.payload as RTCSessionDescriptionInit);
      return;
    }
    if (type === 'WEBRTC_ANSWER' && msg.payload) {
      const pc = this.peerConnections.get(fromDeviceId);
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(msg.payload as RTCSessionDescriptionInit));
      return;
    }
    if (type === 'WEBRTC_ICE' && msg.payload) {
      const pc = this.peerConnections.get(fromDeviceId);
      if (pc) await pc.addIceCandidate(new RTCIceCandidate(msg.payload as RTCIceCandidateInit));
      return;
    }

    if (type === 'SYNC_ENVELOPE') {
      await this.handleEncryptedSyncEnvelope(fromDeviceId, raw, 'websocket_relay');
    }
  }

  private async handleIncomingOffer(fromDeviceId: string, offer: RTCSessionDescriptionInit) {
    const peer = await db.devices.get(fromDeviceId);
    if (!peer || peer.trustStatus === 'revoked') return;
    const prefs = await QuestBookRepo.getPreferences();
    const secret = await QuestBookRepo.getLocalSecret();

    const pc = new RTCPeerConnection({
      iceServers: prefs.stunServers.map((urls) => ({ urls })),
    });
    this.peerConnections.set(fromDeviceId, pc);
    pc.ondatachannel = (e) => {
      this.dataChannels.set(fromDeviceId, e.channel);
      this.attachDataChannelHandlers(fromDeviceId, e.channel);
    };
    pc.onicecandidate = (e) => {
      if (e.candidate && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: 'WEBRTC_ICE',
            deviceId: secret.deviceId,
            targetDeviceId: fromDeviceId,
            payload: e.candidate,
          }),
        );
      }
    };
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.ws?.send(
      JSON.stringify({
        type: 'WEBRTC_ANSWER',
        deviceId: secret.deviceId,
        targetDeviceId: fromDeviceId,
        payload: answer,
      }),
    );
  }

  private async handleEncryptedSyncEnvelope(
    fromDeviceId: string,
    raw: string,
    transport: 'websocket_relay' | 'webrtc_datachannel',
    dc?: RTCDataChannel,
  ) {
    const secret = await QuestBookRepo.getLocalSecret();
    const peer = await db.devices.get(fromDeviceId);
    if (!peer) {
      this.emit('sync_error', `Ignored encrypted sync envelope from unknown device ${fromDeviceId}.`);
      return;
    }
    if (peer.trustStatus === 'revoked') {
      await db.deviceHistory.put({
        id: uuid(),
        deviceId: peer.id,
        deviceName: peer.name,
        action: 'rejected',
        details: 'Rejected inbound encrypted sync envelope from revoked peer.',
        timestamp: Date.now(),
      });
      this.emit('sync_error', `Blocked sync from revoked device "${peer.name}".`);
      return;
    }

    const envelope = JSON.parse(raw) as {
      nonceHex: string;
      cipherHex: string;
      signature: string;
    };

    if (!verifySignature(envelope.cipherHex, envelope.signature, peer.ed25519PublicKey)) {
      this.emit('sync_error', `Invalid Ed25519 signature from "${peer.name}". Sync rejected.`);
      return;
    }

    const sessionKey = deriveSharedSessionKey(secret.x25519SecretKeyHex, peer.x25519PublicKey);
    const plain = decryptText(envelope.cipherHex, envelope.nonceHex, sessionKey, `${fromDeviceId}->${secret.deviceId}`);
    const protocolMsg = JSON.parse(plain) as SyncProtocolMessage<{ ops?: SyncOperation[]; ackedIds?: string[] }>;

    if (protocolMsg.type === 'CHANGE_BATCH' && Array.isArray(protocolMsg.payload.ops)) {
      const result = await QuestBookRepo.applyIncomingOperations(fromDeviceId, protocolMsg.payload.ops);
      const ackMsg = createSyncMessage(
        'ACK',
        secret.deviceId,
        { ackedIds: protocolMsg.payload.ops.map((o) => o.operationId) },
        fromDeviceId,
      );
      const encAck = encryptText(JSON.stringify(ackMsg), sessionKey, `${secret.deviceId}->${fromDeviceId}`);
      const sigAck = signPayload(encAck.cipherHex, secret.ed25519SecretKeyHex);
      const ackEnvelope = JSON.stringify({
        type: 'SYNC_ENVELOPE',
        deviceId: secret.deviceId,
        targetDeviceId: fromDeviceId,
        nonceHex: encAck.nonceHex,
        cipherHex: encAck.cipherHex,
        signature: sigAck,
      });

      if (dc && dc.readyState === 'open') {
        dc.send(ackEnvelope);
      } else {
        this.ws?.send(ackEnvelope);
      }

      this.emit('synced', {
        peerDeviceId: peer.id,
        peerDeviceName: peer.name,
        transport,
        pushedCount: 0,
        pulledCount: result.appliedCount,
        conflictsCount: result.conflictCount,
        status: 'success',
        message: `Received ${result.appliedCount} operation(s) from ${peer.name}.`,
      });
    } else if (protocolMsg.type === 'ACK') {
      this.emit('ack', { peerDeviceId: peer.id, ackedIds: protocolMsg.payload.ackedIds ?? [] });
    }
  }
}

export const syncService = new QuestBookSyncService();
