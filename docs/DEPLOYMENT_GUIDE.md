# Deployment & PWA Installation Guide

## Production Build

```bash
npm run build
NODE_ENV=production npm start
```

This serves the compiled PWA from `dist/` alongside the zero-knowledge `/ws/sync` WebSocket signaling endpoint on port 3000 (or `process.env.PORT`).

## Installing the PWA

- **Desktop Chrome / Edge**: Click the **Install App** button in the top bar (wired via `beforeinstallprompt`) or the browser address bar install icon.
- **Android Chrome**: Tap **Install App** or Chrome menu -> **Add to Home screen**; supports Web Share Target (`/capture`) once installed.
- **iOS Safari**: Tap **Install iOS** for step-by-step instructions (`Share` -> `Add to Home Screen`).

## Optional TURN Server Infrastructure

WebRTC direct peer-to-peer connections work across most networks using STUN, but symmetric NATs or corporate firewalls require a **TURN relay** (`coturn`). TURN relays incur bandwidth/hosting costs and must be provisioned separately and configured in **Settings -> Sync Transport**.
