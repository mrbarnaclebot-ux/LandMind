/**
 * GoldRushStrip — HUD strip for System 4 Gold Rush community events.
 *
 * Prominent (but not screen-takeover) strip in the HUD column. Two states:
 *   - RACING (achieved=false): 'GOLD RUSH — community: 42,100 / 100,000 SILVER'
 *     with a thick amber segmented progress bar + a mm:ss-to-close timer.
 *   - BOOST (achieved=true): flips to '×1.15 BOOST — 1:42:10 left' with a
 *     countdown to boostUntil and a full amber frame.
 *
 * Renders only while goldrush.active. Reads worldStore.goldrush reactively and
 * ticks every second for the countdown. Dusk tokens, flat + hard bevel only.
 * The achieved celebration toast is fired by useWorldClock, not here.
 */
import { FC, useEffect, useMemo, useState } from 'react';
import { useWorldStore } from '../../stores/worldStore';
import './contractCard.css';

/** Parse a decimal string to a finite number (0 on garbage). */
function num(s: string | undefined): number {
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** h:mm:ss (or m:ss under an hour) from a ms duration, clamped at 0. */
function fmtDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const SEGMENTS = 16;

export const GoldRushStrip: FC = () => {
  const goldrush = useWorldStore((s) => s.goldrush);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const filledSegs = useMemo(() => {
    if (!goldrush) return 0;
    const cur = num(goldrush.progress);
    const target = num(goldrush.target);
    const ratio = target > 0 ? Math.min(1, cur / target) : goldrush.achieved ? 1 : 0;
    return Math.round(ratio * SEGMENTS);
  }, [goldrush]);

  if (!goldrush || !goldrush.active) return null;

  const boostActive = goldrush.achieved && goldrush.boostUntil != null && goldrush.boostUntil > now;
  const cur = num(goldrush.progress);
  const target = num(goldrush.target);
  const resource = (goldrush.resourceType || 'ORE').toUpperCase();

  return (
    <div className={`goldrush-strip${boostActive ? ' goldrush-strip--boost' : ''}`}>
      <div className="goldrush-strip__head">
        <span className="goldrush-strip__title">GOLD RUSH</span>
        <span className="goldrush-strip__timer">
          {boostActive
            ? `${fmtDuration((goldrush.boostUntil ?? now) - now)} left`
            : `${fmtDuration(goldrush.endsAt - now)} left`}
        </span>
      </div>

      {boostActive ? (
        <div className="goldrush-strip__boost">✦ ×1.15 BOOST ACTIVE</div>
      ) : (
        <>
          <div className="goldrush-strip__community">
            community: <strong>{Math.round(cur).toLocaleString()}</strong> /{' '}
            {Math.round(target).toLocaleString()} {resource}
          </div>
          <div className="goldrush-strip__bar" aria-hidden>
            {Array.from({ length: SEGMENTS }).map((_, i) => (
              <div
                key={i}
                className={
                  i < filledSegs
                    ? 'goldrush-strip__seg goldrush-strip__seg--filled'
                    : 'goldrush-strip__seg'
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default GoldRushStrip;
