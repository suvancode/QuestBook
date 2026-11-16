# QuestBook Python FastAPI Local Companion

Browsers running a PWA cannot natively broadcast mDNS/DNS-SD service records or write automated rotating backups directly to arbitrary folders on disk. This lightweight local companion bridges those native capabilities on Windows, macOS, and Linux desktops or a home server.

## Run Locally

```bash
cd companion
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

By default it listens on `0.0.0.0:8765`, advertises `_questbook._tcp.local.` via mDNS, and exposes:
- `ws://<lan-ip>:8765/ws/sync` — Local Wi-Fi WebSocket transport (configure in QuestBook Settings -> Synchronization -> Local Companion URL)
- `POST /backups/save` & `GET /backups/list` — Stores encrypted `.qbk` archives in `./questbook_backups`
