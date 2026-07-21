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
import { FC, useState, useCallback, useEffect } from 'react';
import { Html } from '@react-three/drei';
import { ThreeEvent } from '@react-three/fiber';
import { pixelToHex, hexToPixel } from '../hex/hexMath';
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

// Elevation tier names
const elevationNames = ['LOW', 'MID', 'HIGH'];

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
      autoHide: 3000,
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
      autoHide: 3500,
    });
  } catch (err) {
    if (err instanceof SurveyError && err.status === 429 && err.retryAfterMs != null) {
      toasts.addToast({
        type: 'warning',
        title: 'SURVEY ON COOLDOWN',
        message: `Ready in ${fmtCooldown(err.retryAfterMs)}`,
        autoHide: 4000,
      });
    } else {
      toasts.addToast({
        type: 'error',
        title: 'SURVEY FAILED',
        message: err instanceof Error ? err.message : 'Survey failed',
        autoHide: 4000,
      });
    }
  } finally {
    surveyInFlight = false;
  }
}

export const HexTooltip: FC<HexTooltipProps> = ({ visible, hexInfo }) => {
  // Relocation MOVE mode: when placing an agent, surface the DEEP risk/reward
  // of the hovered hex so the choice is informed. Deep = pit floor / cave-
  // adjacent (deterministic from the terrain gen). Hooks run unconditionally.
  const inMoveMode = useRelocationStore((s) => s.activeAgentId !== null);
  const deepBonus = useWorldStore((s) => s.hazardTable?.caveIn?.deepYieldBonus ?? 1.25);
  // Durable survey knowledge for the hovered hex (null until surveyed).
  const surveyForHex = useContractStore((s) =>
    hexInfo ? s.getSurvey(hexInfo.q, hexInfo.r) : null,
  );

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
      position={hexInfo.position}
      center
      distanceFactor={25}
      style={{
        transition: 'opacity 0.15s ease-out',
        opacity: visible ? 1 : 0,
        pointerEvents: 'none',
      }}
    >
      <div
        className="pixel-inventory-panel"
        style={{
          position: 'relative',
          padding: '10px 14px',
          fontFamily: 'var(--font-body)',
          fontSize: '13px',
          lineHeight: 1.5,
          color: 'var(--dusk-text)',
          minWidth: '140px',
        }}
      >
        {/* Surveyed corner-tick — subtle teal marker (top-right). */}
        {surveyed && (
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
            ELEV: {elevationNames[hexInfo.elevation]}
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
            style={{
              marginTop: '8px',
              width: '100%',
              padding: '5px 8px',
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

/**
 * Hook to track hovered hex with full data from store
 */
export function useHexHover() {
  const [hoveredHex, setHoveredHex] = useState<HexInfo | null>(null);
  const { getHexInfo } = useHexStore();
  const { agents } = useAgentStore();

  const handlePointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    // Get intersection point
    const point = event.point;

    // Convert to hex coordinates
    const { q, r } = pixelToHex(point.x, point.z);

    // Get pixel position for tooltip
    const { x, z } = hexToPixel(q, r);

    // Get full hex info from store
    const hexData = getHexInfo(q, r);

    // Count agents at this hex
    const agentCount = agents.filter(
      (a) => a.hex && a.hex.q === q && a.hex.r === r
    ).length;

    setHoveredHex({
      q,
      r,
      position: [x, 1.5, z], // Above the hex
      biome: hexData?.biome,
      resourceType: hexData?.resourceType,
      resourceAmount: hexData?.resourceAmount,
      elevation: hexData?.elevation,
      agentCount: agentCount > 0 ? agentCount : undefined,
    });
  }, [getHexInfo, agents]);

  const handlePointerLeave = useCallback(() => {
    setHoveredHex(null);
  }, []);

  return {
    hoveredHex,
    handlePointerMove,
    handlePointerLeave,
  };
}
