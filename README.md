# QuestBook

<p align="center">
  <img src="public/icon.svg" alt="QuestBook Logo" width="96" height="96" />
</p>

<p align="center">
  <strong>Capture Curiosity. Discover Knowledge.</strong><br />
  A privacy-first, offline-capable, cloudless personal question management and research discovery workspace.
</p>

<p align="center">
  <a href="https://questbook-iota.vercel.app"><img src="https://img.shields.io/badge/Vercel-Deployed-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel Deployment" /></a>
  <a href="https://questbook-app.netlify.app"><img src="https://img.shields.io/badge/Netlify-Deployed-00C7B7?style=for-the-badge&logo=netlify&logoColor=white" alt="Netlify Deployment" /></a>
  <a href="https://github.com/suvancode/QuestBook"><img src="https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Repo" /></a>
  <img src="https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PWA-Offline--Ready-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white" alt="PWA" />
  <img src="https://img.shields.io/badge/Tests-Passing-brightgreen?style=for-the-badge&logo=jest&logoColor=white" alt="Tests" />
  <img src="https://img.shields.io/badge/License-Apache--2.0-blue?style=for-the-badge" alt="License" />
</p>

---

## 🌐 Live Deployments

- **Production (Vercel)**: [https://questbook-iota.vercel.app](https://questbook-iota.vercel.app)
- **Edge Mirror (Netlify)**: [https://questbook-app.netlify.app](https://questbook-app.netlify.app)
- **Source Code (GitHub)**: [https://github.com/suvancode/QuestBook](https://github.com/suvancode/QuestBook)

---

## 💡 Core Philosophy

> **"Capture now. Explore later. Never forget a question."**

We encounter intriguing thoughts, rabbit holes, and burning questions constantly—while reading, commuting, coding, or watching lectures. Most note-taking apps are too slow, require cloud accounts, or bury questions alongside grocery lists.

**QuestBook** treats questions as first-class citizens. It provides a frictionless 5-second capture pipeline, pairs each inquiry with external exploration engines, and keeps 100% of your data stored locally in your browser's encrypted vault.

---

## ✨ Key Features

### 🚀 5-Second Quick Capture
- **Minimal friction**: Tap capture, type a title, hit save—no mandatory fields.
- **Voice input**: Speech-to-text recording with automatic live transcript insertion and manual text fallback.
- **Image & attachment support**: Upload screenshots, photos, diagrams, or use your device camera.
- **PWA Web Share Target**: Share text or links directly into QuestBook from any native mobile app via `/capture`.
- **Duplicate detector**: Real-time fuzzy similarity matching alerts you when you've already asked a similar question.

### 🔬 External Research Launcher & Workspace
- **11 Built-in Research Engines**: Launch deep research with one click into:
  - *AI Engines*: Perplexity AI, Claude, ChatGPT, Google Gemini
  - *Academic*: arXiv, Semantic Scholar
  - *Web & Community*: Google, DuckDuckGo, Reddit, Wikipedia, YouTube, GitHub
- **Custom Search Providers**: Add any internal or specialized engine with standard URL templates (e.g., `https://example.com/search?q={q}`).
- **Batch Exploration**: Use **Search All (Enabled)** or **Choose Platforms** to open multi-tab exploration sessions.
- **Structured Workspace**: Break questions into bite-sized exploration checklists, record timestamped findings, compile source URLs, and log final conclusions.

### 🔐 Zero-Knowledge P2P Multi-Device Sync
- **No central database**: Your questions never touch a proprietary cloud backend.
- **QR Code Key Exchange**: Pair your phone, tablet, and laptop via single-use, 5-minute expiring cryptographic handshake payloads.
- **Audited Cryptographic Primitives** (`@noble/*`):
  - Identity Signatures: `Ed25519`
  - Key Agreement: `X25519` ECDH + `HKDF-SHA256`
  - Authenticated Encryption: `XChaCha20-Poly1305` (24-byte random nonces + domain-separated AAD)
- **Causal Version Vectors**: Concurrent edits across devices resolve deterministically with conflict journals rather than blind last-write-wins overwrites.
- **Dual Transport**: Uses WebRTC DataChannels for direct local P2P transfer with a lightweight WebSocket fallback relay.

### 📦 Encrypted `.qbk` Backups & Recovery
- **Single-file vault archives**: Export complete database snapshots with attachments, categories, tags, and research sessions.
- **Password-protected**: Encrypted using `Argon2id` key derivation (`t=2, m=16384, p=1, dkLen=32`) and authenticated with `XChaCha20-Poly1305` + `SHA-256`.
- **Integrity verification**: Inspect archive contents, verify checksums, and preview question counts before restoring.
- **Flexible import modes**: Choose between **Safe Merge** (preserves existing newer edits) or **Clean Overwrite**.

### 📱 Offline-First Progressive Web App (PWA)
- **Full offline capabilities**: Pre-cached assets and service worker via `vite-plugin-pwa` (Workbox).
- **Responsive design**: Crafted with Tailwind CSS v4, optimized for desktop displays (1440px+) down to compact mobile viewports (390px).
- **Dark & Light Modes**: System-synced or manually toggled themes with high-contrast slate color palettes.
- **App Lock**: Optional biometric/passcode lock screen with auto-lock timeout.

### 🐍 Optional Native Python Companion
- Local background daemon running with FastAPI and Uvicorn.
- Native LAN mDNS discovery (`_questbook._tcp.local.`) without cloud signaling.
- Automated filesystem backup exports directly to your desktop or NAS drive.
- See the [Companion README](companion/README.md) for setup instructions.

---

## 🛠️ Architecture & Tech Stack

```
┌────────────────────────────────────────────────────────┐
│                   QuestBook PWA UI                     │
│  (React 19 + TypeScript + Tailwind CSS v4 + Motion)     │
└──────────────────────────┬─────────────────────────────┘
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌─────────────────┐
│ Core Domain  │   │ Persistence  │   │ Sync Transport  │
│ - crypto.ts  │   │ - Dexie.js   │   │ - WebRTC DataCh │
│ - search.ts  │   │ - IndexedDB  │   │ - WebSocket WS  │
│ - backup.ts  │   │ - Journaling │   │ - QR Handshake  │
│ - urlLaunch  │   │              │   │                 │
└──────────────┘   └──────────────┘   └─────────────────┘
```

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | React 19 + TypeScript | Component model and application routing |
| **Styling & UI** | Tailwind CSS v4 + Lucide Icons + Motion | Responsive layout, fluid animations, dark mode |
| **Client Database** | Dexie.js v4 (IndexedDB) | Reactive local storage with versioned schemas & live queries |
| **Cryptography** | `@noble/curves`, `@noble/ciphers`, `@noble/hashes` | Ed25519, X25519, XChaCha20-Poly1305, Argon2id, SHA-256 |
| **PWA & Offline** | `vite-plugin-pwa` + Workbox | Service Worker caching, manifest, Web Share Target |
| **Signaling Server** | Express + `ws` WebSocket Server | Zero-knowledge NAT traversal & signaling relay |
| **Testing** | Node.js Test Runner (`tsx --test`) | Unit tests for crypto, backup, search, sync, and URLs |

---

## 📂 Project Structure

```text
QuestBook/
├── companion/                 # Optional Python FastAPI desktop companion
│   ├── main.py                # mDNS announcer, LAN relay & disk backup worker
│   └── requirements.txt       # fastapi, uvicorn, zeroconf, cryptography
├── docs/                      # Comprehensive engineering documentation
│   ├── API_DOCUMENTATION.md   # Core functions and WebSocket signaling protocol
│   ├── BACKUP_AND_RECOVERY.md # .qbk file format and encryption specifications
│   ├── DATABASE_SCHEMA.md     # Dexie.js IndexedDB schema and indexing rules
│   ├── DEPLOYMENT_GUIDE.md    # Production deployment and PWA setup
│   ├── DEVELOPMENT_GUIDE.md   # Developer onboarding and coding guidelines
│   ├── KNOWN_LIMITATIONS.md   # Browser boundaries and sandbox constraints
│   ├── PROJECT_ARCHITECTURE.md# Modular layer separation and design principles
│   ├── ROADMAP.md             # Future enhancements and milestone plans
│   ├── SECURITY.md            # Cryptographic primitives and threat model
│   ├── SYNC_PROTOCOL.md       # Causal sync vectors and WebRTC handshake
│   └── TESTING_GUIDE.md       # Unit and end-to-end verification workflows
├── public/                    # Static assets, icons, manifest, redirects
│   ├── _redirects             # Netlify SPA routing rules
│   ├── icon.svg               # Vector brand logo
│   └── pwa-*.png              # Responsive PWA icon suite
├── src/
│   ├── components/            # Reusable UI components
│   │   ├── AppLockScreen.tsx  # PIN/password biometric lock overlay
│   │   ├── ExternalResearchLauncher.tsx # Multi-provider research selector
│   │   ├── LayoutShell.tsx    # App navigation bar, sidebar, and status indicator
│   │   ├── OfflineIndicator.tsx # Network state badge
│   │   ├── PWAInstallButton.tsx # Native install trigger
│   │   ├── QuestionRow.tsx    # Question card item with quick actions
│   │   └── ToastProvider.tsx  # Notification system
│   ├── core/                  # Pure TypeScript domain logic (100% test covered)
│   │   ├── backup.ts          # .qbk encryption, packaging, and unpacking
│   │   ├── crypto.ts          # Ed25519, X25519, XChaCha20-Poly1305, Argon2id
│   │   ├── search.ts          # Fuzzy search, ngram indexing, duplicate detection
│   │   ├── syncEngine.ts      # Version vectors, causal ordering, conflict resolution
│   │   └── urlLauncher.ts     # URL sanitization and research engine builder
│   ├── db/                    # Local storage layer
│   │   ├── database.ts        # Dexie.js schema definition
│   │   └── repository.ts      # Transactional CRUD and change journal
│   ├── hooks/                 # React state hooks
│   │   ├── useOnlineStatus.ts # Browser network state
│   │   ├── usePWAInstall.ts   # beforeinstallprompt interceptor
│   │   └── useQuestBookData.ts# Reactive Dexie live queries
│   ├── pages/                 # Full-screen application views
│   │   ├── BackupRecoveryPage.tsx      # Export, restore, and verify .qbk backups
│   │   ├── CategoriesTagsPages.tsx    # Tag and folder management
│   │   ├── DashboardPage.tsx           # Activity stats and recent inquiries
│   │   ├── DeviceManagerPage.tsx       # Paired devices & QR handshake
│   │   ├── ExplorePage.tsx             # Filter and discover questions
│   │   ├── QuestionsListPage.tsx       # Searchable question inventory
│   │   ├── QuickCapturePage.tsx        # 5-second capture interface
│   │   ├── ResearchWorkspacePage.tsx   # Investigation checklist & findings
│   │   ├── SearchPage.tsx              # Deep query search
│   │   ├── SettingsPage.tsx            # Custom providers, encryption, themes
│   │   └── SynchronizationPage.tsx     # Live sync logs and transport state
│   ├── services/
│   │   └── syncClient.ts      # Browser WebSocket + WebRTC client
│   ├── types/
│   │   └── questbook.ts       # Domain TypeScript type definitions
│   ├── App.tsx                # Client-side router and route definitions
│   └── main.tsx               # React entry point
├── server.ts                  # Express + Vite middleware + WebSocket relay
├── vercel.json                # Vercel deployment and SPA rewrite rules
├── vite.config.ts             # Vite configuration with Tailwind and PWA plugins
└── package.json               # Dependencies and scripts
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v20.x` or `v22.x` recommended
- **npm**: `v10.x+` (or pnpm / yarn)
- **Optional**: Python 3.10+ (for native companion)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/suvancode/QuestBook.git
cd QuestBook
npm install
```

> **Note**: If you encounter peer dependency warnings between esbuild and Vite versions, an `.npmrc` file with `legacy-peer-deps=true` is included in the root directory.

### 2. Run the Development Server
```bash
npm run dev
```
The server will start at `http://localhost:3000`, running Express alongside the zero-knowledge WebSocket signaling relay (`ws://localhost:3000/ws/sync`) and Vite Hot Module Replacement (HMR).

### 3. Run the Test Suite
QuestBook includes an automated unit test suite covering all security, cryptographic, search, and sync routines:
```bash
npm test
```
```text
✔ backup tests (encryption, decryption, verification, corrupted archive rejection)
✔ crypto tests (Ed25519 signing, X25519 ECDH, XChaCha20-Poly1305, Argon2id)
✔ search tests (fuzzy ranking, n-gram scoring, duplicate question detection)
✔ syncEngine tests (version vectors, causal merges, conflict journal recording)
✔ urlLauncher tests (URL template validation, protocol restriction, XSS prevention)
```

### 4. Build for Production
```bash
npm run build
```
Generates an optimized, minified bundle with service worker precache manifests inside `dist/`.

---

## 🚢 Deployment

### Deploying to Vercel
QuestBook is pre-configured for one-click deployment on Vercel:
1. Push your repository to GitHub.
2. Import the project into [Vercel](https://vercel.com).
3. The included [vercel.json](vercel.json) automatically sets the build command to `vite build`, points the output directory to `dist`, and applies SPA history API rewrites.

Or deploy via the Vercel CLI:
```bash
vercel --prod
```

### Deploying to Netlify
A [public/_redirects](public/_redirects) file is provided for client-side routing fallback (`/* /index.html 200`):
1. Connect your repository on [Netlify](https://netlify.com).
2. Set Build Command to `npm run build` and Publish Directory to `dist`.
3. Deploy!

### Self-Hosted / Docker Server (with WebSocket Relay)
To host both the PWA frontend and the WebSocket signaling server together on a single server, run:
```bash
npm run build
NODE_ENV=production PORT=3000 npm start
```

---

## 🔒 Security & Privacy Guarantees

- **No Remote Telemetry**: QuestBook does not send analytics, telemetry, or query text to any third-party analytics services.
- **Client-Side Sandbox**: All search queries, research notes, and personal thoughts reside inside browser IndexedDB storage.
- **URL Sanitization**: Custom search engine templates strictly validate target URLs against dangerous schemes (`javascript:`, `data:`, `vbscript:`, `file:`).
- **Zero-Knowledge Sync**: Signaling servers only route encrypted ciphertext blobs between authenticated peer sessions; they never possess decryption keys.
- **Secure Key Storage**: Cryptographic master keys are derived locally using Argon2id with unique cryptographic salts.

---

## 📖 Comprehensive Documentation

For detailed architectural and implementation specifications, see the `docs/` folder:

| Document | Description |
| :--- | :--- |
| [Architecture Overview](docs/PROJECT_ARCHITECTURE.md) | Layered design, boundary contracts, and component lifecycles |
| [Database Schema](docs/DATABASE_SCHEMA.md) | IndexedDB entity schemas, indexes, and change journals |
| [Sync Protocol](docs/SYNC_PROTOCOL.md) | Cryptographic pairing handshake, version vectors, and causal resolution |
| [Security Architecture](docs/SECURITY.md) | Threat matrix, key lifecycles, and cryptographic specifications |
| [Backup & Recovery](docs/BACKUP_AND_RECOVERY.md) | `.qbk` file layout, Argon2id derivation, and restore workflows |
| [API Documentation](docs/API_DOCUMENTATION.md) | Function signatures, parameters, and WebSocket message schemas |
| [Development Guide](docs/DEVELOPMENT_GUIDE.md) | Environment setup, code style, conventions, and branch management |
| [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) | Production server configuration, PWA installation, and TURN setup |
| [Testing Guide](docs/TESTING_GUIDE.md) | Unit testing, mock strategies, and Playwright verification workflows |
| [Known Limitations](docs/KNOWN_LIMITATIONS.md) | Browser sandbox boundaries, storage quotas, and platform caveats |
| [Project Roadmap](docs/ROADMAP.md) | Upcoming milestones, native wrappers, and feature timeline |

---

## 📄 License

This project is licensed under the [Apache-2.0 License](LICENSE).
