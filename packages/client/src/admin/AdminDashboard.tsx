import { useState } from 'react';
import { MetricsPanel } from './MetricsPanel';
import { UserManagement } from './UserManagement';
import { EconomyControls } from './EconomyControls';
import './admin.css';

type AdminTab = 'metrics' | 'users' | 'economy';

interface AdminDashboardProps {
  onClose: () => void;
}

export function AdminDashboard({ onClose }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('metrics');

  return (
    <div className="admin-overlay">
      <div className="admin-dashboard">
        <header className="admin-header">
          <h1>Admin Dashboard</h1>
          <button onClick={onClose} className="close-btn">X</button>
        </header>

        <nav className="admin-nav">
          <button
            className={`nav-btn ${activeTab === 'metrics' ? 'active' : ''}`}
            onClick={() => setActiveTab('metrics')}
          >
            Metrics
          </button>
          <button
            className={`nav-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Users
          </button>
          <button
            className={`nav-btn ${activeTab === 'economy' ? 'active' : ''}`}
            onClick={() => setActiveTab('economy')}
          >
            Economy
          </button>
        </nav>

        <main className="admin-content">
          {activeTab === 'metrics' && <MetricsPanel />}
          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'economy' && <EconomyControls />}
        </main>
      </div>
    </div>
  );
}
