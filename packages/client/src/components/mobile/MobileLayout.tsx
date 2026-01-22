/**
 * MobileLayout - Mobile-specific layout with bottom navigation
 *
 * Provides:
 * - Compact header with logo and wallet connect
 * - Bottom navigation bar with AGENTS, EARNINGS, SETTINGS
 * - Bottom sheets for each panel
 * - Quality settings for performance control
 */
import { ReactNode, useState, useEffect } from 'react';
import { BottomSheet } from './BottomSheet';
import { ConnectButton } from '../wallet/ConnectButton';
import { AgentDashboard } from '../agents/AgentDashboard';
import { Leaderboard } from '../earnings/Leaderboard';
import '../../styles/mobile.css';

interface MobileLayoutProps {
  /** Main content (3D scene) */
  children: ReactNode;
  /** Callback to pan camera to agent location */
  onLocateAgent: (q: number, r: number) => void;
}

type ActivePanel = 'none' | 'agents' | 'earnings' | 'settings';

/**
 * Quality level type
 */
type QualityLevel = 'low' | 'medium' | 'high';

/**
 * Mobile header component
 */
export function MobileHeader() {
  return (
    <header className="mobile-header">
      <div className="mobile-header-logo">
        <span style={{ marginRight: '8px' }}>&#x2B21;</span>
        LANDMIND
      </div>
      <div className="mobile-header-actions">
        <ConnectButton />
      </div>
    </header>
  );
}

/**
 * Quality settings component for mobile performance control
 */
function QualitySettings() {
  const [quality, setQuality] = useState<QualityLevel>(() => {
    const stored = localStorage.getItem('qualityLevel');
    return (stored as QualityLevel) || 'medium';
  });

  const handleQualityChange = (level: QualityLevel) => {
    setQuality(level);
    localStorage.setItem('qualityLevel', level);
    // Dispatch event for ThreeScene to pick up
    window.dispatchEvent(new CustomEvent('qualityChange', { detail: level }));
  };

  return (
    <div className="quality-panel">
      <div className="quality-panel-label">Graphics Quality</div>
      {(['low', 'medium', 'high'] as const).map((level) => (
        <button
          key={level}
          className={`quality-option ${quality === level ? 'selected' : ''}`}
          onClick={() => handleQualityChange(level)}
        >
          <span>{level.toUpperCase()}</span>
          <span className="quality-option-check">
            {quality === level ? '\u2713' : ''}
          </span>
        </button>
      ))}
      <div className="quality-hint">
        Lower quality = better performance on older devices
      </div>
    </div>
  );
}

/**
 * MobileLayout main component
 */
export function MobileLayout({ children, onLocateAgent }: MobileLayoutProps) {
  const [activePanel, setActivePanel] = useState<ActivePanel>('none');

  // Close panel on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activePanel !== 'none') {
        setActivePanel('none');
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [activePanel]);

  const handleNavClick = (panel: ActivePanel) => {
    setActivePanel(activePanel === panel ? 'none' : panel);
  };

  return (
    <div className="mobile-layout">
      {/* Compact header */}
      <MobileHeader />

      {/* Main content (3D scene) - padded for header/nav */}
      <div className="mobile-content">
        {children}
      </div>

      {/* Bottom navigation */}
      <nav className="mobile-nav">
        <button
          className={`mobile-nav-item ${activePanel === 'agents' ? 'active' : ''}`}
          onClick={() => handleNavClick('agents')}
        >
          <span className="mobile-nav-icon">&#x2B22;</span>
          <span>AGENTS</span>
        </button>
        <button
          className={`mobile-nav-item ${activePanel === 'earnings' ? 'active' : ''}`}
          onClick={() => handleNavClick('earnings')}
        >
          <span className="mobile-nav-icon">&#x2B50;</span>
          <span>EARNINGS</span>
        </button>
        <button
          className={`mobile-nav-item ${activePanel === 'settings' ? 'active' : ''}`}
          onClick={() => handleNavClick('settings')}
        >
          <span className="mobile-nav-icon">&#x2699;</span>
          <span>SETTINGS</span>
        </button>
      </nav>

      {/* Bottom sheets for panels */}
      <BottomSheet
        isOpen={activePanel === 'agents'}
        onClose={() => setActivePanel('none')}
        title="MY AGENTS"
      >
        <AgentDashboard
          isOpen={true}
          onClose={() => setActivePanel('none')}
          onLocateAgent={(q, r) => {
            onLocateAgent(q, r);
            setActivePanel('none');
          }}
        />
      </BottomSheet>

      <BottomSheet
        isOpen={activePanel === 'earnings'}
        onClose={() => setActivePanel('none')}
        title="EARNINGS"
      >
        <Leaderboard />
      </BottomSheet>

      <BottomSheet
        isOpen={activePanel === 'settings'}
        onClose={() => setActivePanel('none')}
        title="SETTINGS"
      >
        <QualitySettings />
      </BottomSheet>
    </div>
  );
}
