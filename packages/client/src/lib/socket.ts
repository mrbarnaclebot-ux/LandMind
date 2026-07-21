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

/**
 * Force the shared socket to reconnect so the handshake carries the CURRENT
 * session cookie.
 *
 * Why this is required: the socket is opened anonymously on app mount (landing
 * page, before login). The server authenticates the socket ONLY from the
 * handshake cookie — and cookies travel only on the (re)connect handshake, not
 * on later events. So after a login/logout the identity attached to the live
 * connection is stale. Disconnecting and reconnecting triggers a fresh
 * handshake, which re-parses the (now present / now absent) session cookie and
 * repopulates `socket.data` server-side.
 *
 * The data hooks (useEarnings / useUserAgents) listen for the socket 'connect'
 * event and (re)emit `subscribe` once the new connection is established, so
 * room membership is restored automatically after the reconnect.
 */
export function reconnectSocket(): void {
  const sock = getSocket();
  // `disconnect()` then `connect()` guarantees a new handshake even if the
  // socket is currently connected. socket.io-client is idempotent about
  // connect() while already connecting.
  sock.disconnect();
  sock.connect();
}
