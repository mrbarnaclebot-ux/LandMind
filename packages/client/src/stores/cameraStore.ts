/**
 * Camera store for controlling the 3D scene camera
 * Used by locate buttons to pan camera to agent positions
 */
import { create } from 'zustand';

interface CameraTarget {
  x: number;
  y: number;
  z: number;
}

interface CameraStore {
  /** Target position to pan camera to (null = no pending pan) */
  targetPosition: CameraTarget | null;

  /** Set a new target for camera to pan to */
  panToPosition: (x: number, y: number, z: number) => void;

  /** Clear the target after camera has reached it */
  clearTarget: () => void;
}

export const useCameraStore = create<CameraStore>((set) => ({
  targetPosition: null,

  panToPosition: (x, y, z) => {
    set({ targetPosition: { x, y, z } });
  },

  clearTarget: () => {
    set({ targetPosition: null });
  },
}));
