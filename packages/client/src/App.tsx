import { useState, useCallback, useEffect } from 'react';
import { ThreeScene } from './scene/ThreeScene';
import { AgentDashboard } from './components/agents/AgentDashboard';
import { Leaderboard } from './components/earnings/Leaderboard';
import { TransactionToastContainer } from './components/ui/TransactionStatus';
import { SessionExpiredToast } from './components/ui/SessionExpiredToast';
import { MobileLayout } from './components/mobile/MobileLayout';
import { Header } from './components/layout/Header';
import { ControlsOverlay } from './components/layout/ControlsOverlay';
import { PhaseClockContainer } from './components/layout/PhaseClockContainer';
import { RelocationBanner } from './components/layout/RelocationBanner';
import { useWorldClock } from './hooks/useWorldClock';
import { useContracts } from './hooks/useContracts';
import { AdminDashboard } from './admin/AdminDashboard';
import { useAdminCheck } from './admin/hooks/useAdminCheck';
import { useMobile } from './hooks/useMobile';
import { useCameraStore } from './stores/cameraStore';
import { useConfigStore } from './stores/configStore';
import { getSocket } from './lib/socket';
import { hexToPixel } from './hex/hexMath';
import './styles/pixel-theme.css';

function App() {
  const { isMobile } = useMobile();
  const { isAdmin } = useAdminCheck();
  const loadConfig = useConfigStore((s) => s.loadConfig);

  // World Clock (System 1): seed from GET /api/world + subscribe to the public
  // world:update broadcast. Public/no-auth, so it runs for anonymous visitors.
  // Also carries the System 4 Gold Rush broadcast (goldrush:update).
  useWorldClock();

  // Engagement layer (System 4): daily contract + prospecting. Fetches
  // /api/contracts + /api/surveys and subscribes contract:progress/completed
  // once authenticated. Mounted once here (drives both desktop + mobile layouts,
  // consistent with useWorldClock / the PhaseClockContainer HUD stack).
  useContracts();

  // On mount: fetch the public server config (drives fake-SOL test mode) and
  // open the shared socket connection. The socket connects even for anonymous
  // visitors so public broadcasts (e.g. mining:update) arrive on the landing
  // page; user-room subscription still happens post-auth in the data hooks.
  useEffect(() => {
    void loadConfig();
    getSocket();
  }, [loadConfig]);
  const [isAgentDashboardOpen, setIsAgentDashboardOpen] = useState(false);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  const [heatMapVisible, setHeatMapVisible] = useState(false);
  const [earningsVisible, setEarningsVisible] = useState(false);
  const { panToPosition } = useCameraStore();

  // Camera pan callback - pans camera to hex location
  const handleLocateAgent = useCallback((q: number, r: number) => {
    // Convert hex coordinates to world position
    const { x, z } = hexToPixel(q, r);
    // Pan camera to that position (y=0 for ground level)
    panToPosition(x, 0, z);
    // Close panel after locate
    setIsAgentDashboardOpen(false);
  }, [panToPosition]);

  // Mobile layout with bottom sheets
  if (isMobile) {
    return (
      <>
        <MobileLayout
          onLocateAgent={handleLocateAgent}
          heatMapVisible={heatMapVisible}
          onToggleHeatMap={() => setHeatMapVisible((v) => !v)}
        >
          <ThreeScene heatMapVisible={heatMapVisible} />
        </MobileLayout>
        <RelocationBanner />
        <TransactionToastContainer />
        <SessionExpiredToast />
      </>
    );
  }

  // Desktop layout
  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh' }}>
      <Header
        onOpenAgentDashboard={() => setIsAgentDashboardOpen(true)}
        onToggleHeatMap={() => setHeatMapVisible((v) => !v)}
        heatMapVisible={heatMapVisible}
        onToggleEarnings={() => setEarningsVisible((v) => !v)}
        earningsVisible={earningsVisible}
        onOpenAdmin={() => setIsAdminDashboardOpen(true)}
        isAdmin={isAdmin}
      />
      <ThreeScene heatMapVisible={heatMapVisible} />
      {/* Unified World rail — top-left, just under the 64px header. Stays below
          the toast/banner layers (z 3000+); expanded by default on desktop. */}
      <div
        className="desktop-only"
        style={{ position: 'absolute', top: '76px', left: '16px', zIndex: 100 }}
      >
        <PhaseClockContainer />
      </div>
      <ControlsOverlay />
      <AgentDashboard
        isOpen={isAgentDashboardOpen}
        onClose={() => setIsAgentDashboardOpen(false)}
        onLocateAgent={handleLocateAgent}
      />
      {/* Earnings/Leaderboard panel — top offset + width aligned to the World
          rail on the left so the two side panels read as one system. */}
      {earningsVisible && (
        <div
          style={{
            position: 'absolute',
            top: '76px',
            right: '16px',
            width: '268px',
            zIndex: 100,
          }}
        >
          <Leaderboard />
        </div>
      )}
      {/* Admin Dashboard */}
      {isAdminDashboardOpen && (
        <AdminDashboard onClose={() => setIsAdminDashboardOpen(false)} />
      )}
      {/* Relocation MOVE-mode prompt (System 2). Fixed, top-center. */}
      <RelocationBanner />
      {/* Transaction status toasts */}
      <TransactionToastContainer />
      {/* Global "session expired — reconnect" toast (fires on any authed 401) */}
      <SessionExpiredToast />
    </div>
  );
}

export default App;
