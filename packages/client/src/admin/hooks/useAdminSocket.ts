import { useEffect, useState } from 'react';
import { getSocket } from '../../lib/socket';
import type { PlatformMetrics } from '../../lib/socketTypes';

export type { PlatformMetrics } from '../../lib/socketTypes';

export function useAdminSocket() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();

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
