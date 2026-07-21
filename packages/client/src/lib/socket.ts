/**
 * Single shared Socket.io client instance.
 *
 * The server authenticates the socket via the JWT httpOnly cookie on the
 * handshake, so the client must connect with `withCredentials: true`. All
 * hooks share one connection instead of opening their own.
 */
import { io, Socket } from 'socket.io-client';
import { API_URL } from './config';
import type { ServerToClientEvents, ClientToServerEvents } from './socketTypes';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

/**
 * Return the shared, lazily-created socket connection.
 */
export function getSocket(): AppSocket {
  if (!socket) {
    socket = io(API_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}
