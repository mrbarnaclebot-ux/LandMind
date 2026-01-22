import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface PlatformMetrics {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  totalAgents: number;
  miningAgents: number;
  idleAgents: number;
  treasuryBalance: number;
  totalClaimed: number;
  totalDeposits: number;
  redisLatency: number;
  dbLatency: number;
  rpcLatency: number;
  resourcesPerMinute: number;
  connectionsCount: number;
  timestamp: number;
}

interface AdminServerToClientEvents {
  'admin:metrics': (data: PlatformMetrics) => void;
}

interface AdminClientToServerEvents {
  'admin:subscribe': () => void;
  'admin:unsubscribe': () => void;
}

let adminSocket: Socket<AdminServerToClientEvents, AdminClientToServerEvents> | null = null;

function getAdminSocket(): Socket<AdminServerToClientEvents, AdminClientToServerEvents> {
  if (!adminSocket) {
    adminSocket = io(API_BASE_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
  }
  return adminSocket;
}

export function useAdminSocket() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = getAdminSocket();

    // Subscribe to admin metrics
    socket.emit('admin:subscribe');

    socket.on('admin:metrics', (data: PlatformMetrics) => {
      setMetrics(data);
    });

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    // Set initial connection state
    setIsConnected(socket.connected);

    return () => {
      socket.off('admin:metrics');
      socket.off('connect');
      socket.off('disconnect');
      socket.emit('admin:unsubscribe');
    };
  }, []);

  return { metrics, isConnected };
}
