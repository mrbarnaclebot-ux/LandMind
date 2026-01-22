/**
 * Economy Controls Panel
 * Admin UI for managing economy parameters and emergency pause
 */
import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../lib/solana';

interface EconomyConfig {
  minClaimAmount: string;
  goldWeight: number;
  silverWeight: number;
  copperWeight: number;
  ironWeight: number;
  isPaused: boolean;
  pausedAt: string | null;
  pausedBy: string | null;
  updatedAt: string;
}

export function EconomyControls() {
  const [config, setConfig] = useState<EconomyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editedWeights, setEditedWeights] = useState({
    gold: 4000,
    silver: 2000,
    copper: 1500,
    iron: 1000,
  });

  const loadConfig = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE_URL}/admin/economy`, {
        credentials: 'include',
      });

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('Admin access required');
        }
        throw new Error('Failed to load economy config');
      }

      const data = await res.json();
      setConfig(data);
      setEditedWeights({
        gold: data.goldWeight,
        silver: data.silverWeight,
        copper: data.copperWeight,
        iron: data.ironWeight,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handlePause = async () => {
    if (!confirm('Are you sure you want to PAUSE all claims? This is an emergency action.')) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/admin/economy/pause`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to pause claims');
      }

      await loadConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause');
    } finally {
      setSaving(false);
    }
  };

  const handleUnpause = async () => {
    try {
      setSaving(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/admin/economy/unpause`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to unpause claims');
      }

      await loadConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unpause');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWeights = async () => {
    try {
      setSaving(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/admin/economy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          goldWeight: editedWeights.gold,
          silverWeight: editedWeights.silver,
          copperWeight: editedWeights.copper,
          ironWeight: editedWeights.iron,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save weights');
      }

      await loadConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="admin-panel admin-loading">Loading economy config...</div>;
  }

  if (!config) {
    return (
      <div className="admin-panel">
        <h2>Economy Controls</h2>
        {error && <div className="admin-error">{error}</div>}
        <p className="coming-soon">Failed to load configuration</p>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <h2>Economy Controls</h2>

      {error && <div className="admin-error">{error}</div>}

      {/* Emergency Pause Section */}
      <section className="economy-section">
        <h3>Emergency Controls</h3>
        <div className={`pause-status ${config.isPaused ? 'paused' : 'active'}`}>
          Status: {config.isPaused ? 'PAUSED' : 'ACTIVE'}
        </div>
        {config.isPaused && config.pausedAt && (
          <div className="pause-info">
            Paused at: {new Date(config.pausedAt).toLocaleString()}
            <br />
            By: {config.pausedBy?.slice(0, 8)}...
          </div>
        )}
        <div className="pause-actions">
          {config.isPaused ? (
            <button
              className="btn-unpause"
              onClick={handleUnpause}
              disabled={saving}
            >
              {saving ? 'Resuming...' : 'Resume Claims'}
            </button>
          ) : (
            <button
              className="btn-pause"
              onClick={handlePause}
              disabled={saving}
            >
              {saving ? 'Pausing...' : 'Emergency Pause'}
            </button>
          )}
        </div>
      </section>

      {/* Resource Weights Section */}
      <section className="economy-section">
        <h3>Resource Weights</h3>
        <p className="section-hint">
          Higher weight = more valuable for earnings calculation
        </p>

        <div className="weights-grid">
          {(['gold', 'silver', 'copper', 'iron'] as const).map((resource) => (
            <div key={resource} className="weight-input">
              <label>{resource.toUpperCase()}</label>
              <input
                type="number"
                value={editedWeights[resource]}
                onChange={(e) =>
                  setEditedWeights((prev) => ({
                    ...prev,
                    [resource]: parseInt(e.target.value) || 0,
                  }))
                }
                min={0}
                max={10000}
              />
            </div>
          ))}
        </div>

        <button
          className="btn-save"
          onClick={handleSaveWeights}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Weights'}
        </button>
      </section>

      {/* Minimum Claim Section */}
      <section className="economy-section">
        <h3>Claim Settings</h3>
        <div className="config-item">
          <label>Minimum Claim</label>
          <span>{formatSol(BigInt(config.minClaimAmount))} SOL</span>
        </div>
        <p className="section-hint">
          Minimum claim amount is set in smart contract (0.025 SOL)
        </p>
      </section>

      {/* Last Updated */}
      <div className="config-footer">
        Last updated: {new Date(config.updatedAt).toLocaleString()}
      </div>
    </div>
  );
}

function formatSol(lamports: bigint): string {
  return (Number(lamports) / 1e9).toFixed(4);
}
