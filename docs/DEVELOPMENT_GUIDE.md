# Development Guide

## Prerequisites

- Node.js 20+
- Optional: Python 3.10+ (only for `companion/main.py`)

## Setup & Scripts

```bash
npm install
npm run dev       # Express + WebSocket relay + Vite dev middleware on port 3000
npm test          # Runs node:test unit tests via tsx
npm run lint      # Runs tsc --noEmit
npm run build     # Builds production bundle into dist/
```

## Module Guidelines

- Keep all pure business logic (crypto, search, sync merging, URL validation, `.qbk` encoding) inside `src/core/` with zero DOM dependencies so it can be unit-tested with `node:test`.
- Keep all IndexedDB reads/writes transactional inside `src/db/repository.ts`.
