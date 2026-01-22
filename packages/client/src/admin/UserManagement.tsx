import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../lib/solana';
import './admin.css';

interface UserListItem {
  id: string;
  walletPubkey: string;
  role: string;
  createdAt: string;
  agentCount: number;
  claimCount: number;
  weightedScore: string;
  totalClaimed: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export function UserManagement() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(pagination.page), limit: '20' });
      if (search) params.set('search', search);

      const res = await fetch(`${API_BASE_URL}/admin/users?${params}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('Admin access required');
        }
        throw new Error('Failed to load users');
      }

      const data = await res.json();
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, search]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(p => ({ ...p, page: 1 }));
    loadUsers();
  };

  return (
    <div className="admin-panel">
      <h2>User Management</h2>

      <form onSubmit={handleSearch} className="search-form">
        <input
          type="text"
          placeholder="Search by wallet..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <button type="submit" className="pixel-btn">Search</button>
      </form>

      {error && <div className="admin-error">{error}</div>}

      {loading ? (
        <div className="admin-loading">Loading...</div>
      ) : (
        <>
          <table className="users-table">
            <thead>
              <tr>
                <th>Wallet</th>
                <th>Role</th>
                <th>Agents</th>
                <th>Claims</th>
                <th>Score</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td title={user.walletPubkey}>
                    {user.walletPubkey.slice(0, 8)}...
                  </td>
                  <td className={user.role === 'ADMIN' ? 'role-admin' : ''}>
                    {user.role}
                  </td>
                  <td>{user.agentCount}</td>
                  <td>{user.claimCount}</td>
                  <td>{formatScore(user.weightedScore)}</td>
                  <td>
                    <button className="action-btn">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination">
            <button
              disabled={pagination.page === 1}
              onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
              className="pixel-btn"
            >
              Prev
            </button>
            <span>Page {pagination.page} of {pagination.pages || 1}</span>
            <button
              disabled={pagination.page >= pagination.pages}
              onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
              className="pixel-btn"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function formatScore(score: string): string {
  const num = BigInt(score);
  if (num > 1000000n) return `${(Number(num) / 1000000).toFixed(1)}M`;
  if (num > 1000n) return `${(Number(num) / 1000).toFixed(1)}K`;
  return score;
}
