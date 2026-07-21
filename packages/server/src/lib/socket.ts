import { Server, type Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Server as HttpServer } from 'http';
import { jwtVerify } from 'jose';
import { redisPub, redisSub } from './redis.js';
import { JWT_SECRET, SESSION_COOKIE_NAME } from './jwtSecret.js';
import { isUserAdmin } from '../middleware/adminAuth.js';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData
} from '../events/types.js';
import { gatherMetrics } from '../services/metricsService.js';

// Typed Socket.io server instance
export type TypedServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

let io: TypedServer;

// Track admin sockets for metrics broadcasting
const adminSockets = new Set<string>();
let metricsInterval: NodeJS.Timeout | null = null;

/**
 * Parse a raw Cookie header into a name->value map.
 * Minimal parser (avoids adding the `cookie` dependency).
 */
function parseCookieHeader(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

/**
 * Build the allowed CORS origins from CORS_ORIGIN (comma-separated).
 * Never use '*' with credentials — falls back to localhost dev origin.
 */
function getAllowedOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN;
  if (!raw) return ['http://localhost:5173'];
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export function setupSocket(httpServer: HttpServer): TypedServer {
  const allowedOrigins = getAllowedOrigins();

  io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      // Explicit origin list — required because we allow credentials.
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true
    },
    // Use Redis adapter for multi-instance scaling
    adapter: createAdapter(redisPub, redisSub)
  });

  // Handshake auth middleware.
  // Parses the session JWT from the handshake cookie header (same cookie
  // name/secret as authMiddleware) and attaches identity to socket.data.
  // Unauthenticated sockets are still ALLOWED (for public broadcast events) —
  // they just never get identity, rooms, or admin.
  io.use(async (socket, next) => {
    try {
      const cookies = parseCookieHeader(socket.handshake.headers.cookie);
      const token =
        cookies[SESSION_COOKIE_NAME] ||
        // Also accept an auth token passed via handshake auth for non-cookie clients
        (socket.handshake.auth?.token as string | undefined);

      if (token) {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        const wallet = payload.sub as string | undefined;
        const userId = payload.userId as string | undefined;
        socket.data.walletPubkey = wallet;
        socket.data.userId = userId;
        socket.data.isAdmin = await isUserAdmin(userId);
      }
    } catch {
      // Invalid/expired token — leave socket unauthenticated (public events only)
      socket.data.walletPubkey = undefined;
      socket.data.userId = undefined;
      socket.data.isAdmin = false;
    }
    next();
  });

  io.on('connection', (socket: TypedSocket) => {
    console.log(
      `Client connected: ${socket.id}` +
        (socket.data.walletPubkey ? ` (wallet ${socket.data.walletPubkey})` : ' (anonymous)')
    );

    // Client subscribes to receive their user-specific updates.
    // We IGNORE any client-supplied wallet and join only the authenticated
    // wallet's room. Unauthenticated sockets cannot join user rooms.
    socket.on('subscribe', (_walletPubkey, callback) => {
      const wallet = socket.data.walletPubkey;
      if (!wallet) {
        console.warn(`Socket ${socket.id} attempted subscribe without auth`);
        if (typeof callback === 'function') callback(false);
        return;
      }
      // If the client supplied a wallet, it must match the authenticated one.
      if (_walletPubkey && _walletPubkey !== wallet) {
        console.warn(
          `Socket ${socket.id} subscribe wallet mismatch ` +
            `(claimed ${_walletPubkey}, authed ${wallet})`
        );
        if (typeof callback === 'function') callback(false);
        return;
      }
      socket.join(`user:${wallet}`);
      console.log(`Socket ${socket.id} subscribed to user:${wallet}`);
      if (typeof callback === 'function') callback(true);
    });

    // Admin subscribes to metrics updates. Requires the same admin check as
    // the HTTP adminAuth middleware (DB role === ADMIN), evaluated at handshake.
    socket.on('admin:subscribe', () => {
      if (!socket.data.isAdmin) {
        console.warn(`Socket ${socket.id} denied admin:subscribe (not admin)`);
        return;
      }
      adminSockets.add(socket.id);
      console.log(`Socket ${socket.id} subscribed to admin metrics`);
    });

    socket.on('admin:unsubscribe', () => {
      adminSockets.delete(socket.id);
      console.log(`Socket ${socket.id} unsubscribed from admin metrics`);
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      adminSockets.delete(socket.id);
    });
  });

  // Start admin metrics broadcast (every 2 seconds)
  if (!metricsInterval) {
    metricsInterval = setInterval(async () => {
      if (adminSockets.size > 0) {
        try {
          const metrics = await gatherMetrics();
          for (const socketId of adminSockets) {
            io.to(socketId).emit('admin:metrics' as keyof ServerToClientEvents, metrics as never);
          }
        } catch (error) {
          console.error('Failed to broadcast admin metrics:', error);
        }
      }
    }, 2000);
  }

  return io;
}

export function getIO(): TypedServer {
  if (!io) {
    throw new Error('Socket.io not initialized. Call setupSocket first.');
  }
  return io;
}
