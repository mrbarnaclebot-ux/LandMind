/**
 * ContractCard — HUD panel for System 4 daily contracts.
 *
 * A collapsible panel stacked in the HUD column under VeinStrip. Shows:
 *   - 'DAILY CONTRACT' title + streak flame counter ('🔥 4')
 *   - the contract description ('MINE 600 GOLD')
 *   - a segmented progress bar (progress/target) + a numeric readout
 *   - when completed: an amber 'COMPLETE ×1.1 UNTIL 00:00 UTC' banner and the
 *     whole card flips to the completed frame.
 *
 * Reads contractStore reactively. Only renders when authenticated AND a contract
 * has loaded (the store is null pre-auth). Dusk tokens, flat + hard bevel only.
 */
import { FC, useMemo } from 'react';
import { useContractStore } from '../../stores/contractStore';
import './contractCard.css';

/** Parse a decimal string to a finite number (0 on garbage). */
function num(s: string | undefined): number {
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Compact grouping for the numeric readout (600 → '600', 42100 → '42,100'). */
function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

const SEGMENTS = 12;

export const ContractCard: FC = () => {
  const contract = useContractStore((s) => s.contract);
  const streak = useContractStore((s) => s.streak);

  const { pct, filledSegs, cur, target, completed } = useMemo(() => {
    const cur = num(contract?.progress);
    const target = num(contract?.target);
    const ratio = target > 0 ? Math.min(1, cur / target) : contract?.completed ? 1 : 0;
    return {
      pct: ratio,
      filledSegs: Math.round(ratio * SEGMENTS),
      cur,
      target,
      completed: Boolean(contract?.completed) || ratio >= 1,
    };
  }, [contract]);

  if (!contract) return null;

  const boost = contract.reward?.yieldBoost ?? 1.1;

  return (
    <div className={`contract-card${completed ? ' contract-card--done' : ''}`}>
      <div className="contract-card__head">
        <span className="contract-card__title">DAILY CONTRACT</span>
        {streak > 0 && (
          <span className="contract-card__streak" title={`Resume-not-reset streak: ${streak}`}>
            <span className="contract-card__flame" aria-hidden>
              🔥
            </span>
            STREAK {streak}
          </span>
        )}
      </div>

      <div className="contract-card__desc">{contract.description}</div>

      <div className="contract-card__bar" aria-hidden>
        {Array.from({ length: SEGMENTS }).map((_, i) => {
          const on = i < filledSegs;
          const cls = completed
            ? 'contract-card__seg contract-card__seg--done'
            : on
              ? 'contract-card__seg contract-card__seg--filled'
              : 'contract-card__seg';
          return <div key={i} className={cls} />;
        })}
      </div>

      {!completed && (
        <div className="contract-card__nums">
          <span className="contract-card__nums-cur">{fmt(cur)}</span> / {fmt(target)}{' '}
          {contract.resourceType} · {Math.round(pct * 100)}%
        </div>
      )}

      {completed && (
        <div className="contract-card__complete">
          COMPLETE ×{boost} UNTIL 00:00 UTC
        </div>
      )}
    </div>
  );
};

export default ContractCard;
