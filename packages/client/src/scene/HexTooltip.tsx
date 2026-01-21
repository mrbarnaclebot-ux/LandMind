/**
 * HexTooltip - Shows resource info on hex hover
 * Uses Drei Html for 3D-projected tooltip
 */
import { FC, useState, useCallback } from 'react';
import { Html } from '@react-three/drei';
import { ThreeEvent } from '@react-three/fiber';
import { pixelToHex, hexToPixel } from '../hex/hexMath';
import '../styles/pixel-theme.css';

interface HexInfo {
  q: number;
  r: number;
  position: [number, number, number];
  resourceType?: string;
  resourceAmount?: number;
  agentCount?: number;
}

interface HexTooltipProps {
  visible: boolean;
  hexInfo: HexInfo | null;
}

// Resource display names and colors
const resourceColors: Record<string, string> = {
  GOLD: '#FFD700',
  SILVER: '#C0C0C0',
  COPPER: '#B87333',
  IRON: '#708090',
  EMPTY: '#808080',
};

export const HexTooltip: FC<HexTooltipProps> = ({ visible, hexInfo }) => {
  if (!visible || !hexInfo) return null;

  return (
    <Html
      position={hexInfo.position}
      center
      distanceFactor={12}
      style={{
        transition: 'opacity 0.15s ease-out',
        opacity: visible ? 1 : 0,
        pointerEvents: 'none',
      }}
    >
      <div
        className="pixel-inventory-bg"
        style={{
          padding: '8px 12px',
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '7px',
          color: 'white',
          minWidth: '100px',
        }}
      >
        {/* Coordinates */}
        <div style={{ marginBottom: '6px', color: '#8B8B8B' }}>
          HEX ({hexInfo.q}, {hexInfo.r})
        </div>

        {/* Resource */}
        {hexInfo.resourceType && (
          <div style={{ marginBottom: '4px' }}>
            <span style={{ color: resourceColors[hexInfo.resourceType] || '#fff' }}>
              {hexInfo.resourceType}
            </span>
          </div>
        )}

        {/* Amount */}
        {hexInfo.resourceAmount !== undefined && (
          <div style={{ marginBottom: '4px', color: '#FFAA00' }}>
            {hexInfo.resourceAmount.toLocaleString()} remaining
          </div>
        )}

        {/* Agents mining */}
        {hexInfo.agentCount !== undefined && hexInfo.agentCount > 0 && (
          <div style={{ color: '#4CAF50' }}>
            {hexInfo.agentCount} agent{hexInfo.agentCount > 1 ? 's' : ''} mining
          </div>
        )}
      </div>
    </Html>
  );
};

/**
 * Hook to track hovered hex
 */
export function useHexHover() {
  const [hoveredHex, setHoveredHex] = useState<HexInfo | null>(null);

  const handlePointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    // Get intersection point
    const point = event.point;

    // Convert to hex coordinates
    const { q, r } = pixelToHex(point.x, point.z);

    // Get pixel position for tooltip
    const { x, z } = hexToPixel(q, r);

    setHoveredHex({
      q,
      r,
      position: [x, 1.5, z], // Above the hex
      // Resource info would come from server/cache
      // For now just show coordinates
    });
  }, []);

  const handlePointerLeave = useCallback(() => {
    setHoveredHex(null);
  }, []);

  return {
    hoveredHex,
    handlePointerMove,
    handlePointerLeave,
  };
}
