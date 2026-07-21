import { useState, useCallback } from 'react';
import { ThreeScene } from './scene/ThreeScene';
import { AgentDashboard } from './components/agents/AgentDashboard';
import { Leaderboard } from './components/earnings/Leaderboard';
import { TransactionToastContainer } from './components/ui/TransactionStatus';
import { MobileLayout } from './components/mobile/MobileLayout';
import { Header } from './components/layout/Header';
import { ControlsOverlay } from './components/layout/ControlsOverlay';
import { AdminDashboard } from './admin/AdminDashboard';
import { useAdminCheck } from './admin/hooks/useAdminCheck';
import { useMobile } from './hooks/useMobile';
import { useCameraStore } from './stores/cameraStore';
import { hexToPixel } from './hex/hexMath';
import './styles/pixel-theme.css';

function App() {
  const { isMobile } = useMobile();
  const { isAdmin } = useAdminCheck();
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
        <TransactionToastContainer />
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
      <ControlsOverlay />
      <AgentDashboard
        isOpen={isAgentDashboardOpen}
        onClose={() => setIsAgentDashboardOpen(false)}
        onLocateAgent={handleLocateAgent}
      />
      {/* Earnings/Leaderboard panel */}
      {earningsVisible && (
        <div
          style={{
            position: 'absolute',
            top: '80px',
            right: '16px',
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
      {/* Transaction status toasts */}
      <TransactionToastContainer />
    </div>
  );
}

export default App;
