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
 */
import { FC, useEffect, useState } from 'react';
import type { Agent } from '../../lib/agents';
import { useWorldStore } from '../../stores/worldStore';
import { useHexStore } from '../../stores/hexStore';
import { useRelocationStore } from '../../stores/relocationStore';
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
};

/** mm:ss from a millisecond duration (clamped at 0). */
function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

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
            padding: '2px 6px',
            background: STATUS_COLORS[agent.status] || 'var(--dusk-text-faint)',
            color: 'var(--dusk-on-amber)',
          }}
        >
          {agent.status}
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
            onClick={() => !onCooldown && beginRelocation(agent.id, label)}
            className="pixel-btn"
            disabled={onCooldown}
            title={
              onCooldown
                ? `Relocation cooldown — ready in ${fmtCountdown(readyAt - now)}`
                : isActive
                  ? 'Cancel relocation (or press ESC)'
                  : 'Move this agent — click a hex in the world'
            }
            style={{
              flex: 1,
              padding: '6px',
              fontSize: '8px',
              opacity: onCooldown ? 0.55 : 1,
              cursor: onCooldown ? 'not-allowed' : 'pointer',
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
