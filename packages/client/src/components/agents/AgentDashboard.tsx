/**
 * AgentDashboard - Side panel showing user's agents
 * Similar to WalletDrawer, Minecraft inventory style
 */
import { FC, useEffect } from 'react';
import { useAgentStore } from '../../stores/agentStore';
import { useWalletStore } from '../../stores/walletStore';
import { AgentCard } from './AgentCard';
import '../../styles/pixel-theme.css';

interface AgentDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  onLocateAgent: (q: number, r: number) => void;
}

// Format large numbers
function formatNumber(value: string | bigint): string {
  const num = typeof value === 'string' ? BigInt(value) : value;
  if (num >= 1_000_000n) return `${Number(num / 1_000_000n).toFixed(1)}M`;
  if (num >= 1_000n) return `${Number(num / 1_000n).toFixed(1)}K`;
  return num.toString();
}

export const AgentDashboard: FC<AgentDashboardProps> = ({
  isOpen,
  onClose,
  onLocateAgent,
}) => {
  const { agents, getAgentCount, getTotalMined } = useAgentStore();
  const { isAuthenticated } = useWalletStore();

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isAuthenticated) {
    return null;
  }

  const totalMined = getTotalMined();
  const miningAgents = agents.filter((a) => a.status === 'MINING').length;

  // Panel styles (mirror WalletDrawer)
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 999,
    opacity: isOpen ? 1 : 0,
    visibility: isOpen ? 'visible' : 'hidden',
    transition: 'opacity 0.2s, visibility 0.2s',
  };

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    width: '320px',
    maxWidth: '100vw',
    zIndex: 1000,
    transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 0.25s ease-out',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--pixel-inventory-dark)',
    border: '4px solid var(--pixel-obsidian)',
    boxShadow: '8px 0 0 0 var(--pixel-inventory), inset -4px 4px 0 0 rgba(0, 0, 0, 0.5)',
  };

  const headerStyle: React.CSSProperties = {
    padding: '16px',
    background: 'var(--pixel-obsidian)',
    borderBottom: '4px solid var(--pixel-stone-dark)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: 'inset 0 4px 0 0 var(--pixel-obsidian-light)',
  };

  return (
    <>
      {/* Overlay */}
      <div style={overlayStyle} onClick={onClose} />

      {/* Panel */}
      <div style={panelStyle} className="pixel-ui">
        {/* Header */}
        <header style={headerStyle}>
          <span
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '12px',
              color: '#FFFFFF',
              textShadow: '2px 2px 0 #3F3F3F',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ color: '#4CAF50' }}>[+]</span>
            AGENTS
          </span>
          <button
            onClick={onClose}
            className="pixel-btn"
            style={{
              padding: '6px 10px',
              fontSize: '10px',
              minWidth: 'auto',
            }}
          >
            X
          </button>
        </header>

        {/* Summary Stats */}
        <section
          style={{
            padding: '16px',
            background: '#2D2D31',
            borderBottom: '4px solid var(--pixel-stone-dark)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '8px',
            }}
          >
            <div>
              <div style={{ color: '#8B8B8B', marginBottom: '4px' }}>AGENTS</div>
              <div style={{ color: '#4CAF50', fontSize: '14px' }}>
                {miningAgents}/{getAgentCount()}
              </div>
            </div>
            <div>
              <div style={{ color: '#8B8B8B', marginBottom: '4px' }}>MINING</div>
              <div style={{ color: miningAgents > 0 ? '#4CAF50' : '#9E9E9E', fontSize: '14px' }}>
                {miningAgents > 0 ? 'ACTIVE' : 'IDLE'}
              </div>
            </div>
          </div>

          {/* Total mined */}
          <div
            style={{
              marginTop: '12px',
              padding: '8px',
              background: 'rgba(0, 0, 0, 0.3)',
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '7px',
            }}
          >
            <div style={{ color: '#8B8B8B', marginBottom: '6px' }}>TOTAL MINED</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
              <span><span style={{ color: '#FFD700' }}>Au:</span> {formatNumber(totalMined.gold)}</span>
              <span><span style={{ color: '#C0C0C0' }}>Ag:</span> {formatNumber(totalMined.silver)}</span>
              <span><span style={{ color: '#B87333' }}>Cu:</span> {formatNumber(totalMined.copper)}</span>
              <span><span style={{ color: '#708090' }}>Fe:</span> {formatNumber(totalMined.iron)}</span>
            </div>
          </div>
        </section>

        {/* Agent List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px',
          }}
        >
          {agents.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '24px',
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '8px',
                color: '#8B8B8B',
              }}
            >
              No agents deployed yet.
              <br />
              <br />
              Click DEPLOY AGENT to get started!
            </div>
          ) : (
            agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onLocate={onLocateAgent}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '8px 16px',
            background: 'var(--pixel-obsidian)',
            borderTop: '4px solid var(--pixel-stone-dark)',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '6px',
            color: '#5F5F5F',
            textAlign: 'center',
          }}
        >
          CLICK LOCATE TO PAN CAMERA
        </div>
      </div>
    </>
  );
};
