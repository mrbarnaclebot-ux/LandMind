/**
 * Zustand store for agent state management
 */
import { create } from 'zustand';
import type { Agent } from '../lib/agents';

interface AgentStore {
  // State
  agents: Agent[];
  isLoading: boolean;
  error: string | null;
  selectedAgentId: string | null;

  // Actions
  setAgents: (agents: Agent[]) => void;
  addAgent: (agent: Agent) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  selectAgent: (id: string | null) => void;

  // Derived
  getAgent: (id: string) => Agent | undefined;
  getAgentCount: () => number;
  getTotalMined: () => { gold: bigint; silver: bigint; copper: bigint; iron: bigint };
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  // Initial state
  agents: [],
  isLoading: false,
  error: null,
  selectedAgentId: null,

  // Actions
  setAgents: (agents) => set({ agents, isLoading: false }),

  addAgent: (agent) => set((state) => ({
    agents: [agent, ...state.agents],
  })),

  updateAgent: (id, updates) => set((state) => ({
    agents: state.agents.map((a) =>
      a.id === id ? { ...a, ...updates } : a
    ),
  })),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  selectAgent: (selectedAgentId) => set({ selectedAgentId }),

  // Derived getters
  getAgent: (id) => get().agents.find((a) => a.id === id),

  getAgentCount: () => get().agents.length,

  getTotalMined: () => {
    const { agents } = get();
    return agents.reduce(
      (acc, agent) => {
        if (agent.miningState) {
          acc.gold += BigInt(agent.miningState.gold || '0');
          acc.silver += BigInt(agent.miningState.silver || '0');
          acc.copper += BigInt(agent.miningState.copper || '0');
          acc.iron += BigInt(agent.miningState.iron || '0');
        }
        return acc;
      },
      { gold: 0n, silver: 0n, copper: 0n, iron: 0n }
    );
  },
}));
