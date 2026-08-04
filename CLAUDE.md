# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VuSync is a self-hosted YouTube synchronizer. Users create/join rooms and watch YouTube videos in sync with real-time playback state and chat over Socket.IO.

## Commands

All commands run from the repo root unless noted.

### Development
```bash
npm run dev            # Start both server and client concurrently
npm run dev:server     # Server only (tsx watch, hot-reload)
npm run dev:client     # Client only (Vite HMR)
```

### Build
```bash
npm run build          # Build all workspaces in order: shared → server → client
```

### Lint (client only)
```bash
npm run lint --workspace=client
```

### Run built server
```bash
npm run start --workspace=server   # node dist/index.js
```

## Architecture

This is an **npm workspaces monorepo** with three packages:

```
shared/   – @vusync/shared  – Shared TypeScript types and Socket.IO event constants
server/   – @vusync/server  – Express + Socket.IO backend (Node.js, CommonJS)
client/   – (client)        – React 19 + Vite frontend (ESM)
```

### Shared package (`shared/`)

- **`types.ts`** — Core domain types: `User`, `Room`, `PlayerState`, `SyncEvent`, `ChatMessage`
- **`constants.ts`** — `EVENTS` object (single source of truth for all Socket.IO event names) and `DEFAULT_PORT` (3001)

The server imports shared via relative path (`../../shared/constants`), not the package name. The shared package must be built before the server when doing production builds.

### Server (`server/src/`)

- **`index.ts`** — Express app, HTTP server, Socket.IO server setup. CORS is configured to allow `http://localhost:5173` (Vite dev port). Exposes `GET /api/health`.
- **`socket/handlers.ts`** — *(not yet created)* Socket.IO event handler setup, called as `setupSocketHandlers(io)`.
- **`routes/`** — *(not yet created)* Express route handlers.

Server runs on port 3001 (`DEFAULT_PORT`).

### Client (`client/src/`)

- **`main.tsx`** — React entry point, mounts `<App />` in StrictMode.
- **`App.tsx`** — Root component. Currently a placeholder; the actual sync UI is not yet built.

Client dev server runs on port 5173 (Vite default). Socket.IO client (`socket.io-client`) is installed and ready to use.

## Key Conventions

- All Socket.IO event names must come from `EVENTS` in `shared/constants.ts` — never hardcode event strings.
- Server is **CommonJS** (`"type": "commonjs"`); client is **ESM** (`"type": "module"`). Keep this in mind when writing import/export syntax.
- TypeScript strict mode is enabled on both server and client. Client also enforces `noUnusedLocals`, `noUnusedParameters`, and `erasableSyntaxOnly`.