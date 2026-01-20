import { FC, useState, useRef, useEffect } from 'react';
import { formatAddress, getExplorerUrl } from '../../lib/solana';
import '../../styles/pixel-theme.css';

interface AccountMenuProps {
  address: string;
  balance: number | null;
  onDisconnect: () => void;
  onViewHistory: () => void;
}

/**
 * Minecraft inventory-style account dropdown menu.
 * Shows balance, copy address, explorer link, and disconnect.
 */
export const AccountMenu: FC<AccountMenuProps> = ({ address, balance, onDisconnect, onViewHistory }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const copyAddress = async () => {
    await navigator.clipboard.writeText(address);
    setCopiedFeedback(true);
    setTimeout(() => setCopiedFeedback(false), 2000);
  };

  const openExplorer = () => {
    window.open(getExplorerUrl(address, 'address', 'devnet'), '_blank');
    setIsOpen(false);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={menuRef}>
      {/* Main button - inventory slot style */}
      <button
        className={`pixel-btn ${isOpen ? 'pressed' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          minWidth: '140px',
        }}
      >
        <span style={{ color: '#55CDFC' }}>◎</span>
        <span>{formatAddress(address)}</span>
        <span style={{
          fontSize: '6px',
          marginLeft: 'auto',
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>
          ▼
        </span>
      </button>

      {/* Dropdown - inventory panel style */}
      {isOpen && (
        <div
          className="pixel-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            minWidth: '220px',
            zIndex: 1000,
          }}
        >
          {/* Balance display - gold text */}
          <div
            style={{
              padding: '12px',
              background: '#2D2D31',
              marginBottom: '4px',
            }}
          >
            <div
              style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '8px',
                color: '#8B8B8B',
                marginBottom: '8px',
                textTransform: 'uppercase',
              }}
            >
              Balance
            </div>
            <div
              className="pixel-balance"
              style={{
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span style={{ color: '#55CDFC' }}>◎</span>
              <span>
                {balance !== null ? `${balance.toFixed(4)}` : '---'}
              </span>
              <span style={{ fontSize: '10px', color: '#FFAA00' }}>SOL</span>
            </div>
          </div>

          <div className="pixel-divider" />

          {/* Menu items */}
          <div
            className="pixel-dropdown-item"
            onClick={copyAddress}
          >
            <span style={{ marginRight: '8px' }}>📋</span>
            {copiedFeedback ? '✓ COPIED!' : 'COPY ADDRESS'}
          </div>

          <div
            className="pixel-dropdown-item"
            onClick={openExplorer}
          >
            <span style={{ marginRight: '8px' }}>🔍</span>
            EXPLORER
          </div>

          <div
            className="pixel-dropdown-item"
            onClick={() => {
              onViewHistory();
              setIsOpen(false);
            }}
          >
            <span style={{ marginRight: '8px' }}>[]</span>
            VIEW HISTORY
          </div>

          <div className="pixel-divider" />

          <div
            className="pixel-dropdown-item danger"
            onClick={() => {
              onDisconnect();
              setIsOpen(false);
            }}
          >
            <span style={{ marginRight: '8px' }}>⏻</span>
            DISCONNECT
          </div>
        </div>
      )}
    </div>
  );
};
