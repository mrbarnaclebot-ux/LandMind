/**
 * WorldRail — the unified, collapsible left HUD rail.
 *
 * Wraps the four World-system widgets (PhaseClock + WeatherForecast + VeinStrip
 * + GoldRushStrip + ContractCard) into one cohesive fixed-width column with a
 * single bevel treatment and a shared 8px vertical rhythm.
 *
 * Collapse behaviour:
 *  - A slim 'WORLD' toggle tab (chevron) collapses the whole stack down to a
 *    compact strip: phase icon + live countdown + alert dots (one per active
 *    system) so the 3D world can breathe.
 *  - Expanded by default on desktop, COLLAPSED by default on mobile
 *    (controlled by `defaultCollapsed`).
 *
 * Reads worldStore / contractStore reactively for the collapsed summary. The
 * expanded body simply renders the existing section widgets — which own their
 * own store subscriptions — normalized to the rail width via worldRail.css.
 */
import { FC, ReactNode, useEffect, useRef, useState } from 'react';
import { useWorldStore } from '../../stores/worldStore';
import { useContractStore } from '../../stores/contractStore';
import {
  PHASE_DURATIONS,
  phaseAtCycleT,
} from '../../stores/worldStore';
import { PHASE_META } from '../../scene/worldPhases';
import { frontFade } from '../../scene/weather';
import './worldRail.css';

/** mm:ss from a millisecond duration (clamped at 0). */
function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface WorldRailProps {
  /** Section widgets to render in the expanded body. */
  children: ReactNode;
  /** Start collapsed (true on mobile, false on desktop). */
  defaultCollapsed?: boolean;
}

/**
 * Compact summary shown when the rail is collapsed: phase icon + countdown +
 * one alert dot per active World system.
 */
const CollapsedSummary: FC = () => {
  const ready = useWorldStore((s) => s.ready);
  const phase = useWorldStore((s) => s.phase);
  const nextPhaseAt = useWorldStore((s) => s.nextPhaseAt);
  const fronts = useWorldStore((s) => s.fronts);
  const veins = useWorldStore((s) => s.veins);
  const goldrush = useWorldStore((s) => s.goldrush);
  const contract = useContractStore((s) => s.contract);

  const [countdown, setCountdown] = useState('--:--');
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      if (nextPhaseAt > now) {
        setCountdown(fmtCountdown(nextPhaseAt - now));
      } else {
        const cycleT = useWorldStore.getState().getSmoothCycleT();
        const derived = phaseAtCycleT(cycleT);
        const dur = PHASE_DURATIONS[derived.phase];
        const remainSec = dur * (1 - derived.phaseProgress);
        setCountdown(fmtCountdown(remainSec * 1000));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [nextPhaseAt]);

  if (!ready) return null;

  const meta = PHASE_META[phase];
  const now = Date.now();
  const hasWeather = fronts.some((f) => frontFade(f, now) > 0);
  const hasVein = veins.some((v) => v.expiresAt > now);
  const hasGoldRush = Boolean(goldrush?.active);
  const contractDone = Boolean(contract?.completed);
  const hasContract = Boolean(contract);

  return (
    <div className="world-rail__mini">
      <span className="world-rail__mini-icon" style={{ color: meta.accentVar }}>
        {meta.icon}
      </span>
      <span className="world-rail__mini-countdown">{countdown}</span>
      <div className="world-rail__dots" aria-hidden>
        {hasWeather && (
          <span className="world-rail__dot world-rail__dot--weather" title="Active weather front" />
        )}
        {hasVein && (
          <span className="world-rail__dot world-rail__dot--vein" title="Active rich vein" />
        )}
        {hasGoldRush && (
          <span className="world-rail__dot world-rail__dot--goldrush" title="Gold Rush active" />
        )}
        {hasContract && (
          <span
            className={`world-rail__dot ${contractDone ? 'world-rail__dot--contract-done' : 'world-rail__dot--contract'}`}
            title={contractDone ? 'Daily contract complete' : 'Daily contract in progress'}
          />
        )}
      </div>
    </div>
  );
};

export const WorldRail: FC<WorldRailProps> = ({ children, defaultCollapsed = false }) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className={`world-rail${collapsed ? ' world-rail--collapsed' : ''}`}>
      <button
        type="button"
        className="world-rail__toggle"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        title={collapsed ? 'Expand world panel' : 'Collapse world panel'}
      >
        <span className="world-rail__toggle-label">WORLD</span>
        <span className="world-rail__chevron" aria-hidden>
          {collapsed ? '▸' : '▾'}
        </span>
      </button>

      {collapsed ? <CollapsedSummary /> : <div className="world-rail__body">{children}</div>}
    </div>
  );
};

export default WorldRail;
