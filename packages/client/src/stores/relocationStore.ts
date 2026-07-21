/**
 * relocationStore — coordinates the player-initiated MOVE flow (System 2).
 *
 * The MOVE button lives in the DOM (AgentCard) but the target hex is picked in
 * the 3D world (a click on the ground plane, reusing the existing hover/pick
 * path). This tiny store is the bridge between the two: AgentCard enters
 * relocation mode for a specific agent; the scene's hex-pick handler reads
 * `activeAgentId` and, when set, submits the relocation instead of doing
 * nothing.
 *
 * It also caches per-agent cooldown anchors (`lastRelocatedAt`) so the MOVE
 * button can show a live mm:ss countdown even before the next agents refetch —
 * seeded from the agent record, updated from the relocate response / 429
 * retryAfterMs / the `agent:relocated` socket event.
 */
import { create } from 'zustand';

/** Per-agent relocation cooldown window (must match the server: 10 minutes). */
export const RELOCATE_COOLDOWN_MS = 10 * 60 * 1000;

interface RelocationState {
  /** The agent currently awaiting a target-hex pick, or null (not in MOVE mode). */
  activeAgentId: string | null;
  /** Human label of the active agent (e.g. "#3") for the banner. */
  activeAgentLabel: string | null;
  /** True while a relocate request is in flight (blocks double-submits). */
  submitting: boolean;
  /**
   * Cooldown anchors keyed by agent id: epoch ms at which the agent last
   * relocated. `cooldownReadyAt` is derived (anchor + RELOCATE_COOLDOWN_MS).
   */
  cooldownAnchors: Record<string, number>;

  /** Enter MOVE mode for an agent (or toggle it off if already active). */
  beginRelocation: (agentId: string, label: string) => void;
  /** Leave MOVE mode (ESC, cancel, or after a successful/failed submit). */
  cancelRelocation: () => void;
  setSubmitting: (v: boolean) => void;

  /** Record a cooldown anchor for an agent (epoch ms it last relocated). */
  setCooldownAnchor: (agentId: string, at: number) => void;
  /** Seed a cooldown anchor only if we don't already have a fresher one. */
  seedCooldownAnchor: (agentId: string, at: number | null | undefined) => void;
  /** Epoch ms at which the agent's cooldown clears, or 0 if none/expired-known. */
  cooldownReadyAt: (agentId: string) => number;
}

export const useRelocationStore = create<RelocationState>((set, get) => ({
  activeAgentId: null,
  activeAgentLabel: null,
  submitting: false,
  cooldownAnchors: {},

  beginRelocation: (agentId, label) => {
    const { activeAgentId } = get();
    // Clicking MOVE again on the same agent cancels (toggle).
    if (activeAgentId === agentId) {
      set({ activeAgentId: null, activeAgentLabel: null });
      return;
    }
    set({ activeAgentId: agentId, activeAgentLabel: label });
  },

  cancelRelocation: () => set({ activeAgentId: null, activeAgentLabel: null, submitting: false }),

  setSubmitting: (submitting) => set({ submitting }),

  setCooldownAnchor: (agentId, at) =>
    set((s) => ({ cooldownAnchors: { ...s.cooldownAnchors, [agentId]: at } })),

  seedCooldownAnchor: (agentId, at) => {
    if (at == null) return;
    set((s) => {
      const existing = s.cooldownAnchors[agentId];
      if (existing != null && existing >= at) return s;
      return { cooldownAnchors: { ...s.cooldownAnchors, [agentId]: at } };
    });
  },

  cooldownReadyAt: (agentId) => {
    const anchor = get().cooldownAnchors[agentId];
    if (anchor == null) return 0;
    return anchor + RELOCATE_COOLDOWN_MS;
  },
}));
