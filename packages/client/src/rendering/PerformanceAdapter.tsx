/**
 * PerformanceAdapter - Adaptive quality based on FPS monitoring
 *
 * Wraps scene content with PerformanceMonitor from drei and exposes
 * quality settings via context. Automatically adjusts:
 * - Device pixel ratio (DPR)
 * - LOD distances
 * - Effects enabled/disabled
 *
 * Quality adapts down when FPS drops below 45, up when above 55.
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { PerformanceMonitor } from '@react-three/drei';

/** Quality level for easy reference */
export type QualityLevel = 'low' | 'medium' | 'high';

/** Performance settings exposed to components */
export interface PerformanceSettings {
  /** Device pixel ratio (0.5 - 2.0) */
  dpr: number;
  /** LOD distance thresholds */
  lodDistances: {
    high: number;
    med: number;
    low: number;
  };
  /** Whether post-processing effects are enabled */
  enableEffects: boolean;
  /** Current quality level */
  qualityLevel: QualityLevel;
  /** Max render distance for chunks */
  maxRenderDistance: number;
}

/** Default settings for each quality level */
const QUALITY_PRESETS: Record<QualityLevel, PerformanceSettings> = {
  low: {
    dpr: 0.75,
    lodDistances: { high: 30, med: 60, low: 120 },
    enableEffects: false,
    qualityLevel: 'low',
    maxRenderDistance: 150,
  },
  medium: {
    dpr: 1.0,
    lodDistances: { high: 50, med: 100, low: 200 },
    enableEffects: false,
    qualityLevel: 'medium',
    maxRenderDistance: 250,
  },
  high: {
    dpr: 1.5,
    lodDistances: { high: 75, med: 150, low: 300 },
    enableEffects: true,
    qualityLevel: 'high',
    maxRenderDistance: 400,
  },
};

/** Context for performance settings */
const PerformanceContext = createContext<PerformanceSettings>(QUALITY_PRESETS.medium);

/**
 * Hook to access current performance settings
 */
export function usePerformanceSettings(): PerformanceSettings {
  return useContext(PerformanceContext);
}

/**
 * Detect if device is mobile based on screen width
 */
function isMobileDevice(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < 768;
}

/**
 * Get initial quality based on device capabilities
 */
function getInitialQuality(): QualityLevel {
  if (isMobileDevice()) {
    return 'low';
  }
  // Check for high-end device indicators
  if (typeof navigator !== 'undefined') {
    const cores = navigator.hardwareConcurrency || 4;
    if (cores >= 8) {
      return 'high';
    }
  }
  return 'medium';
}

interface PerformanceAdapterProps {
  children: ReactNode;
}

/**
 * PerformanceAdapter component - wraps scene with FPS monitoring
 *
 * Automatically adjusts quality settings based on measured FPS:
 * - Below 45 FPS: reduce quality
 * - Above 55 FPS: increase quality (up to device max)
 *
 * Mobile devices are capped at medium quality max.
 */
export function PerformanceAdapter({ children }: PerformanceAdapterProps) {
  const [settings, setSettings] = useState<PerformanceSettings>(() => {
    const initial = getInitialQuality();
    return QUALITY_PRESETS[initial];
  });

  const isMobile = isMobileDevice();

  /**
   * Called when FPS drops below threshold (default 45)
   * Reduces quality by one level
   */
  const handleDecline = useCallback(() => {
    setSettings((current) => {
      if (current.qualityLevel === 'low') {
        return current; // Already at minimum
      }
      const newLevel = current.qualityLevel === 'high' ? 'medium' : 'low';
      console.log(`[PerformanceAdapter] FPS declining, reducing quality to ${newLevel}`);
      return QUALITY_PRESETS[newLevel];
    });
  }, []);

  /**
   * Called when FPS rises above threshold (default 55)
   * Increases quality by one level (respecting mobile cap)
   */
  const handleIncline = useCallback(() => {
    setSettings((current) => {
      // Mobile cap at medium
      const maxLevel: QualityLevel = isMobile ? 'medium' : 'high';
      if (current.qualityLevel === maxLevel) {
        return current; // Already at maximum for device
      }
      const newLevel = current.qualityLevel === 'low' ? 'medium' : 'high';
      if (newLevel === 'high' && isMobile) {
        return current; // Respect mobile cap
      }
      console.log(`[PerformanceAdapter] FPS improving, increasing quality to ${newLevel}`);
      return QUALITY_PRESETS[newLevel];
    });
  }, [isMobile]);

  return (
    <PerformanceContext.Provider value={settings}>
      <PerformanceMonitor
        onDecline={handleDecline}
        onIncline={handleIncline}
        flipflops={3} // Require 3 consecutive readings before changing
        factor={1}
      >
        {children}
      </PerformanceMonitor>
    </PerformanceContext.Provider>
  );
}
