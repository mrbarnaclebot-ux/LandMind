import { Server, type Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Server as HttpServer } from 'http';
import { redisPub, redisSub } from './redis.js';
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

export function setupSocket(httpServer: HttpServer): TypedServer {
  io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST']
    },
    // Use Redis adapter for multi-instance scaling
    adapter: createAdapter(redisPub, redisSub)
  });

  io.on('connection', (socket: TypedSocket) => {
    console.log(`Client connected: ${socket.id}`);

    // Client subscribes to receive their user-specific updates
    socket.on('subscribe', (walletPubkey: string, callback) => {
      socket.data.walletPubkey = walletPubkey;
      socket.join(`user:${walletPubkey}`);
      console.log(`Socket ${socket.id} subscribed to user:${walletPubkey}`);
      callback(true);
    });

    // Admin subscribes to metrics updates
    // Note: Admin role verification happens server-side via API
    socket.on('admin:subscribe' as keyof ClientToServerEvents, () => {
      adminSockets.add(socket.id);
      console.log(`Socket ${socket.id} subscribed to admin metrics`);
    });

    socket.on('admin:unsubscribe' as keyof ClientToServerEvents, () => {
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
