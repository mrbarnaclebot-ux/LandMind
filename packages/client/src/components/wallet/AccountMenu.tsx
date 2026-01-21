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
 * Minecraft inventory-style account dropdown menu with voxel 3D effects.
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
      {/* Main button - 3D voxel style */}
      <button
        className={`pixel-btn-3d ${isOpen ? '' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          minWidth: '150px',
          padding: '10px 16px',
          ...(isOpen && {
            transform: 'translate(2px, 2px)',
            boxShadow: '2px 2px 0 0 rgba(0, 0, 0, 0.5), inset 0 2px 0 0 rgba(0, 0, 0, 0.2)',
          }),
        }}
      >
        {/* Pixel SOL icon */}
        <span className="pixel-sol" style={{ transform: 'scale(1)' }} />
        <span>{formatAddress(address)}</span>
        <span
          className={`pixel-dropdown-arrow ${isOpen ? 'open' : ''}`}
          style={{ marginLeft: 'auto' }}
        />
      </button>

      {/* Dropdown - enhanced inventory panel style */}
      {isOpen && (
        <div
          className="pixel-inventory-panel"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            minWidth: '240px',
            zIndex: 1000,
          }}
        >
          {/* Balance display - gold text with slot background */}
          <div
            className="pixel-slot-enhanced"
            style={{
              marginBottom: '8px',
              padding: '14px',
            }}
          >
            <div
              style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '7px',
                color: '#8B8B8B',
                textTransform: 'uppercase',
                marginBottom: '10px',
                letterSpacing: '0.5px',
              }}
            >
              BALANCE
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <span className="pixel-sol" style={{ transform: 'scale(1.2)' }} />
              <span
                className="pixel-balance"
                style={{
                  fontSize: '16px',
                  fontFamily: "'Press Start 2P', monospace",
                }}
              >
                {balance !== null ? `${balance.toFixed(4)}` : '---'}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  color: '#FFAA00',
                  fontFamily: "'Press Start 2P', monospace",
                  textShadow: '1px 1px 0 #CC8800',
                }}
              >
                SOL
              </span>
            </div>
          </div>

          <div className="pixel-divider" />

          {/* Menu items */}
          <div
            className="pixel-dropdown-item"
            onClick={copyAddress}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            {copiedFeedback ? (
              <>
                <span className="pixel-check" style={{ transform: 'scale(1)' }} />
                <span style={{ color: '#5D8C3E' }}>COPIED!</span>
              </>
            ) : (
              <>
                <span className="pixel-copy" style={{ transform: 'scale(1)' }} />
                <span>COPY ADDRESS</span>
              </>
            )}
          </div>

          <div
            className="pixel-dropdown-item"
            onClick={openExplorer}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <span className="pixel-search" style={{ transform: 'scale(1)' }} />
            <span>EXPLORER</span>
          </div>

          <div
            className="pixel-dropdown-item"
            onClick={() => {
              onViewHistory();
              setIsOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <span className="pixel-scroll" style={{ transform: 'scale(1)' }} />
            <span>VIEW HISTORY</span>
          </div>

          <div className="pixel-divider" />

          <div
            className="pixel-dropdown-item danger"
            onClick={() => {
              onDisconnect();
              setIsOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <span className="pixel-power" style={{ transform: 'scale(1)' }} />
            <span>DISCONNECT</span>
          </div>
        </div>
      )}
    </div>
  );
};
