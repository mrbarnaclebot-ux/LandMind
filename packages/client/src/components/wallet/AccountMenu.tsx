import { FC, useState, useRef, useEffect } from 'react';
import { formatAddress, getExplorerUrl } from '../../lib/solana';

interface AccountMenuProps {
  address: string;
  balance: number | null;
  onDisconnect: () => void;
}

const menuContainerStyle: React.CSSProperties = {
  position: 'relative',
  display: 'inline-block'
};

const menuButtonStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: '8px',
  padding: '8px 16px',
  color: 'white',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: '14px'
};

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  right: 0,
  marginTop: '4px',
  backgroundColor: 'rgba(20, 20, 30, 0.95)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '8px',
  padding: '8px 0',
  minWidth: '200px',
  zIndex: 1000,
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
};

const menuItemStyle: React.CSSProperties = {
  padding: '10px 16px',
  color: 'white',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '14px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  transition: 'background-color 0.15s'
};

const menuItemHoverStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, 0.1)'
};

const balanceStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  marginBottom: '4px'
};

const balanceLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'rgba(255, 255, 255, 0.5)',
  textTransform: 'uppercase',
  marginBottom: '4px'
};

const balanceValueStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 'bold',
  color: 'white'
};

export const AccountMenu: FC<AccountMenuProps> = ({ address, balance, onDisconnect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
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
    <div style={menuContainerStyle} ref={menuRef}>
      <button
        style={menuButtonStyle}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{formatAddress(address)}</span>
        <span style={{ fontSize: '10px' }}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div style={dropdownStyle}>
          {/* Balance display */}
          <div style={balanceStyle}>
            <div style={balanceLabelStyle}>Balance</div>
            <div style={balanceValueStyle}>
              {balance !== null ? `${balance.toFixed(4)} SOL` : 'Loading...'}
            </div>
          </div>

          {/* Copy address */}
          <div
            style={{
              ...menuItemStyle,
              ...(hoveredItem === 'copy' ? menuItemHoverStyle : {})
            }}
            onClick={copyAddress}
            onMouseEnter={() => setHoveredItem('copy')}
            onMouseLeave={() => setHoveredItem(null)}
          >
            {copiedFeedback ? 'Copied!' : 'Copy Address'}
          </div>

          {/* View on explorer */}
          <div
            style={{
              ...menuItemStyle,
              ...(hoveredItem === 'explorer' ? menuItemHoverStyle : {})
            }}
            onClick={openExplorer}
            onMouseEnter={() => setHoveredItem('explorer')}
            onMouseLeave={() => setHoveredItem(null)}
          >
            View on Explorer
          </div>

          {/* Disconnect */}
          <div
            style={{
              ...menuItemStyle,
              ...(hoveredItem === 'disconnect' ? menuItemHoverStyle : {}),
              color: '#ff6b6b'
            }}
            onClick={() => {
              onDisconnect();
              setIsOpen(false);
            }}
            onMouseEnter={() => setHoveredItem('disconnect')}
            onMouseLeave={() => setHoveredItem(null)}
          >
            Disconnect
          </div>
        </div>
      )}
    </div>
  );
};
