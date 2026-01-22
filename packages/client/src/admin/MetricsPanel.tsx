import { useAdminSocket } from './hooks/useAdminSocket';
import './admin.css';

export function MetricsPanel() {
  const { metrics, isConnected } = useAdminSocket();

  if (!metrics) {
    return <div className="admin-panel">Loading metrics...</div>;
  }

  return (
    <div className="admin-panel">
      <div className="metrics-header">
        <h2>Platform Metrics</h2>
        <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
      </div>

      <div className="metrics-grid">
        {/* Users */}
        <MetricCard
          title="Total Users"
          value={metrics.totalUsers}
          subtitle={`+${metrics.newUsersToday} today`}
        />
        <MetricCard
          title="Active Users"
          value={metrics.activeUsers}
          subtitle="Mining now"
        />

        {/* Agents */}
        <MetricCard
          title="Total Agents"
          value={metrics.totalAgents}
        />
        <MetricCard
          title="Mining Agents"
          value={metrics.miningAgents}
          subtitle={`${metrics.idleAgents} idle`}
        />

        {/* Economy */}
        <MetricCard
          title="Treasury"
          value={formatSol(metrics.treasuryBalance)}
          subtitle="SOL"
        />
        <MetricCard
          title="Total Claimed"
          value={formatSol(metrics.totalClaimed)}
          subtitle="SOL"
        />

        {/* Performance */}
        <MetricCard
          title="Connections"
          value={metrics.connectionsCount}
        />
        <MetricCard
          title="Resources/min"
          value={Math.round(metrics.resourcesPerMinute)}
        />
      </div>

      <div className="latency-bar">
        <LatencyIndicator label="Redis" ms={metrics.redisLatency} />
        <LatencyIndicator label="DB" ms={metrics.dbLatency} />
        <LatencyIndicator label="RPC" ms={metrics.rpcLatency} />
      </div>
    </div>
  );
}

function MetricCard({ title, value, subtitle }: {
  title: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div className="metric-card">
      <div className="metric-title">{title}</div>
      <div className="metric-value">{value}</div>
      {subtitle && <div className="metric-subtitle">{subtitle}</div>}
    </div>
  );
}

function LatencyIndicator({ label, ms }: { label: string; ms: number }) {
  const status = ms < 0 ? 'error' : ms < 50 ? 'good' : ms < 200 ? 'ok' : 'slow';
  return (
    <div className={`latency-item ${status}`}>
      <span>{label}</span>
      <span>{ms < 0 ? 'ERR' : `${ms}ms`}</span>
    </div>
  );
}

function formatSol(lamports: number): string {
  return (lamports / 1e9).toFixed(4);
}
