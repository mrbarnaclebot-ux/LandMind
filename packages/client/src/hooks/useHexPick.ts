/**
 * useHexPick — the relocation hex-pick handler wired into the scene's ground
 * plane click (System 2).
 *
 * Normally a ground click does nothing. When the relocation store is in MOVE
 * mode (`activeAgentId` set), a click on the world resolves the clicked hex
 * (reusing the same pixel→hex path as HexTooltip's hover) and submits the
 * relocation to POST /api/agents/:id/relocate:
 *
 *   - optimistic: mark the agent RELOCATING immediately (juice-free store update)
 *   - success  → toast + set the cooldown anchor; the agent:relocated /
 *                agent:placed socket event (or a refetch) reconciles the final
 *                position; leave MOVE mode.
 *   - error    → toast with the server reason (400/403/429 cooldown), stay/leave
 *                MOVE mode as appropriate.
 *
 * Returned handler is stable-ish (depends only on store setters) and passed to
 * PointerCaptureGround.onClick.
 */
import { useCallback } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { pixelToHex } from '../hex/hexMath';
import { useRelocationStore } from '../stores/relocationStore';
import { useAgentStore } from '../stores/agentStore';
import { useHexStore } from '../stores/hexStore';
import { useTransactionStore } from '../stores/transactionStore';
import { relocateAgent, RelocateError } from '../lib/agents';

export function useHexPick(): (event: ThreeEvent<MouseEvent>) => void {
  return useCallback((event: ThreeEvent<MouseEvent>) => {
    const store = useRelocationStore.getState();
    const agentId = store.activeAgentId;
    if (!agentId || store.submitting) return;

    // Resolve the clicked hex (same conversion as the hover tooltip).
    const point = event.point;
    const { q, r } = pixelToHex(point.x, point.z);

    // Bounds guard: the ground plane extends past the radius-N hex world, so a
    // click can resolve to a non-existent hex. hexStore is authoritative — a
    // relocation there would be a guaranteed server 400, so don't even send it.
    // Show a subtle OUT OF BOUNDS note and stay in MOVE mode for a retry.
    if (!useHexStore.getState().hasHex(q, r)) {
      useTransactionStore.getState().addToast({
        type: 'info',
        title: 'OUT OF BOUNDS',
        message: 'Pick a hex inside the map',
      });
      return;
    }

    void submitRelocation(agentId, q, r);
  }, []);
}

async function submitRelocation(agentId: string, q: number, r: number): Promise<void> {
  const reloc = useRelocationStore.getState();
  const agents = useAgentStore.getState();
  const toasts = useTransactionStore.getState();

  const label = reloc.activeAgentLabel ?? '';
  reloc.setSubmitting(true);

  // Optimistic: reflect the move intent right away.
  agents.updateAgent(agentId, { status: 'RELOCATING' });

  try {
    const { agent } = await relocateAgent(agentId, q, r);

    // Reconcile from the server response (socket agent:relocated may also fire).
    agents.updateAgent(agentId, {
      status: agent.status,
      hexId: agent.hexId,
      hex: agent.hex,
      lastRelocatedAt: agent.lastRelocatedAt,
    });
    if (agent.lastRelocatedAt != null) {
      reloc.setCooldownAnchor(agentId, agent.lastRelocatedAt);
    } else {
      reloc.setCooldownAnchor(agentId, Date.now());
    }

    toasts.addToast({
      type: 'success',
      title: 'AGENT MOVED',
      message: `Agent ${label} relocated to (${q}, ${r})`,
      // Inherits central success default (6500ms).
    });
    reloc.cancelRelocation();
  } catch (err) {
    // Roll the optimistic status back to MINING (best-effort).
    agents.updateAgent(agentId, { status: 'MINING' });

    if (err instanceof RelocateError) {
      if (err.status === 429 && err.retryAfterMs != null) {
        // Derive the cooldown anchor from retryAfterMs so the button countdown
        // is accurate even though our own move was rejected.
        const anchor = Date.now() + err.retryAfterMs - 10 * 60 * 1000;
        reloc.setCooldownAnchor(agentId, anchor);
      }
      toasts.addToast({
        type: err.status === 429 ? 'warning' : 'error',
        title: err.status === 429 ? 'ON COOLDOWN' : 'MOVE FAILED',
        message: err.message,
        // Inherits central default (warning 8000ms / error 10000ms).
      });
    } else {
      toasts.addToast({
        type: 'error',
        title: 'MOVE FAILED',
        message: err instanceof Error ? err.message : 'Relocation failed',
        // Inherits central error default (10000ms).
      });
    }
    // Leave MOVE mode on a hard failure so the banner clears; keep it open only
    // for transient issues would be surprising — a fresh MOVE click restarts.
    reloc.cancelRelocation();
  } finally {
    reloc.setSubmitting(false);
  }
}
