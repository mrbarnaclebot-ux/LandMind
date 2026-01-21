/**
 * HexTooltip - Shows resource info on hex hover
 * Uses Drei Html for 3D-projected tooltip
 */
import { FC, useState, useCallback } from 'react';
import { Html } from '@react-three/drei';
import { ThreeEvent } from '@react-three/fiber';
import { pixelToHex, hexToPixel } from '../hex/hexMath';
import { useHexStore, type ResourceType } from '../stores/hexStore';
import { useAgentStore } from '../stores/agentStore';
import type { Biome } from '../terrain/biomes';
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

export const HexTooltip: FC<HexTooltipProps> = ({ visible, hexInfo }) => {
  if (!visible || !hexInfo) return null;

  const resource = hexInfo.resourceType ? resourceConfig[hexInfo.resourceType] : null;

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
          padding: '10px 14px',
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '7px',
          color: 'white',
          minWidth: '130px',
        }}
      >
        {/* Coordinates */}
        <div style={{ marginBottom: '8px', color: '#8B8B8B', fontSize: '6px' }}>
          HEX ({hexInfo.q}, {hexInfo.r})
        </div>

        {/* Biome */}
        {hexInfo.biome && (
          <div style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                background: biomeColors[hexInfo.biome],
                display: 'inline-block',
                boxShadow: 'inset -1px -1px 0 rgba(0,0,0,0.3)',
              }}
            />
            <span style={{ color: biomeColors[hexInfo.biome] }}>
              {biomeNames[hexInfo.biome]}
            </span>
          </div>
        )}

        {/* Elevation */}
        {hexInfo.elevation !== undefined && (
          <div style={{ marginBottom: '6px', color: '#9E9E9E', fontSize: '6px' }}>
            ELEV: {elevationNames[hexInfo.elevation]}
          </div>
        )}

        <div className="pixel-divider" style={{ margin: '6px 0' }} />

        {/* Resource */}
        {resource && hexInfo.resourceType !== 'NONE' && (
          <>
            <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  color: resource.color,
                  fontWeight: 'bold',
                  textShadow: `1px 1px 0 rgba(0,0,0,0.5)`,
                }}
              >
                [{resource.icon}]
              </span>
              <span style={{ color: resource.color }}>{resource.name}</span>
            </div>

            {/* Amount */}
            {hexInfo.resourceAmount !== undefined && (
              <div style={{ marginBottom: '4px', color: '#FFAA00', fontSize: '6px' }}>
                {hexInfo.resourceAmount.toLocaleString()} remaining
              </div>
            )}
          </>
        )}

        {/* No resource */}
        {(!resource || hexInfo.resourceType === 'NONE') && (
          <div style={{ color: '#666', fontSize: '6px' }}>
            NO RESOURCES
          </div>
        )}

        {/* Agents mining */}
        {hexInfo.agentCount !== undefined && hexInfo.agentCount > 0 && (
          <div
            style={{
              marginTop: '6px',
              padding: '4px 6px',
              background: 'rgba(76, 175, 80, 0.2)',
              color: '#4CAF50',
              fontSize: '6px',
            }}
          >
            {hexInfo.agentCount} AGENT{hexInfo.agentCount > 1 ? 'S' : ''} MINING
          </div>
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
