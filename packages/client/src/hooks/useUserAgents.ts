/**
 * Hook to fetch user's agents and subscribe to real-time updates
 */
import { useEffect, useCallback } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { useAgentStore } from '../stores/agentStore';
import { fetchUserAgents } from '../lib/agents';
import { io, Socket } from 'socket.io-client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Socket event types (matching server types)
interface AgentUpdate {
  id: string;
  hexId: number;
  hexQ: number;
  hexR: number;
  resources: {
    gold: string;
    silver: string;
    copper: string;
    iron: string;
  };
  status: 'MINING' | 'RELOCATING' | 'IDLE';
}

interface ServerToClientEvents {
  'mining:update': (data: { agents: AgentUpdate[] }) => void;
  'agent:relocating': (data: {
    agentId: string;
    fromHexId: number;
    toHexId: number;
    arrivalTick: number;
  }) => void;
  'agent:arrived': (data: { agentId: string; hexId: number; hexQ: number; hexR: number }) => void;
  'agent:deployed': (data: { agent: AgentUpdate }) => void;
  'agent:placed': (data: { agentId: string; hexId: number; hexQ: number; hexR: number }) => void;
}

interface ClientToServerEvents {
  'subscribe': (walletPubkey: string, callback: (ok: boolean) => void) => void;
}

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (!socket) {
    socket = io(API_BASE_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function useUserAgents() {
  const { isAuthenticated, walletAddress } = useWalletStore();
  const { setAgents, updateAgent, addAgent, setLoading, setError, agents } = useAgentStore();

  console.log('[useUserAgents] Hook called, isAuthenticated:', isAuthenticated, 'walletAddress:', walletAddress);

  // Fetch initial agents
  const loadAgents = useCallback(async () => {
    console.log('[useUserAgents] loadAgents called, isAuthenticated:', isAuthenticated);
    if (!isAuthenticated) {
      console.log('[useUserAgents] Not authenticated, skipping fetch');
      return;
    }

    setLoading(true);
    try {
      console.log('[useUserAgents] Fetching agents...');
      const userAgents = await fetchUserAgents();
      console.log('[useUserAgents] Received agents:', userAgents);
      setAgents(userAgents);
      console.log('[useUserAgents] Agents set in store');
    } catch (err) {
      console.error('[useUserAgents] Error fetching agents:', err);
      setError(err instanceof Error ? err.message : 'Failed to load agents');
    }
  }, [isAuthenticated, setAgents, setLoading, setError]);

  // Load on auth change
  useEffect(() => {
    console.log('[useUserAgents] useEffect triggered, isAuthenticated:', isAuthenticated);
    if (isAuthenticated) {
      loadAgents();
    }
  }, [isAuthenticated, loadAgents]);

  // Subscribe to socket events
  useEffect(() => {
    if (!isAuthenticated || !walletAddress) return;

    const sock = getSocket();

    // Subscribe to user's room
    sock.emit('subscribe', walletAddress, (ok: boolean) => {
      if (!ok) {
        console.error('Failed to subscribe to updates');
      }
    });

    // Handle mining updates
    sock.on('mining:update', (data) => {
      for (const agentUpdate of data.agents) {
        updateAgent(agentUpdate.id, {
          hexId: agentUpdate.hexId,
          status: agentUpdate.status,
          miningState: agentUpdate.resources,
          hex: {
            q: agentUpdate.hexQ,
            r: agentUpdate.hexR,
            resourceType: 'GOLD', // Will be updated from server
          },
        });
      }
    });

    // Handle agent relocation
    sock.on('agent:relocating', (data) => {
      updateAgent(data.agentId, {
        status: 'RELOCATING',
      });
    });

    sock.on('agent:arrived', (data) => {
      updateAgent(data.agentId, {
        hexId: data.hexId,
        status: 'MINING',
        hex: {
          q: data.hexQ,
          r: data.hexR,
          resourceType: 'GOLD', // Will be updated from server
        },
      });
    });

    // Handle new agent deployed
    sock.on('agent:deployed', (data) => {
      addAgent({
        id: data.agent.id,
        hexId: data.agent.hexId,
        status: data.agent.status,
        deployedAt: new Date().toISOString(),
        agentIndex: null,
        mintAddress: null,
        miningState: data.agent.resources,
        hex: {
          q: data.agent.hexQ,
          r: data.agent.hexR,
          resourceType: 'GOLD', // Will be updated from server
        },
      });
    });

    // Handle agent placed on hex
    sock.on('agent:placed', (data) => {
      updateAgent(data.agentId, {
        hexId: data.hexId,
        status: 'MINING',
        hex: {
          q: data.hexQ,
          r: data.hexR,
          resourceType: 'GOLD', // Will be updated from server
        },
      });
    });

    return () => {
      sock.off('mining:update');
      sock.off('agent:relocating');
      sock.off('agent:arrived');
      sock.off('agent:deployed');
      sock.off('agent:placed');
    };
  }, [isAuthenticated, walletAddress, updateAgent, addAgent]);

  return {
    agents,
    reload: loadAgents,
  };
}
