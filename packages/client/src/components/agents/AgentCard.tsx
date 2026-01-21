/**
 * AgentCard - Individual agent info card for dashboard
 * Minecraft inventory slot styling
 */
import { FC } from 'react';
import type { Agent } from '../../lib/agents';
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
  MINING: '#4CAF50',
  RELOCATING: '#FFC107',
  IDLE: '#9E9E9E',
};

export const AgentCard: FC<AgentCardProps> = ({ agent, onLocate }) => {
  const hasLocation = agent.hex && agent.hex.q !== undefined;

  return (
    <div
      className="pixel-slot"
      style={{
        padding: '12px',
        marginBottom: '8px',
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
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '9px',
            color: '#FFFFFF',
          }}
        >
          AGENT #{agent.agentIndex || '?'}
        </span>
        <span
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '7px',
            padding: '2px 6px',
            background: STATUS_COLORS[agent.status] || '#9E9E9E',
            color: agent.status === 'RELOCATING' ? '#000' : '#FFF',
          }}
        >
          {agent.status}
        </span>
      </div>

      {/* Location */}
      <div
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '7px',
          color: hasLocation ? '#8B8B8B' : '#666666',
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
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '7px',
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

      {/* Locate button */}
      {hasLocation && (
        <button
          onClick={() => onLocate(agent.hex!.q, agent.hex!.r)}
          className="pixel-btn"
          style={{
            width: '100%',
            padding: '6px',
            fontSize: '8px',
          }}
        >
          LOCATE
        </button>
      )}
    </div>
  );
};
