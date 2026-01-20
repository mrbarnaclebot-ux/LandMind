---
phase: 03-real-time-simulation
plan: 01
subsystem: server
tags: [websocket, socket.io, redis, real-time]

dependency-graph:
  requires: [01-03]  # Redis pub/sub clients from Phase 1
  provides: [socket-server, event-types, user-rooms]
  affects: [03-02, 03-03, 03-04]  # Simulation engine, event broadcasting

tech-stack:
  added:
    - socket.io@4.8.3
    - "@socket.io/redis-adapter@8.3.0"
  patterns:
    - typed-socket-events
    - redis-adapter-scaling
    - user-room-isolation

key-files:
  created:
    - packages/server/src/events/types.ts
    - packages/server/src/lib/socket.ts
  modified:
    - packages/server/package.json
    - packages/server/src/index.ts

decisions:
  - id: socket-io-typed
    choice: "Fully typed Socket.io server with generic interfaces"
    rationale: "TypeScript safety for all socket events"
  - id: redis-adapter
    choice: "Redis adapter for pub/sub scaling"
    rationale: "Enables multi-instance deployment without sticky sessions"
  - id: user-rooms
    choice: "User-specific rooms via user:{walletPubkey}"
    rationale: "Isolate updates per wallet for security and efficiency"

metrics:
  duration: "~8 min"
  completed: "2026-01-20"
---

# Phase 3 Plan 1: Socket.io WebSocket Server Summary

**One-liner:** Socket.io server with Redis adapter enabling typed real-time events to user-specific rooms

## What Was Built

### Event Type System (`packages/server/src/events/types.ts`)

Typed interfaces for all socket communication:

- **ServerToClientEvents**: `mining:update`, `hex:depleted`, `agent:relocating`, `agent:arrived`
- **ClientToServerEvents**: `subscribe` (wallet pubkey registration)
- **InterServerEvents**: For Redis adapter inter-process communication
- **SocketData**: Per-connection wallet association

Resources use string serialization for BigInt JSON compatibility.

### Socket Server Module (`packages/server/src/lib/socket.ts`)

- `setupSocket(httpServer)`: Initializes typed Socket.io server with Redis adapter
- `getIO()`: Returns server instance for event emission from other modules
- Automatic room joining on `subscribe` event: `user:{walletPubkey}`
- Connection/disconnection logging

### Server Integration (`packages/server/src/index.ts`)

- HTTP server wraps Express app (required for Socket.io)
- Socket.io initialized before middleware
- Uses `httpServer.listen()` instead of `app.listen()`
- Exports `io` instance for external access

## Task Completion

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install dependencies and event types | bc5e207 | package.json, events/types.ts |
| 2 | Create Socket.io server module | ef5caaa | lib/socket.ts |
| 3 | Refactor index.ts for HTTP server | 302a175 | index.ts |

## Verification Results

- [x] socket.io@4.8.3 installed
- [x] @socket.io/redis-adapter@8.3.0 installed
- [x] Event types compile without errors
- [x] Server starts successfully
- [x] Health endpoint returns 200 OK
- [x] WebSocket server accepts connections on port 3001

## Deviations from Plan

None - plan executed exactly as written.

## Key Code Patterns

### Typed Socket Server
```typescript
export type TypedServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
```

### Room-Based Updates
```typescript
// Client joins their room
socket.on('subscribe', (walletPubkey, callback) => {
  socket.join(`user:${walletPubkey}`);
  callback(true);
});

// Server emits to specific user
io.to(`user:${walletPubkey}`).emit('mining:update', { agents });
```

## Next Phase Readiness

**Ready for 03-02 (Simulation Engine):**
- Socket server operational
- Event types defined for all mining updates
- `getIO()` available for tick processor to emit events
- User rooms ready for targeted broadcasting

**Dependencies satisfied:**
- Redis pub/sub clients from Phase 1 working
- HTTP server ready for WebSocket connections
