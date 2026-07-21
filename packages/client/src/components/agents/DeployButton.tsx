/**
 * Deploy Agent button - Minecraft-styled with hover tooltip
 * Lives in header, always visible when authenticated
 */
import { FC, useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletStore } from '../../stores/walletStore';
import { useAgentStore } from '../../stores/agentStore';
import { useConfigStore } from '../../stores/configStore';
import { useAgentDeploy, DeployStatus } from '../../hooks/useAgentDeploy';
import { DEPLOY_COST_SOL } from '../../lib/umi';
import '../../styles/pixel-theme.css';

// Toast-like status messages
const STATUS_MESSAGES: Record<DeployStatus, string> = {
  idle: '',
  requesting: 'Preparing...',
  signing: 'Sign in wallet...',
  sending: 'Sending...',
  confirming: 'Confirming...',
  success: 'Agent deployed!',
  error: 'Failed',
};

export const DeployButton: FC = () => {
  const { connected } = useWallet();
  const { isAuthenticated } = useWalletStore();
  const { getAgentCount } = useAgentStore();
  const fakeSolMode = useConfigStore((s) => s.fakeSolMode);
  const { deploy, status, error, isDeploying } = useAgentDeploy();

  const [showTooltip, setShowTooltip] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'info' | 'success' | 'error'>('info');

  const agentCount = getAgentCount();
  const isAtSoftCap = agentCount >= 10;
  const isAtHardCap = agentCount >= 20;

  // Show toast on status change
  useEffect(() => {
    if (status === 'idle') {
      setToastMessage('');
      return;
    }

    setToastMessage(STATUS_MESSAGES[status]);
    setToastType(status === 'success' ? 'success' : status === 'error' ? 'error' : 'info');

    // Clear success/error toast after delay
    if (status === 'success' || status === 'error') {
      const timer = setTimeout(() => setToastMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  // Show error message
  useEffect(() => {
    if (error) {
      setToastMessage(error);
      setToastType('error');
    }
  }, [error]);

  // Don't render if not authenticated. In fake-SOL test mode there is no wallet
  // extension, so a valid test session (isAuthenticated) is sufficient.
  if (!isAuthenticated || (!fakeSolMode && !connected)) {
    return null;
  }

  const handleDeploy = async () => {
    if (isDeploying || isAtHardCap) return;
    await deploy();
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Deploy Button */}
      <button
        onClick={handleDeploy}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        disabled={isDeploying || isAtHardCap}
        className="pixel-btn"
        style={{
          padding: '8px 16px',
          fontSize: '10px',
          opacity: isDeploying ? 0.7 : 1,
          cursor: isDeploying || isAtHardCap ? 'not-allowed' : 'pointer',
        }}
      >
        {isDeploying ? STATUS_MESSAGES[status] || 'DEPLOYING...' : 'DEPLOY AGENT'}
      </button>

      {/* Hover Tooltip */}
      {showTooltip && !isDeploying && (
        <div
          className="pixel-inventory-bg"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '8px',
            padding: '10px 14px',
            fontFamily: "var(--font-body)",
            fontSize: '13px',
            lineHeight: 1.5,
            color: 'var(--dusk-text)',
            whiteSpace: 'nowrap',
            zIndex: 1000,
            minWidth: '140px',
          }}
        >
          <div style={{ marginBottom: '6px', color: 'var(--amber)' }}>
            COST: {DEPLOY_COST_SOL} SOL
          </div>
          <div style={{ color: 'var(--dusk-text-dim)' }}>
            AGENTS: {agentCount}/20
          </div>
          {isAtSoftCap && !isAtHardCap && (
            <div style={{ marginTop: '6px', color: 'var(--ember-light)', fontSize: '13px' }}>
              Approaching limit
            </div>
          )}
          {isAtHardCap && (
            <div style={{ marginTop: '6px', color: 'var(--ember-light)', fontSize: '13px' }}>
              Limit reached
            </div>
          )}
        </div>
      )}

      {/* Toast Message */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '80px',
            right: '20px',
            padding: '12px 20px',
            fontFamily: "var(--font-body)",
            fontSize: '13px',
            lineHeight: 1.5,
            color: 'var(--dusk-on-amber)',
            background: toastType === 'success' ? 'var(--teal)' :
                        toastType === 'error' ? 'var(--ember)' : 'var(--teal)',
            boxShadow: '4px 4px 0 rgba(14, 16, 26, 0.3)',
            zIndex: 2000,
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
};
