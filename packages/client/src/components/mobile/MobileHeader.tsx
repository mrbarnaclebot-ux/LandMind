/**
 * MobileHeader - Compact mobile header with action buttons
 *
 * Provides:
 * - Logo branding
 * - Heat map toggle button
 * - Deploy agent button
 * - Wallet connect button
 */
import { ConnectButton } from '../wallet/ConnectButton';
import { DeployButton } from '../agents/DeployButton';
import '../../styles/mobile.css';

interface MobileHeaderProps {
  /** Whether heat map overlay is visible */
  heatMapVisible: boolean;
  /** Toggle heat map visibility */
  onToggleHeatMap: () => void;
}

/**
 * Mobile header component with action buttons
 */
export function MobileHeader({ heatMapVisible, onToggleHeatMap }: MobileHeaderProps) {
  return (
    <header className="mobile-header">
      <div className="mobile-header-logo">
        <img
          src="/brand/minerush-icon.png"
          alt=""
          aria-hidden="true"
          style={{
            height: '32px',
            width: '32px',
            marginRight: '8px',
            imageRendering: 'pixelated',
            verticalAlign: 'middle',
          }}
        />
        MINERUSH
      </div>
      <div className="mobile-header-actions">
        {/* Heat map toggle */}
        <button
          onClick={onToggleHeatMap}
          className={`pixel-btn mobile-heat-toggle ${heatMapVisible ? 'active' : ''}`}
          title="Toggle heat map"
        >
          &#x2668;
        </button>
        {/* Deploy agent button */}
        <DeployButton />
        {/* Wallet connect */}
        <ConnectButton />
      </div>
    </header>
  );
}
