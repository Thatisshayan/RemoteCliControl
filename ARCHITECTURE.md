# Architecture

RemoteCliControl is a full-stack mobile application for SSH control with a monorepo structure.

## Monorepo Layout

```
/
├── artifacts/
│   ├── api-server/         ← Express 5 backend (SSH relay)
│   │   ├── src/
│   │   │   ├── index.ts      ← Entry point (requires PORT env)
│   │   │   ├── app.ts        ← Express setup with middleware
│   │   │   ├── lib/
│   │   │   │   ├── sshManager.ts   ← SSH session management, exec, SFTP
│   │   │   │   ├── wsHandler.ts    ← WebSocket terminal relay
│   │   │   │   ├── store.ts        ← JSON file-backed persistence
│   │   │   │   └── logger.ts       ← Pino structured logging
│   │   │   └── routes/     ← REST endpoints
│   │   │       ├── index.ts
│   │   │       ├── health.ts
│   │   │       ├── connection.ts
│   │   │       ├── connections.ts
│   │   │       ├── sessions.ts
│   │   │       ├── files.ts
│   │   │       ├── processes.ts
│   │   │       └── commands.ts
│   │   └── build.mjs        ← esbuild configuration
│   └── mobile/              ← Expo React Native frontend
│       ├── app/
│       │   ├── (tabs)/      ← Tab navigation screens
│       │   ├── session/     ← Terminal screen
│       │   └── connection.tsx
│       └── components/      ← Shared UI components
├── lib/
│   ├── api-spec/            ← OpenAPI specification
│   ├── api-zod/             ← Generated Zod schemas
│   └── api-client-react/    ← React Query hooks
├── .github/workflows/       ← GitHub Actions CI
├── docs/                    ← Documentation
└── docker-compose.yml       ← Container orchestration
```

## Key Modules

### Backend (`artifacts/api-server`)

| Module | Purpose |
|--------|---------|
| `sshManager.ts` | SSH session lifecycle, persistent connection pooling for exec/SFTP |
| `wsHandler.ts` | WebSocket upgrade handler, output buffering, ping/pong |
| `store.ts` | JSON file-backed CRUD for connections and commands |
| `auth.ts` | Bearer token validation middleware |
| `logger.ts` | Pino logger with HTTP request logging |

### Mobile (`artifacts/mobile`)

| Screen | Purpose |
|--------|---------|
| Terminal | SSH terminal with ANSI rendering, resize, command history |
| Files | Remote file browser with upload/download/mkdir/delete/rename |
| Processes | Remote process list with kill functionality |
| Commands | Saved command library with quick-send |

## Security Model

- API_TOKEN optional auth: When set, all `/api/*` routes require `Authorization: Bearer <token>`
- Rate limiting: General (100/15min), Connection test (10/15min)
- Path sanitization: `..` traversal blocked in all file operations
- PID validation: Regex `/^\d+$/` enforced on `/processes/:pid`

## WebSocket Protocol

```
Client → Server: {type: "resize", rows: 30, cols: 120}
Client → Server: "raw shell input string"
Server → Client: "shell output data stream"
```

Connection URL: `ws://<host>/api/ws/terminal/:sessionId?token=<API_TOKEN>`