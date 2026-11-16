"""
QuestBook Local Companion Service (Python FastAPI)
Provides native LAN capabilities that browser-only PWAs cannot perform directly:
1. Local Wi-Fi WebSocket sync relay & peer discovery (port 8765)
2. mDNS / DNS-SD service advertisement (_questbook._tcp.local.) when zeroconf is installed
3. Encrypted .qbk snapshot backup directory management on local filesystem / NAS
"""

from __future__ import annotations

import asyncio
import json
import os
import socket
import time
from pathlib import Path
from typing import Dict

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from zeroconf import ServiceInfo, Zeroconf
    ZEROCONF_AVAILABLE = True
except ImportError:
    ZEROCONF_AVAILABLE = False

COMPANION_PORT = int(os.environ.get("QUESTBOOK_COMPANION_PORT", "8765"))
BACKUP_DIR = Path(os.environ.get("QUESTBOOK_BACKUP_DIR", "./questbook_backups"))
BACKUP_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="QuestBook Local Companion", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

connected_peers: Dict[str, WebSocket] = {}
zeroconf_instance = None
service_info = None


class BackupUpload(BaseModel):
    fileName: str
    archiveContent: str


@app.on_event("startup")
def startup_mdns():
    global zeroconf_instance, service_info
    if ZEROCONF_AVAILABLE:
        try:
            hostname = socket.gethostname()
            local_ip = socket.gethostbyname(hostname)
            zeroconf_instance = Zeroconf()
            service_info = ServiceInfo(
                "_questbook._tcp.local.",
                f"QuestBook-{hostname}._questbook._tcp.local.",
                addresses=[socket.inet_aton(local_ip)],
                port=COMPANION_PORT,
                properties={"version": "1.0", "protocol": "questbook-sync-v1"},
            )
            zeroconf_instance.register_service(service_info)
        except Exception:
            zeroconf_instance = None


@app.on_event("shutdown")
def shutdown_mdns():
    if zeroconf_instance and service_info:
        zeroconf_instance.unregister_service(service_info)
        zeroconf_instance.close()


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "questbook-python-companion",
        "mdnsAvailable": ZEROCONF_AVAILABLE,
        "connectedPeers": list(connected_peers.keys()),
        "backupDir": str(BACKUP_DIR.resolve()),
        "timestamp": int(time.time() * 1000),
    }


@app.post("/backups/save")
def save_encrypted_backup(payload: BackupUpload):
    safe_name = Path(payload.fileName).name
    if not safe_name.endswith(".qbk"):
        raise HTTPException(status_code=400, detail="Backup file must end with .qbk")
    target = BACKUP_DIR / safe_name
    target.write_text(payload.archiveContent, encoding="utf-8")
    return {"saved": True, "path": str(target.resolve()), "bytes": len(payload.archiveContent)}


@app.get("/backups/list")
def list_backups():
    files = sorted(BACKUP_DIR.glob("*.qbk"), key=lambda p: p.stat().st_mtime, reverse=True)
    return {
        "backups": [
            {"fileName": f.name, "sizeBytes": f.stat().st_size, "modifiedAt": int(f.stat().st_mtime * 1000)}
            for f in files
        ]
    }


@app.websocket("/ws/sync")
async def local_sync_ws(websocket: WebSocket):
    await websocket.accept()
    device_id = None
    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get("type")

            if msg_type == "REGISTER" and msg.get("deviceId"):
                device_id = str(msg["deviceId"])
                connected_peers[device_id] = websocket
                await websocket.send_text(
                    json.dumps({
                        "type": "REGISTERED",
                        "deviceId": device_id,
                        "onlinePeers": [pid for pid in connected_peers if pid != device_id],
                    })
                )
                for pid, peer_ws in list(connected_peers.items()):
                    if pid != device_id:
                        await peer_ws.send_text(json.dumps({"type": "PEER_ONLINE", "deviceId": device_id}))
                continue

            target_id = msg.get("targetDeviceId")
            if target_id and target_id in connected_peers:
                msg["fromDeviceId"] = device_id or msg.get("deviceId")
                await connected_peers[target_id].send_text(json.dumps(msg))
            elif target_id:
                await websocket.send_text(
                    json.dumps({"type": "PEER_UNREACHABLE", "targetDeviceId": target_id})
                )
    except WebSocketDisconnect:
        if device_id and device_id in connected_peers:
            del connected_peers[device_id]
            for peer_ws in list(connected_peers.values()):
                await peer_ws.send_text(json.dumps({"type": "PEER_OFFLINE", "deviceId": device_id}))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=COMPANION_PORT)
