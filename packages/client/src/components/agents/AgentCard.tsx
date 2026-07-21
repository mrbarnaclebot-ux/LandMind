/**
 * AgentCard - Individual agent info card for dashboard
 * Minecraft inventory slot styling
 *
 * Phase B (System 2) additions:
 *  - MOVE button → enters relocation MOVE mode (pick a hex in the 3D world).
 *    Disabled with a live mm:ss countdown while the 10-min per-agent cooldown
 *    is active (derived from lastRelocatedAt or a 429 retryAfterMs anchor).
 *  - Combined phase × weather modifier chip: when a front covers this agent's
 *    hex, the chip shows the combined multiplier (e.g. '×1.38') with a tooltip
 *    breaking it into phase and weather parts.
 *
 * Phase C (System 3 — hazards) additions:
 *  - EFFICIENCY wear bar: a thin segmented bar, teal→amber→ember as wear grows,
 *    labelled 'EFFICIENCY 87%' (= 1 − 0.3×wear). A REPAIR button (enabled when
 *    wear > 0.15) posts to /repair, toasts on success, and refetches.
 *  - TRAPPED state: an ember 'TRAPPED' badge replaces the status chip, a live
 *    self-dig mm:ss countdown (from selfDigAt) is shown, and a RESCUE button
 *    posts to /rescue. Both actions handle the real-mode 501 gracefully.
 */
import { FC, useEffect, useState } from 'react';
import type { Agent } from '../../lib/agents';
import { rescueAgent, repairAgent, HazardActionError } from '../../lib/agents';
import { useWorldStore } from '../../stores/worldStore';
import { useHexStore } from '../../stores/hexStore';
import { useAgentStore } from '../../stores/agentStore';
import { useRelocationStore } from '../../stores/relocationStore';
import { useTransactionStore } from '../../stores/transactionStore';
import { ModifierChip } from '../layout/ModifierChip';
import { AgentModifierChip } from '../layout/AgentModifierChip';
import '../../styles/pixel-theme.css';

interface AgentCardProps {
  agent: Agent;
  onLocate: (q: number, r: number) => void;
}

// Format large numbers with K/M suffix
function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

// Status colors
const STATUS_COLORS: Record<string, string> = {
  MINING: 'var(--teal)',
  RELOCATING: 'var(--amber)',
  IDLE: 'var(--dusk-text-faint)',
  TRAPPED: 'var(--ember)',
};

/** mm:ss from a millisecond duration (clamped at 0). */
function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// --- System 3: wear / efficiency ------------------------------------------

/** Efficiency 0..1 from wear (published rule: efficiency = 1 − 0.3×wear). */
function efficiencyFromWear(wear: number): number {
  return 1 - 0.3 * Math.max(0, Math.min(1, wear));
}

/** Segment fill color: teal (fresh) → amber (worn) → ember (near floor). */
function wearColor(wear: number): string {
  if (wear < 0.4) return 'var(--teal)';
  if (wear < 0.75) return 'var(--amber)';
  return 'var(--ember)';
}

/** Number of lit segments (out of N) for a wear level. */
const WEAR_SEGMENTS = 10;

/**
 * EFFICIENCY wear bar — a thin segmented bar. Segments fill from the LEFT as
 * wear grows (more wear = more lit segments); the fill color shifts
 * teal→amber→ember. Matte, hard bevel, no gradient (anti-slop).
 */
const WearBar: FC<{ wear: number }> = ({ wear }) => {
  const clamped = Math.max(0, Math.min(1, wear));
  const eff = efficiencyFromWear(clamped);
  const lit = Math.round(clamped * WEAR_SEGMENTS);
  const color = wearColor(clamped);
  return (
    <div style={{ marginBottom: '8px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: 'var(--font-body)',
          fontSize: '11px',
          color: 'var(--dusk-text-dim)',
          marginBottom: '3px',
        }}
      >
        <span>EFFICIENCY</span>
        <span style={{ color, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(eff * 100)}%
        </span>
      </div>
      <div style={{ display: 'flex', gap: '2px' }}>
        {Array.from({ length: WEAR_SEGMENTS }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: '6px',
              background: i < lit ? color : 'var(--dusk-panel-lo)',
              boxShadow: 'inset 1px 1px 0 0 rgba(14,16,26,0.4)',
            }}
          />
        ))}
      </div>
    </div>
  );
};

export const AgentCard: FC<AgentCardProps> = ({ agent, onLocate }) => {
  const hasLocation = agent.hex && agent.hex.q !== undefined;
  const label = `#${agent.agentIndex ?? '?'}`;

  // World store (weather fronts + published table) for the combined chip.
  const fronts = useWorldStore((s) => s.fronts);
  const weatherTable = useWorldStore((s) => s.weatherTable);
  const getHexInfo = useHexStore((s) => s.getHexInfo);

  // Relocation store: MOVE-mode + per-agent cooldown countdown.
  const activeAgentId = useRelocationStore((s) => s.activeAgentId);
  const beginRelocation = useRelocationStore((s) => s.beginRelocation);
  const seedCooldownAnchor = useRelocationStore((s) => s.seedCooldownAnchor);
  const cooldownReadyAt = useRelocationStore((s) => s.cooldownReadyAt);

  // Seed the cooldown anchor from the agent record on mount / when it changes.
  useEffect(() => {
    if (agent.lastRelocatedAt != null) seedCooldownAnchor(agent.id, agent.lastRelocatedAt);
  }, [agent.id, agent.lastRelocatedAt, seedCooldownAnchor]);

  // Live 1s tick for the cooldown countdown text.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const readyAt = cooldownReadyAt(agent.id);
  const onCooldown = readyAt > now;
  const isActive = activeAgentId === agent.id;

  const biome = hasLocation ? getHexInfo(agent.hex!.q, agent.hex!.r)?.biome : undefined;

  // --- System 3: hazards (wear / repair + trapped / rescue) ----------------
  const updateAgent = useAgentStore((s) => s.updateAgent);
  const addToast = useTransactionStore((s) => s.addToast);
  const [busy, setBusy] = useState<null | 'repair' | 'rescue'>(null);

  const isTrapped = agent.status === 'TRAPPED';
  const wear = agent.wear ?? 0;
  const canRepair = wear > 0.15;
  // Self-dig countdown (mm:ss) from selfDigAt.
  const selfDigMs = agent.selfDigAt != null ? agent.selfDigAt - now : 0;

  const handleRepair = async () => {
    if (busy) return;
    setBusy('repair');
    try {
      const updated = await repairAgent(agent.id);
      updateAgent(agent.id, { wear: updated.wear ?? 0, status: updated.status });
      addToast({
        type: 'success',
        title: 'EQUIPMENT REPAIRED',
        message: `Agent ${label} restored to full efficiency`,
        // Inherits central success default (6500ms).
      });
    } catch (err) {
      handleHazardError(err, 'REPAIR');
    } finally {
      setBusy(null);
    }
  };

  const handleRescue = async () => {
    if (busy) return;
    setBusy('rescue');
    try {
      const updated = await rescueAgent(agent.id);
      updateAgent(agent.id, {
        status: updated.status ?? 'MINING',
        selfDigAt: null,
        trappedAt: null,
      });
      addToast({
        type: 'success',
        title: 'AGENT RESCUED',
        message: `Agent ${label} is back to mining`,
        // Inherits central success default (6500ms).
      });
    } catch (err) {
      handleHazardError(err, 'RESCUE');
    } finally {
      setBusy(null);
    }
  };

  /** Toast a hazard-action failure, softly for the real-mode 501 case. */
  function handleHazardError(err: unknown, action: string) {
    if (err instanceof HazardActionError && err.notImplemented) {
      addToast({
        type: 'info',
        title: `${action} UNAVAILABLE`,
        message: 'Available after contract deployment',
        // Inherits central info default (6500ms).
      });
      return;
    }
    addToast({
      type: 'error',
      title: `${action} FAILED`,
      message: err instanceof Error ? err.message : `${action} failed`,
      // Inherits central error default (10000ms).
    });
  }

  return (
    <div
      className="pixel-slot"
      style={{
        padding: '12px',
        marginBottom: '8px',
        // Amber outline when this agent is the relocation target being picked.
        boxShadow: isActive ? 'inset 0 0 0 2px var(--amber)' : undefined,
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: '9px',
            color: 'var(--dusk-text)',
          }}
        >
          AGENT {label}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            lineHeight: 1.5,
            fontWeight: isTrapped ? 700 : 400,
            letterSpacing: isTrapped ? '0.04em' : undefined,
            padding: '2px 6px',
            background: isTrapped
              ? 'var(--ember)'
              : STATUS_COLORS[agent.status] || 'var(--dusk-text-faint)',
            color: isTrapped ? '#fff' : 'var(--dusk-on-amber)',
            // Hard pixel bevel on the ember badge so it reads as an alarm chip.
            boxShadow: isTrapped
              ? 'inset 1px 1px 0 0 var(--ember-light), inset -1px -1px 0 0 var(--ember-dark)'
              : undefined,
          }}
        >
          {isTrapped ? '⚠ TRAPPED' : agent.status}
        </span>
      </div>

      {/* Active modifier — combined phase × weather when a front covers this
          agent's hex; otherwise the plain World Clock chip. Only while mining. */}
      {agent.status === 'MINING' && (
        <div style={{ marginBottom: '8px' }}>
          {hasLocation && biome ? (
            <AgentModifierChip
              hex={{ q: agent.hex!.q, r: agent.hex!.r }}
              biome={biome}
              fronts={fronts}
              weatherTable={weatherTable}
            />
          ) : (
            <ModifierChip />
          )}
        </div>
      )}

      {/* TRAPPED panel (System 3): ember-outlined alert with the self-dig
          countdown + RESCUE. Cave-ins never claw back mined resources. */}
      {isTrapped && (
        <div
          style={{
            marginBottom: '8px',
            padding: '8px',
            background: 'var(--dusk-panel-2)',
            boxShadow: 'inset 0 0 0 1px var(--ember-dark)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              color: 'var(--ember-light)',
              marginBottom: '6px',
              lineHeight: 1.4,
            }}
          >
            Cave-in! Self-dig in{' '}
            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {agent.selfDigAt != null ? fmtCountdown(selfDigMs) : '—'}
            </span>
          </div>
          <button
            onClick={handleRescue}
            className="pixel-btn"
            disabled={busy !== null}
            title="Pay a small SOL fee to free this agent now"
            style={{
              width: '100%',
              padding: '6px',
              fontSize: '8px',
              opacity: busy ? 0.6 : 1,
              cursor: busy ? 'wait' : 'pointer',
              boxShadow: 'inset 0 0 0 2px var(--ember)',
            }}
          >
            {busy === 'rescue' ? 'RESCUING…' : 'RESCUE'}
          </button>
        </div>
      )}

      {/* EFFICIENCY wear bar (System 3) — shown for any deployed agent, plus a
          REPAIR action when wear is worth clearing (> 15%). */}
      {hasLocation && (
        <>
          <WearBar wear={wear} />
          {canRepair && !isTrapped && (
            <button
              onClick={handleRepair}
              className="pixel-btn"
              disabled={busy !== null}
              title="Pay a small SOL fee to restore full efficiency"
              style={{
                width: '100%',
                padding: '6px',
                fontSize: '8px',
                marginBottom: '8px',
                opacity: busy ? 0.6 : 1,
                cursor: busy ? 'wait' : 'pointer',
                boxShadow: 'inset 0 0 0 2px var(--amber)',
              }}
            >
              {busy === 'repair' ? 'REPAIRING…' : 'REPAIR'}
            </button>
          )}
        </>
      )}

      {/* Location */}
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '13px',
          lineHeight: 1.5,
          color: hasLocation ? 'var(--dusk-text-dim)' : 'var(--dusk-text-faint)',
          marginBottom: '8px',
        }}
      >
        {hasLocation ? `HEX (${agent.hex!.q}, ${agent.hex!.r})` : 'UNASSIGNED'}
      </div>

      {/* Resources mined */}
      {agent.miningState && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '4px',
            marginBottom: '10px',
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            lineHeight: 1.5,
          }}
        >
          <div>
            <span style={{ color: '#FFD700' }}>Au: </span>
            <span>{formatNumber(agent.miningState.gold)}</span>
          </div>
          <div>
            <span style={{ color: '#C0C0C0' }}>Ag: </span>
            <span>{formatNumber(agent.miningState.silver)}</span>
          </div>
          <div>
            <span style={{ color: '#B87333' }}>Cu: </span>
            <span>{formatNumber(agent.miningState.copper)}</span>
          </div>
          <div>
            <span style={{ color: '#708090' }}>Fe: </span>
            <span>{formatNumber(agent.miningState.iron)}</span>
          </div>
        </div>
      )}

      {/* Action buttons: LOCATE + MOVE */}
      {hasLocation && (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => onLocate(agent.hex!.q, agent.hex!.r)}
            className="pixel-btn"
            style={{ flex: 1, padding: '6px', fontSize: '8px' }}
          >
            LOCATE
          </button>
          <button
            onClick={() => !onCooldown && !isTrapped && beginRelocation(agent.id, label)}
            className="pixel-btn"
            disabled={onCooldown || isTrapped}
            title={
              isTrapped
                ? 'Agent is trapped — rescue it first'
                : onCooldown
                  ? `Relocation cooldown — ready in ${fmtCountdown(readyAt - now)}`
                  : isActive
                    ? 'Cancel relocation (or press ESC)'
                    : 'Move this agent — click a hex in the world'
            }
            style={{
              flex: 1,
              padding: '6px',
              fontSize: '8px',
              opacity: onCooldown || isTrapped ? 0.55 : 1,
              cursor: onCooldown || isTrapped ? 'not-allowed' : 'pointer',
              // Amber emphasis while this agent is the active MOVE target.
              boxShadow: isActive ? 'inset 0 0 0 2px var(--amber)' : undefined,
            }}
          >
            {onCooldown ? fmtCountdown(readyAt - now) : isActive ? 'CANCEL' : 'MOVE'}
          </button>
        </div>
      )}
    </div>
  );
};
