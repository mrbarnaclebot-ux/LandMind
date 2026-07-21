/**
 * Hook to fetch user's agents and subscribe to real-time updates
 */
import { useEffect, useCallback } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { useAgentStore } from '../stores/agentStore';
import { useRelocationStore } from '../stores/relocationStore';
import { fetchUserAgents } from '../lib/agents';
import { getSocket } from '../lib/socket';

export function useUserAgents() {
  const { isAuthenticated, walletAddress } = useWalletStore();
  const { setAgents, updateAgent, addAgent, setLoading, setError, agents } = useAgentStore();

  // Fetch initial agents
  const loadAgents = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }

    setLoading(true);
    try {
      const userAgents = await fetchUserAgents();
      setAgents(userAgents);
      // Seed relocation cooldown anchors so the MOVE button countdown is correct
      // straight after a load (without waiting for a socket event).
      const { seedCooldownAnchor } = useRelocationStore.getState();
      for (const a of userAgents) {
        if (a.lastRelocatedAt != null) seedCooldownAnchor(a.id, a.lastRelocatedAt);
      }
    } catch (err) {
      console.error('[useUserAgents] Error fetching agents:', err);
      setError(err instanceof Error ? err.message : 'Failed to load agents');
    }
  }, [isAuthenticated, setAgents, setLoading, setError]);

  // Load on auth change
  useEffect(() => {
    if (isAuthenticated) {
      loadAgents();
    }
  }, [isAuthenticated, loadAgents]);

  // Subscribe to socket events
  useEffect(() => {
    if (!isAuthenticated || !walletAddress) return;

    const sock = getSocket();

    // Subscribe to the user's room. Factored out so we can (re)run it on every
    // socket 'connect' — after a login-triggered reconnect the handshake carries
    // the fresh cookie, so this is the point at which the server will actually
    // let us join our room.
    const subscribe = () => {
      sock.emit('subscribe', walletAddress, (ack) => {
        // Backwards/forwards compatible: old server sent a boolean, new server
        // sends { ok, reason }.
        const ok = typeof ack === 'boolean' ? ack : ack?.ok;
        if (!ok) {
          const reason =
            ack && typeof ack === 'object' && 'reason' in ack ? ack.reason : undefined;
          console.error('Failed to subscribe to updates', reason ?? '');
        } else {
          // Refetch on (re)subscribe to reconcile any updates missed while the
          // socket was disconnected / unauthenticated.
          loadAgents();
        }
      });
    };

    // Subscribe immediately if already connected, and again on every reconnect.
    if (sock.connected) subscribe();
    sock.on('connect', subscribe);

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

    // Handle player-initiated relocation landing (System 2). Mirrors placed but
    // also refreshes the cooldown anchor for the MOVE-button countdown.
    sock.on('agent:relocated', (data) => {
      updateAgent(data.agentId, {
        hexId: data.hexId,
        status: 'MINING',
        hex: {
          q: data.hexQ,
          r: data.hexR,
          resourceType: 'GOLD', // Will be updated from server
        },
        lastRelocatedAt: data.lastRelocatedAt,
      });
      if (data.lastRelocatedAt != null) {
        useRelocationStore.getState().setCooldownAnchor(data.agentId, data.lastRelocatedAt);
      }
    });

    return () => {
      sock.off('connect', subscribe);
      sock.off('mining:update');
      sock.off('agent:relocating');
      sock.off('agent:arrived');
      sock.off('agent:deployed');
      sock.off('agent:placed');
      sock.off('agent:relocated');
    };
  }, [isAuthenticated, walletAddress, updateAgent, addAgent, loadAgents]);

  return {
    agents,
    reload: loadAgents,
  };
}
