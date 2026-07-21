/**
 * Leaderboard component - Shows top 10 miners with rank badges
 * Pixel-styled compact list with gold/silver/bronze rank indicators
 */
import { useLeaderboard, type LeaderboardEntry, type UserRankInfo } from '../../hooks/useLeaderboard';

/**
 * Format wallet address for display
 */
function formatWallet(wallet: string): string {
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

/**
 * Format score for display (convert from lamports-like to readable)
 */
function formatScore(score: string): string {
  const num = Number(score);
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toFixed(0);
}

/**
 * Get rank badge color based on position
 */
function getRankStyle(rank: number): { bg: string; border: string; text: string } {
  switch (rank) {
    case 1:
      return {
        bg: 'var(--amber)',
        border: 'var(--amber-dark)',
        text: 'var(--dusk-on-amber)',
      };
    case 2:
      return {
        bg: '#AFAFAF',
        border: '#7F7F7F',
        text: 'var(--dusk-on-amber)',
      };
    case 3:
      return {
        bg: '#8B5A2B',
        border: '#5D3A1A',
        text: 'var(--dusk-text)',
      };
    default:
      return {
        bg: 'var(--dusk-panel-2)',
        border: 'var(--dusk-panel-lo)',
        text: 'var(--dusk-text)',
      };
  }
}

/**
 * Rank badge component
 */
function RankBadge({ rank }: { rank: number }) {
  const style = getRankStyle(rank);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '24px',
        height: '24px',
        background: style.bg,
        border: `2px solid ${style.border}`,
        fontFamily: "var(--font-body)",
        fontSize: '13px',
        lineHeight: 1.5,
        color: style.text,
        flexShrink: 0,
      }}
    >
      {rank}
    </span>
  );
}

/**
 * Single leaderboard entry row
 */
function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 8px',
        background: entry.isCurrentUser
          ? 'rgba(63, 182, 168, 0.15)'
          : 'transparent',
        borderLeft: entry.isCurrentUser ? '3px solid var(--teal)' : '3px solid transparent',
      }}
    >
      <RankBadge rank={entry.rank} />
      <span
        style={{
          flex: 1,
          fontFamily: "var(--font-body)",
          fontSize: '13px',
          lineHeight: 1.5,
          color: entry.isCurrentUser ? 'var(--teal-light)' : 'var(--dusk-text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {formatWallet(entry.wallet)}
      </span>
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize: '13px',
          lineHeight: 1.5,
          color: 'var(--amber)',
          textShadow: '1px 1px 0 var(--amber-dark)',
        }}
      >
        {formatScore(entry.score)}
      </span>
    </div>
  );
}

/**
 * User rank row (when not in top 10)
 */
function UserRankRow({ userRank, percentile }: { userRank: UserRankInfo; percentile: number | null }) {
  return (
    <>
      {/* Separator */}
      <div
        style={{
          height: '2px',
          background: 'var(--dusk-panel-hi)',
          margin: '8px 0',
        }}
      />
      {/* Ellipsis */}
      <div
        style={{
          textAlign: 'center',
          fontFamily: "var(--font-body)",
          fontSize: '13px',
          lineHeight: 1.5,
          color: 'var(--dusk-text-faint)',
          padding: '4px 0',
        }}
      >
        ...
      </div>
      {/* User row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 8px',
          background: 'rgba(63, 182, 168, 0.15)',
          borderLeft: '3px solid var(--teal)',
        }}
      >
        <RankBadge rank={userRank.rank} />
        <span
          style={{
            flex: 1,
            fontFamily: "var(--font-body)",
            fontSize: '13px',
            lineHeight: 1.5,
            color: 'var(--teal-light)',
          }}
        >
          YOU
        </span>
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: '13px',
            lineHeight: 1.5,
            color: 'var(--amber)',
            textShadow: '1px 1px 0 var(--amber-dark)',
          }}
        >
          {formatScore(userRank.score)}
        </span>
      </div>
      {/* Percentile */}
      {percentile !== null && (
        <div
          style={{
            textAlign: 'center',
            fontFamily: "var(--font-body)",
            fontSize: '13px',
            lineHeight: 1.5,
            color: 'var(--dusk-text-dim)',
            padding: '4px 0',
          }}
        >
          Top {(100 - percentile).toFixed(0)}%
        </div>
      )}
    </>
  );
}

/**
 * Loading skeleton
 */
function LoadingSkeleton() {
  return (
    <div style={{ padding: '8px' }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 8px',
            opacity: 0.5,
          }}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              background: 'var(--dusk-panel-2)',
            }}
          />
          <div
            style={{
              flex: 1,
              height: '12px',
              background: 'var(--dusk-panel-2)',
            }}
          />
          <div
            style={{
              width: '40px',
              height: '12px',
              background: 'var(--dusk-panel-2)',
            }}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Main Leaderboard component
 */
export function Leaderboard() {
  const { top10, userRank, userPercentile, totalUsers, isLoading, error } = useLeaderboard();

  // Check if user is already in top 10
  const userInTop10 = top10.some((entry) => entry.isCurrentUser);

  return (
    <div
      className="pixel-inventory-bg"
      style={{
        padding: '12px',
        minWidth: '200px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: '2px solid var(--dusk-line)',
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: '10px',
            color: 'var(--amber)',
            textShadow: '2px 2px 0 var(--amber-dark)',
          }}
        >
          LEADERBOARD
        </span>
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: '13px',
            lineHeight: 1.5,
            color: 'var(--dusk-text-dim)',
          }}
        >
          {totalUsers} miners
        </span>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: '13px',
            lineHeight: 1.5,
            color: 'var(--ember)',
            textAlign: 'center',
            padding: '16px',
          }}
        >
          {error}
        </div>
      ) : top10.length === 0 ? (
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: '13px',
            lineHeight: 1.5,
            color: 'var(--dusk-text-dim)',
            textAlign: 'center',
            padding: '16px',
          }}
        >
          No miners yet
        </div>
      ) : (
        <>
          {/* Top 10 list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {top10.map((entry) => (
              <LeaderboardRow key={entry.wallet} entry={entry} />
            ))}
          </div>

          {/* User rank if not in top 10 */}
          {!userInTop10 && userRank && (
            <UserRankRow userRank={userRank} percentile={userPercentile} />
          )}
        </>
      )}
    </div>
  );
}
