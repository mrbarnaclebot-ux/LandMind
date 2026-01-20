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

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): TypedServer {
  if (!io) {
    throw new Error('Socket.io not initialized. Call setupSocket first.');
  }
  return io;
}
