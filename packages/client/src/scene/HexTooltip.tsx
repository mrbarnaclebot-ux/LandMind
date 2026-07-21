/**
 * HexTooltip - Shows resource info on hex hover
 * Uses Drei Html for 3D-projected tooltip
 *
 * System 4 (prospecting): the tooltip is the survey surface. Un-surveyed hexes
 * hide the resource amount behind '??? — SURVEY to reveal'; once a hex is
 * surveyed (durable, via contractStore.surveys) the tooltip shows the full
 * revealed data (amount remaining, biome, DEEP tag, agent count) permanently and
 * gets a subtle teal corner-tick. Survey is triggered by the in-tooltip SURVEY
 * button or the S key while hovering. Relocation MOVE mode takes precedence — no
 * survey while placing an agent.
 */
import { FC, useState, useCallback, useEffect, useRef } from 'react';
import { Html } from '@react-three/drei';
import { ThreeEvent } from '@react-three/fiber';
import {
  pixelToHex,
  hexToPixel,
  ELEVATION_STEP,
  HEX_TILE_HEIGHT,
  WATER_LEVEL_Y,
} from '../hex/hexMath';
import { useHexStore, type ResourceType } from '../stores/hexStore';
import { useAgentStore } from '../stores/agentStore';
import { useRelocationStore } from '../stores/relocationStore';
import { useWorldStore } from '../stores/worldStore';
import { useContractStore } from '../stores/contractStore';
import { useWalletStore } from '../stores/walletStore';
import { useTransactionStore } from '../stores/transactionStore';
import { surveyHex, SurveyError } from '../lib/contracts';
import { isDeepHex } from '../terrain/deepHexes';
import type { Biome } from '../terrain/biomes';
import type { SurveyedHex } from '../lib/socketTypes';
import '../styles/pixel-theme.css';

interface HexInfo {
  q: number;
  r: number;
  position: [number, number, number];
  biome?: Biome;
  resourceType?: ResourceType;
  resourceAmount?: number;
  agentCount?: number;
  elevation?: number;
}

interface HexTooltipProps {
  visible: boolean;
  hexInfo: HexInfo | null;
  /** True when this tooltip is pinned open (click-to-pin). Shows the X close
   *  button and an amber accent, and stays open regardless of hover. */
  pinned?: boolean;
  /** Unpin request (X button / ESC handled upstream). No-op when not pinned. */
  onUnpin?: () => void;
  /** Pointer entered the tooltip panel — cancels the pending hide and freezes
   *  the hovered hex (no in-place swap while the cursor is over the panel). */
  onPanelEnter?: () => void;
  /** Pointer left the tooltip panel — resumes normal hover + grace behaviour. */
  onPanelLeave?: () => void;
  /** Reports the panel's live screen rect so the hover hook can build a
   *  "corridor" between the last hex and the panel and suppress swaps while the
   *  pointer travels toward the SURVEY button. */
  onPanelRect?: (rect: DOMRect | null) => void;
}

// Resource display config
const resourceConfig: Record<ResourceType, { color: string; name: string; icon: string }> = {
  GOLD: { color: '#FFD700', name: 'GOLD', icon: 'Au' },
  SILVER: { color: '#C0C0C0', name: 'SILVER', icon: 'Ag' },
  COPPER: { color: '#B87333', name: 'COPPER', icon: 'Cu' },
  IRON: { color: '#708090', name: 'IRON', icon: 'Fe' },
  NONE: { color: '#808080', name: 'EMPTY', icon: '--' },
};

// Biome display names
const biomeNames: Record<Biome, string> = {
  grassland: 'GRASSLAND',
  marsh: 'WETLANDS',
  plains: 'PLAINS',
  forest: 'FOREST',
  rocky: 'ROCKY',
  alpine: 'ALPINE',
};

// Biome colors for label
const biomeColors: Record<Biome, string> = {
  grassland: '#7CFC00',
  marsh: '#00CED1',
  plains: '#F4D03F',
  forest: '#228B22',
  rocky: '#CD853F',
  alpine: '#E8E8FF',
};

// Elevation tier names. Terrain tiers run 0..TIER_MAX (currently 6), so a flat
// 3-entry array would render `undefined` for tall columns. Bucket the full range
// into readable bands and clamp defensively.
const elevationNames = ['WATER', 'SHORE', 'LOW', 'MID', 'HIGH', 'ALPINE', 'PEAK'];
function elevationLabel(tier: number): string {
  const i = Math.max(0, Math.min(elevationNames.length - 1, Math.round(tier)));
  return elevationNames[i];
}

/**
 * World-space Y of a hex column's top face, used to anchor the tooltip so it
 * sits just above the actual terrain regardless of stepped elevation. Water
 * (tier 0) has no raised column — anchor to the water surface instead of the
 * (non-existent) column top so the tooltip doesn't float or bury.
 */
function hexTopY(elevation: number | undefined): number {
  const tier = elevation ?? 0;
  if (tier <= 0) return WATER_LEVEL_Y + 0.9;
  return tier * ELEVATION_STEP + HEX_TILE_HEIGHT + 0.9;
}

/** mm:ss from a millisecond duration (clamped at 0). */
function fmtCooldown(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Submit a survey for (q,r). Success → toast + add to the durable survey store.
 * 429 cooldown → mm:ss toast. Other errors → generic toast. Guards against
 * double-submits via a module-level in-flight flag (the S key can repeat).
 */
let surveyInFlight = false;
async function submitSurvey(q: number, r: number): Promise<void> {
  if (surveyInFlight) return;
  if (!useWalletStore.getState().isAuthenticated) {
    useTransactionStore.getState().addToast({
      type: 'info',
      title: 'CONNECT TO SURVEY',
      message: 'Connect a wallet to prospect hexes',
      // Inherits central info default (6500ms).
    });
    return;
  }
  // Already surveyed? No-op with a gentle note.
  if (useContractStore.getState().getSurvey(q, r)) return;

  surveyInFlight = true;
  const toasts = useTransactionStore.getState();
  try {
    const { hex } = await surveyHex(q, r);
    useContractStore.getState().addSurvey(hex);
    toasts.addToast({
      type: 'success',
      title: 'HEX SURVEYED',
      message: `(${hex.q}, ${hex.r}) — ${Number(hex.resourceAmount).toLocaleString()} ${hex.resourceType} remaining`,
      // Inherits central success default (6500ms).
    });
  } catch (err) {
    if (err instanceof SurveyError && err.status === 429 && err.retryAfterMs != null) {
      toasts.addToast({
        type: 'warning',
        title: 'SURVEY ON COOLDOWN',
        message: `Ready in ${fmtCooldown(err.retryAfterMs)}`,
        // Inherits central warning default (8000ms).
      });
    } else {
      toasts.addToast({
        type: 'error',
        title: 'SURVEY FAILED',
        message: err instanceof Error ? err.message : 'Survey failed',
        // Inherits central error default (10000ms).
      });
    }
  } finally {
    surveyInFlight = false;
  }
}

export const HexTooltip: FC<HexTooltipProps> = ({
  visible,
  hexInfo,
  pinned = false,
  onUnpin,
  onPanelEnter,
  onPanelLeave,
  onPanelRect,
}) => {
  // Relocation MOVE mode: when placing an agent, surface the DEEP risk/reward
  // of the hovered hex so the choice is informed. Deep = pit floor / cave-
  // adjacent (deterministic from the terrain gen). Hooks run unconditionally.
  const inMoveMode = useRelocationStore((s) => s.activeAgentId !== null);
  const deepBonus = useWorldStore((s) => s.hazardTable?.caveIn?.deepYieldBonus ?? 1.25);
  // Durable survey knowledge for the hovered hex (null until surveyed).
  const surveyForHex = useContractStore((s) =>
    hexInfo ? s.getSurvey(hexInfo.q, hexInfo.r) : null,
  );

  // The panel DOM node — measured each frame the tooltip is visible so the hover
  // hook can compute the "corridor" between the last hex and the panel. drei's
  // <Html> re-projects the wrapper every frame; we resample on rAF so the rect
  // stays fresh under camera motion without leaning on a private drei API.
  const panelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!visible || !hexInfo || inMoveMode) {
      onPanelRect?.(null);
      return;
    }
    let raf = 0;
    const tick = () => {
      const el = panelRef.current;
      if (el) onPanelRect?.(el.getBoundingClientRect());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      onPanelRect?.(null);
    };
  }, [visible, hexInfo, inMoveMode, onPanelRect]);

  // ESC unpins a pinned tooltip (only meaningful while pinned and not moving).
  useEffect(() => {
    if (!pinned || inMoveMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onUnpin?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pinned, inMoveMode, onUnpin]);

  // S-key survey while hovering (relocation MOVE mode takes precedence). We read
  // the hovered hex + mode off the store at keypress time so the listener is set
  // up once and doesn't churn per-hover.
  useEffect(() => {
    if (!visible || !hexInfo || inMoveMode) return;
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing in an input / when a modifier is held.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        void submitSurvey(hexInfo.q, hexInfo.r);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, hexInfo, inMoveMode]);

  if (!visible || !hexInfo) return null;

  const surveyed: SurveyedHex | null = surveyForHex;
  // Prefer surveyed (server-authoritative) data when available.
  const resourceTypeCode = (surveyed?.resourceType as ResourceType) ?? hexInfo.resourceType;
  const resource = resourceTypeCode ? resourceConfig[resourceTypeCode] : null;
  // Only compute the deep lookup while actually placing (cheap + cached anyway).
  const deepFromHex = isDeepHex(hexInfo.q, hexInfo.r);
  const showDeepPlacing = inMoveMode && deepFromHex;
  // Show a DEEP tag from surveyed data too (durable knowledge, any time).
  const showDeepSurveyed = !inMoveMode && surveyed?.isDeep === true;
  const agentCount = surveyed?.agentCount ?? hexInfo.agentCount;
  const canSurvey = !inMoveMode && !surveyed;

  return (
    <Html
      // Anchor to the hex column's actual top face (stepped elevation aware) so
      // the tooltip sits just above the terrain instead of a fixed y=1.5 that
      // floats over short columns and buries into tall ones.
      position={hexInfo.position}
      // Screen-project (not transform): the panel keeps a constant on-screen
      // size and a small upward offset, so it stays legible and doesn't jitter /
      // scale with camera dolly. `center` + zIndexRange keeps it above the hex
      // and pinned within the WebGL overlay stack (never pops behind other Html).
      center
      zIndexRange={[100, 0]}
      // No occlusion test — the tooltip must never flicker when the hex column
      // edge crosses in front of its anchor point during camera motion.
      occlude={false}
      // Constant screen offset above the anchor so the box clears the hovered
      // hex without covering it. The wrapper stays pointer-transparent; only the
      // inner panel opts back into pointer events so hover elsewhere is unaffected
      // but the SURVEY button / X are clickable and the panel is hover-safe.
      style={{
        pointerEvents: 'none',
        transform: 'translateY(-14px)',
        willChange: 'transform',
      }}
    >
      <div
        ref={panelRef}
        className="pixel-inventory-panel"
        // Hover-safe panel: entering it cancels any pending hide and freezes the
        // hex (no in-place swap); leaving resumes normal hover + grace. Clicks are
        // stopped so pinning a hex via the panel never leaks through to the ground
        // plane (relocation picks / camera drag).
        onPointerEnter={onPanelEnter}
        onPointerLeave={onPanelLeave}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          padding: '10px 14px',
          fontFamily: 'var(--font-body)',
          fontSize: '13px',
          lineHeight: 1.5,
          color: 'var(--dusk-text)',
          minWidth: '140px',
          // The panel itself is interactive (hover-safe + clickable button).
          pointerEvents: 'auto',
          // Pinned accent: amber border so the "stuck open" state reads clearly.
          ...(pinned
            ? { boxShadow: 'inset 0 0 0 2px var(--amber)' }
            : null),
        }}
      >
        {/* Pinned close (X) — top-right, only when pinned. Generous 24px hit area,
            stops propagation so it never triggers a ground pick. */}
        {pinned && (
          <button
            type="button"
            aria-label="Unpin tooltip"
            title="Unpin (Esc)"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onUnpin?.();
            }}
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              fontWeight: 700,
              lineHeight: 1,
              color: 'var(--dusk-on-amber)',
              background: 'var(--amber)',
              border: 'none',
              cursor: 'pointer',
              pointerEvents: 'auto',
              boxShadow:
                'inset 1px 1px 0 0 var(--amber-light), inset -1px -1px 0 0 var(--amber-dark)',
            }}
          >
            ×
          </button>
        )}

        {/* Surveyed corner-tick — subtle teal marker (top-right). Hidden when
            pinned so it doesn't collide with the X close button in that corner. */}
        {surveyed && !pinned && (
          <span
            title="Surveyed"
            aria-hidden
            style={{
              position: 'absolute',
              top: '3px',
              right: '3px',
              width: 0,
              height: 0,
              borderTop: '8px solid var(--teal)',
              borderLeft: '8px solid transparent',
            }}
          />
        )}

        {/* Coordinates */}
        <div style={{ marginBottom: '8px', color: 'var(--dusk-text-dim)', fontSize: '12px' }}>
          HEX ({hexInfo.q}, {hexInfo.r})
        </div>

        {/* DEEP risk/reward tag — while placing (relocation MOVE mode), OR from
            durable surveyed knowledge. Amber, hard pixel bevel, matte (no bloom). */}
        {(showDeepPlacing || showDeepSurveyed) && (
          <div
            style={{
              display: 'inline-block',
              marginBottom: '8px',
              padding: '2px 6px',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.03em',
              color: 'var(--dusk-on-amber)',
              background: 'var(--amber)',
              boxShadow:
                'inset 1px 1px 0 0 var(--amber-light), inset -1px -1px 0 0 var(--amber-dark)',
            }}
          >
            DEEP ×{deepBonus} · cave-in risk
          </div>
        )}

        {/* Biome */}
        {hexInfo.biome && (
          <div style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                background: biomeColors[hexInfo.biome],
                display: 'inline-block',
                boxShadow: 'inset -1px -1px 0 rgba(14,16,26,0.4)',
              }}
            />
            <span style={{ color: biomeColors[hexInfo.biome] }}>
              {biomeNames[hexInfo.biome]}
            </span>
          </div>
        )}

        {/* Elevation */}
        {hexInfo.elevation !== undefined && (
          <div style={{ marginBottom: '6px', color: 'var(--dusk-text-dim)', fontSize: '12px' }}>
            ELEV: {elevationLabel(hexInfo.elevation)}
          </div>
        )}

        <div className="pixel-divider" style={{ margin: '6px 0' }} />

        {/* Resource */}
        {resource && resourceTypeCode !== 'NONE' && (
          <>
            <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  color: resource.color,
                  fontWeight: 'bold',
                  textShadow: `1px 1px 0 rgba(14,16,26,0.6)`,
                }}
              >
                [{resource.icon}]
              </span>
              <span style={{ color: resource.color }}>{resource.name}</span>
            </div>

            {/* Amount — hidden until surveyed. */}
            {surveyed ? (
              <div style={{ marginBottom: '4px', color: 'var(--amber)', fontSize: '12px' }}>
                {Number(surveyed.resourceAmount).toLocaleString()} remaining
              </div>
            ) : (
              <div style={{ marginBottom: '4px', color: 'var(--dusk-text-faint)', fontSize: '12px' }}>
                ??? — SURVEY to reveal
              </div>
            )}
          </>
        )}

        {/* No resource */}
        {(!resource || resourceTypeCode === 'NONE') && (
          <div style={{ color: 'var(--dusk-text-faint)', fontSize: '12px' }}>
            NO RESOURCES
          </div>
        )}

        {/* Agents mining */}
        {agentCount !== undefined && agentCount > 0 && (
          <div
            style={{
              marginTop: '6px',
              padding: '4px 6px',
              background: 'rgba(63, 182, 168, 0.18)',
              color: 'var(--teal)',
              fontSize: '12px',
            }}
          >
            {agentCount} AGENT{agentCount > 1 ? 'S' : ''} MINING
          </div>
        )}

        {/* SURVEY button / hint — only when not in MOVE mode and not yet surveyed.
            pointer-events re-enabled on the button itself (the panel is none). */}
        {canSurvey && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void submitSurvey(hexInfo.q, hexInfo.r);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              marginTop: '8px',
              width: '100%',
              minHeight: '32px',
              padding: '6px 8px',
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: 'var(--dusk-on-amber)',
              background: 'var(--teal)',
              border: 'none',
              cursor: 'pointer',
              pointerEvents: 'auto',
              boxShadow:
                'inset 1px 1px 0 0 var(--teal-light), inset -1px -1px 0 0 var(--teal-dark)',
            }}
          >
            SURVEY <span style={{ opacity: 0.75, fontWeight: 400 }}>(press S)</span>
          </button>
        )}
      </div>
    </Html>
  );
};

/** Delay (ms) before a tooltip first appears — hover-intent so a fast sweep
 *  across the map doesn't flash a trail of boxes. Swapping between hexes once a
 *  tooltip is already open is instant (content updates in place). */
const HOVER_INTENT_MS = 60;

/** Grace period (ms) before hiding on pointer-leave. Moving the cursor off the
 *  ground plane and onto the tooltip's own DOM (the SURVEY button) fires a
 *  ground `pointerleave`; without a grace window the tooltip would unmount out
 *  from under the click. A re-enter (back onto a hex) — or a pointerenter on the
 *  panel itself — cancels the pending hide. Raised to 250ms so the cursor has
 *  time to traverse the gap between the hex and the button (corridor tolerance).*/
const HIDE_GRACE_MS = 250;

/** Padding (px) added around the panel's screen rect when testing whether the
 *  pointer is travelling *toward* the panel. While the pointer sits inside this
 *  expanded corridor we suppress in-place content swaps, so crossing intermediate
 *  hexes on the way to the SURVEY button doesn't steal the tooltip. Kept modest
 *  so roaming the open map still swaps instantly. */
const CORRIDOR_PAD_PX = 48;

/**
 * Hook to track hovered hex with full data from store.
 *
 * Glitch fixes:
 *  - Same-hex short-circuit: pointermove fires many times per hex; we only
 *    setState when the resolved (q,r) actually changes, killing per-move
 *    re-render churn and flicker.
 *  - Elevation-correct anchor: the tooltip Y sits on the hex column's real top
 *    face (stepped terrain aware) instead of a fixed y=1.5.
 *  - Hover-intent delay on first show; instant in-place swap between hexes;
 *    instant hide on leaving the map (single persistent tooltip container that
 *    updates content — no unmount/remount thrash at hex boundaries).
 */
export function useHexHover() {
  const [hoveredHex, setHoveredHex] = useState<HexInfo | null>(null);
  // Pinned hex (click-to-pin). When set, the tooltip stays open regardless of
  // hover and shows the X close button. Independent of `hoveredHex`.
  const [pinnedHex, setPinnedHex] = useState<HexInfo | null>(null);
  const { getHexInfo, hasHex } = useHexStore();
  const { agents } = useAgentStore();

  // Entering relocation MOVE mode unpins the tooltip (pinning is disabled there).
  const inMoveMode = useRelocationStore((s) => s.activeAgentId !== null);
  useEffect(() => {
    if (inMoveMode) setPinnedHex(null);
  }, [inMoveMode]);

  // Last resolved hex key ("q,r" or null) — the short-circuit gate. Kept in a
  // ref so the pointermove handler stays referentially stable and doesn't churn.
  const lastKeyRef = useRef<string | null>(null);
  // Pending hover-intent timer (only used when no tooltip is currently shown).
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Pending hide-grace timer (cancelled if the pointer re-enters the map).
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Whether a tooltip is currently visible — drives instant-swap vs delayed-show.
  const shownRef = useRef(false);
  // Hover-safe freeze: true while the pointer is over the tooltip panel. Freezes
  // the current hex (suppress swaps) and blocks hides.
  const frozenRef = useRef(false);
  // Latest measured panel screen rect (from <HexTooltip onPanelRect>), used for
  // corridor detection. Null when no panel is on screen.
  const panelRectRef = useRef<DOMRect | null>(null);
  // Keep the latest agents list available to the delayed callback without
  // rebinding the (stable) pointermove handler on every agent update.
  const agentsRef = useRef(agents);
  agentsRef.current = agents;

  const clearShowTimer = useCallback(() => {
    if (showTimerRef.current !== null) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }, []);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  // Build the full HexInfo for a resolved (q,r). Reads agents from the ref.
  const buildHexInfo = useCallback(
    (q: number, r: number): HexInfo => {
      const { x, z } = hexToPixel(q, r);
      const hexData = getHexInfo(q, r);
      const agentCount = agentsRef.current.filter(
        (a) => a.hex && a.hex.q === q && a.hex.r === r,
      ).length;
      return {
        q,
        r,
        // Anchor to the column's actual top face (elevation-aware), not a fixed
        // height that floats over short columns / buries into tall ones.
        position: [x, hexTopY(hexData?.elevation), z],
        biome: hexData?.biome,
        resourceType: hexData?.resourceType,
        resourceAmount: hexData?.resourceAmount,
        elevation: hexData?.elevation,
        agentCount: agentCount > 0 ? agentCount : undefined,
      };
    },
    [getHexInfo],
  );

  const hideTooltip = useCallback(() => {
    clearShowTimer();
    clearHideTimer();
    lastKeyRef.current = null;
    shownRef.current = false;
    setHoveredHex(null);
  }, [clearShowTimer, clearHideTimer]);

  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      // Hover-safe: while the cursor is over the panel we freeze everything —
      // no swaps, no hides. (pointerenter on the panel already cancelled the
      // hide; the ground pointermove can still fire underneath, so guard here.)
      if (frozenRef.current) return;

      // Any real move back over the map cancels a pending grace-hide.
      clearHideTimer();

      const point = event.point;
      const { q, r } = pixelToHex(point.x, point.z);

      // Bounds guard: the pointer-capture ground plane extends past the actual
      // radius-N hex world, so a resolved (q,r) can land on a non-existent hex.
      // hexStore is authoritative — leaving the map hides the tooltip.
      if (!hasHex(q, r)) {
        if (lastKeyRef.current !== null) hideTooltip();
        return;
      }

      const key = `${q},${r}`;
      // Same-hex short-circuit: still hovering the same tile → nothing changed,
      // do not setState (this is the primary flicker fix).
      if (key === lastKeyRef.current) return;

      // Corridor tolerance: if a tooltip is open and the pointer is currently
      // inside the expanded rect around the panel (i.e. travelling *toward* the
      // SURVEY button), suppress the in-place swap so crossing intermediate hexes
      // doesn't steal the tooltip. Don't advance lastKeyRef — the resolved hex is
      // in the corridor, not a deliberate new selection. Native clientX/Y come
      // off the underlying DOM event.
      if (shownRef.current) {
        const rect = panelRectRef.current;
        const native = event.nativeEvent as PointerEvent | undefined;
        if (
          rect &&
          native &&
          native.clientX >= rect.left - CORRIDOR_PAD_PX &&
          native.clientX <= rect.right + CORRIDOR_PAD_PX &&
          native.clientY >= rect.top - CORRIDOR_PAD_PX &&
          native.clientY <= rect.bottom + CORRIDOR_PAD_PX
        ) {
          return;
        }
      }

      lastKeyRef.current = key;

      if (shownRef.current) {
        // A tooltip is already open — swap content in place, instantly (no delay,
        // no unmount). The single <Html> container just re-renders with new data.
        clearShowTimer();
        setHoveredHex(buildHexInfo(q, r));
        return;
      }

      // First hover onto the map — arm a short hover-intent delay so a fast sweep
      // doesn't flash a box. If the pointer moves to another hex before it fires,
      // the timer is rescheduled for the newest hex.
      clearShowTimer();
      showTimerRef.current = setTimeout(() => {
        showTimerRef.current = null;
        // Re-validate against the latest resolved hex (the timer is for the hex
        // stored in lastKeyRef; parse it back).
        const currentKey = lastKeyRef.current;
        if (currentKey === null) return;
        const [cq, cr] = currentKey.split(',').map(Number);
        shownRef.current = true;
        setHoveredHex(buildHexInfo(cq, cr));
      }, HOVER_INTENT_MS);
    },
    [hasHex, hideTooltip, clearShowTimer, buildHexInfo],
  );

  const handlePointerLeave = useCallback(() => {
    // The cursor may be moving onto the tooltip's own DOM (SURVEY button / panel)
    // which fires a ground `pointerleave`. If the panel has since taken the
    // pointer (frozen), the panel's own enter already cancelled the hide — bail.
    if (frozenRef.current) return;

    clearShowTimer();
    if (!shownRef.current) {
      // Nothing shown yet (still within hover-intent) — drop immediately.
      hideTooltip();
      return;
    }
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      // Don't yank a pinned tooltip; unpin is explicit (X / ESC / re-pin).
      if (frozenRef.current) return;
      hideTooltip();
    }, HIDE_GRACE_MS);
  }, [hideTooltip, clearShowTimer, clearHideTimer]);

  // --- Hover-safe panel handlers (wired to <HexTooltip>) -------------------

  // Pointer entered the tooltip panel: cancel any pending hide and freeze the
  // hex so the content doesn't swap while the cursor is over the panel.
  const handlePanelEnter = useCallback(() => {
    frozenRef.current = true;
    clearHideTimer();
  }, [clearHideTimer]);

  // Pointer left the tooltip panel: resume normal hover. Arm the grace hide so
  // leaving the panel into empty space still closes cleanly (a re-enter over a
  // hex cancels it via handlePointerMove → clearHideTimer).
  const handlePanelLeave = useCallback(() => {
    frozenRef.current = false;
    if (!shownRef.current) return;
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      if (frozenRef.current) return;
      hideTooltip();
    }, HIDE_GRACE_MS);
  }, [hideTooltip, clearHideTimer]);

  // Report the panel's live screen rect for corridor detection.
  const setPanelRect = useCallback((rect: DOMRect | null) => {
    panelRectRef.current = rect;
  }, []);

  // --- Click-to-pin --------------------------------------------------------

  // Pin the currently-resolved hex (called from the ground onClick when NOT in
  // MOVE mode). Re-pins if another hex is clicked. Reuses the last resolved key
  // so it pins exactly what the cursor is over.
  const pinHex = useCallback(
    (q: number, r: number) => {
      if (!hasHex(q, r)) return;
      setPinnedHex(buildHexInfo(q, r));
    },
    [hasHex, buildHexInfo],
  );

  const unpin = useCallback(() => setPinnedHex(null), []);

  // Clean up any pending timers on unmount.
  useEffect(() => {
    return () => {
      clearShowTimer();
      clearHideTimer();
    };
  }, [clearShowTimer, clearHideTimer]);

  return {
    hoveredHex,
    pinnedHex,
    handlePointerMove,
    handlePointerLeave,
    handlePanelEnter,
    handlePanelLeave,
    setPanelRect,
    pinHex,
    unpin,
  };
}
