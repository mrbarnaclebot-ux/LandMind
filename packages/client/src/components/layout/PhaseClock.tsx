/**
 * PhaseClock — HUD widget for the World Clock (System 1).
 *
 * Small pixel-style widget (dusk tokens, no gradients/glass):
 *  - phase icon + name (Press Start 2P for the phase NAME only; Manrope body)
 *  - a thin 5-segment progress bar (one segment per phase) with a marker at the
 *    current cycle position
 *  - countdown to the next phase
 *  - the active yield modifier line (amber for golden hour, split line at night)
 *  - click → popover with the full published modifier table
 *  - golden-hour flourish: the widget pulses amber (hard-stepped, per anti-slop)
 *    and fires a one-shot toast when the phase ENTERS golden_hour
 *
 * Reads worldStore reactively. Uses a rAF tick for the smooth progress marker
 * and the live countdown (store fields update only every ~5s).
 */
import { FC, useEffect, useRef, useState } from 'react';
import { useWorldStore } from '../../stores/worldStore';
import {
  PHASE_ORDER,
  PHASE_DURATIONS,
  CYCLE_SECONDS,
  phaseAtCycleT,
} from '../../stores/worldStore';
import { PHASE_META } from '../../scene/worldPhases';
import type { WorldPhase, WorldModifiers, HazardTable } from '../../lib/socketTypes';
import './phaseClock.css';

/** Lamports → a compact SOL string (1 SOL = 1e9 lamports). */
function lamportsToSol(lamports: number): string {
  const sol = lamports / 1e9;
  // Trim trailing zeros: 0.005, 0.003, etc.
  return `${parseFloat(sol.toFixed(4))} SOL`;
}

/** mm:ss from a millisecond duration (clamped at 0). */
function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Human modifier line for the current phase. */
function modifierLine(phase: WorldPhase, mods: WorldModifiers): {
  text: string;
  accent: string;
} {
  if (phase === 'golden_hour') {
    return { text: `GOLDEN HOUR ×${mods.surface.toFixed(2).replace(/0$/, '')}`, accent: 'var(--amber)' };
  }
  if (phase === 'night') {
    return {
      text: `NIGHT — DEEP ×${mods.deep} / SURFACE ×${mods.surface}`,
      accent: 'var(--teal)',
    };
  }
  // Dawn ramps; day/dusk are neutral.
  if (mods.surface === 1 && mods.deep === 1) {
    return { text: `${PHASE_META[phase].label} ×1.0`, accent: 'var(--dusk-text-dim)' };
  }
  return {
    text: `${PHASE_META[phase].label} ×${mods.surface}`,
    accent: 'var(--amber-light)',
  };
}

interface PhaseClockProps {
  /** Fired once when the phase transitions INTO golden_hour (for the toast). */
  onEnterGoldenHour?: () => void;
}

export const PhaseClock: FC<PhaseClockProps> = ({ onEnterGoldenHour }) => {
  const ready = useWorldStore((s) => s.ready);
  const phase = useWorldStore((s) => s.phase);
  const modifiers = useWorldStore((s) => s.modifiers);
  const nextPhaseAt = useWorldStore((s) => s.nextPhaseAt);
  const table = useWorldStore((s) => s.table);
  const hazardTable = useWorldStore((s) => s.hazardTable);

  const [open, setOpen] = useState(false);
  const [pulsing, setPulsing] = useState(false);

  // Smooth marker position (0–1 across the whole cycle) + live countdown text.
  const [markerPct, setMarkerPct] = useState(0);
  const [countdown, setCountdown] = useState('--:--');
  const rafRef = useRef<number | null>(null);

  // One-shot golden-hour flourish on phase ENTER.
  const prevPhase = useRef<WorldPhase | null>(null);
  useEffect(() => {
    if (prevPhase.current !== null && prevPhase.current !== 'golden_hour' && phase === 'golden_hour') {
      setPulsing(true);
      onEnterGoldenHour?.();
      const id = window.setTimeout(() => setPulsing(false), 2400);
      prevPhase.current = phase;
      return () => window.clearTimeout(id);
    }
    prevPhase.current = phase;
  }, [phase, onEnterGoldenHour]);

  // rAF loop for the smooth marker + countdown (driven off the smooth clock).
  useEffect(() => {
    const tick = () => {
      const cycleT = useWorldStore.getState().getSmoothCycleT();
      setMarkerPct(cycleT * 100);

      // Countdown: prefer the authoritative nextPhaseAt; fall back to the
      // locally-derived phase-end when the server hasn't sent one yet.
      const now = Date.now();
      if (nextPhaseAt > now) {
        setCountdown(fmtCountdown(nextPhaseAt - now));
      } else {
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
  const mod = modifierLine(phase, modifiers);

  return (
    <div className={`phase-clock${pulsing ? ' phase-clock--golden' : ''}`}>
      {/* Header: icon + phase name (pixel font) + countdown */}
      <button
        type="button"
        className="phase-clock__head"
        onClick={() => setOpen((v) => !v)}
        title="Yield modifier table"
      >
        <span className="phase-clock__icon" style={{ color: meta.accentVar }}>
          {meta.icon}
        </span>
        <span className="phase-clock__name">{meta.label}</span>
        <span className="phase-clock__countdown">
          {countdown}
          <span className="phase-clock__countdown-label"> to next</span>
        </span>
      </button>

      {/* Segmented progress bar (5 phases) with a marker at the cycle position */}
      <div className="phase-clock__bar" aria-hidden>
        {PHASE_ORDER.map((p) => {
          const widthPct = (PHASE_DURATIONS[p] / CYCLE_SECONDS) * 100;
          const active = p === phase;
          return (
            <div
              key={p}
              className={`phase-clock__seg${active ? ' phase-clock__seg--active' : ''}`}
              style={{ width: `${widthPct}%` }}
              title={PHASE_META[p].label}
            />
          );
        })}
        <div className="phase-clock__marker" style={{ left: `${markerPct}%` }} />
      </div>

      {/* Active modifier line */}
      <div className="phase-clock__mod" style={{ color: mod.accent }}>
        {mod.text}
      </div>

      {/* Modifier table popover */}
      {open && (
        <ModifierPopover
          table={table}
          hazardTable={hazardTable}
          activePhase={phase}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
};

/** Popover listing the published modifier table (all phases) + hazard odds. */
const ModifierPopover: FC<{
  table: Record<string, unknown>;
  hazardTable: HazardTable;
  activePhase: WorldPhase;
  onClose: () => void;
}> = ({ table, hazardTable, activePhase, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="phase-clock__popover pixel-dropdown">
      <div className="phase-clock__popover-title">YIELD MODIFIERS</div>
      <table className="phase-clock__table">
        <thead>
          <tr>
            <th>PHASE</th>
            <th>SURFACE</th>
            <th>DEEP</th>
          </tr>
        </thead>
        <tbody>
          {PHASE_ORDER.map((p) => {
            const row = table[p] as WorldModifiers | undefined;
            const surface = row ? row.surface : 1;
            const deep = row ? row.deep : 1;
            return (
              <tr key={p} className={p === activePhase ? 'phase-clock__table-active' : ''}>
                <td>
                  <span style={{ color: PHASE_META[p].accentVar, marginRight: 4 }}>
                    {PHASE_META[p].icon}
                  </span>
                  {PHASE_META[p].label}
                </td>
                <td>×{surface}</td>
                <td>×{deep}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* HAZARDS section (System 3) — compact published odds, no drama. */}
      <HazardSection hazardTable={hazardTable} />

      <div className="phase-clock__popover-foot">Published odds · server-authoritative</div>
    </div>
  );
};

/** Compact hazard-odds table (System 3): deep bonus, cave-in, self-dig, sinks. */
const HazardSection: FC<{ hazardTable: HazardTable }> = ({ hazardTable }) => {
  const c = hazardTable?.caveIn;
  const w = hazardTable?.wear;
  if (!c || !w) return null;

  const basePct = (c.baseChancePerHour * 100).toFixed(1).replace(/\.0$/, '');
  const emberPct = (c.baseChancePerHour * c.emberMultiplier * 100).toFixed(1).replace(/\.0$/, '');
  const floorPct = Math.round(w.efficiencyFloor * 100);

  return (
    <>
      <div className="phase-clock__popover-subtitle">HAZARDS</div>
      <table className="phase-clock__table">
        <tbody>
          <tr>
            <td>Deep deploy bonus</td>
            <td style={{ color: 'var(--teal)' }}>×{c.deepYieldBonus}</td>
          </tr>
          <tr>
            <td>Cave-in / hr</td>
            <td>
              {basePct}%
              <span style={{ color: 'var(--ember)' }}> · ember {emberPct}%</span>
            </td>
          </tr>
          <tr>
            <td>Self-dig timer</td>
            <td>{c.selfDigHours}h</td>
          </tr>
          <tr>
            <td>Rescue fee</td>
            <td>{lamportsToSol(c.rescueCostLamports)}</td>
          </tr>
          <tr>
            <td>Repair fee</td>
            <td>{lamportsToSol(w.repairCostLamports)}</td>
          </tr>
          <tr>
            <td>Wear floor</td>
            <td>{floorPct}% over {w.fullWearMiningDays}d</td>
          </tr>
        </tbody>
      </table>
    </>
  );
};

export default PhaseClock;
