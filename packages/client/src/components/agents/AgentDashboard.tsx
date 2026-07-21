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
    backgroundColor: 'rgba(14, 16, 26, 0.7)',
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
    boxShadow: '8px 0 0 0 var(--pixel-inventory), inset -4px 4px 0 0 rgba(14, 16, 26, 0.5)',
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
              fontFamily: "var(--font-pixel)",
              fontSize: '12px',
              color: 'var(--dusk-text)',
              textShadow: '2px 2px 0 var(--dusk-text-shadow)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ color: 'var(--teal)' }}>[+]</span>
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
            background: 'var(--dusk-panel-2)',
            borderBottom: '4px solid var(--pixel-stone-dark)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              fontFamily: "var(--font-body)",
              fontSize: '13px',
              lineHeight: 1.5,
            }}
          >
            <div>
              <div style={{ color: 'var(--dusk-text-dim)', marginBottom: '4px' }}>AGENTS</div>
              <div style={{ color: 'var(--teal)', fontSize: '14px', fontFamily: "var(--font-pixel)" }}>
                {miningAgents}/{getAgentCount()}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--dusk-text-dim)', marginBottom: '4px' }}>MINING</div>
              <div style={{ color: miningAgents > 0 ? 'var(--teal)' : 'var(--dusk-text-faint)', fontSize: '14px', fontFamily: "var(--font-pixel)" }}>
                {miningAgents > 0 ? 'ACTIVE' : 'IDLE'}
              </div>
            </div>
          </div>

          {/* Total mined */}
          <div
            style={{
              marginTop: '12px',
              padding: '8px',
              background: 'rgba(14, 16, 26, 0.3)',
              fontFamily: "var(--font-body)",
              fontSize: '13px',
              lineHeight: 1.5,
            }}
          >
            <div style={{ color: 'var(--dusk-text-dim)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>TOTAL MINED</span>
              {miningAgents > 0 && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: 'var(--teal)',
                    fontSize: '13px',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--teal)',
                      animation: 'pulse 2s infinite',
                    }}
                  />
                  LIVE
                </span>
              )}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '4px',
                color: 'var(--dusk-text)',
                transition: 'opacity 0.3s ease-in-out',
              }}
            >
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
                fontFamily: "var(--font-body)",
                fontSize: '13px',
                lineHeight: 1.5,
                color: 'var(--dusk-text-dim)',
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
            fontFamily: "var(--font-body)",
            fontSize: '13px',
            lineHeight: 1.5,
            color: 'var(--dusk-text-faint)',
            textAlign: 'center',
          }}
        >
          CLICK LOCATE TO PAN CAMERA
        </div>
      </div>
    </>
  );
};
