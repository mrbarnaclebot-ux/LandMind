/**
 * readinessStore — tracks real boot readiness signals for the StartScreen
 * loading bar. Each flag flips true from the actual place that satisfies it:
 *
 *  - config:  useConfigStore.loadConfig() resolved (/api/config fetched)
 *  - world:   worldStore.applyUpdate ran (/api/world fetched / world:update)
 *  - socket:  shared socket fired 'connect'
 *  - render:  first world render ready (hexStore populated / ChunkedHexWorld
 *             mounted its hex data)
 *
 * The StartScreen subscribes and drives a segmented progress bar + stage label.
 */
import { create } from 'zustand';

export type ReadinessSignal = 'config' | 'world' | 'socket' | 'render';

export const READINESS_ORDER: readonly ReadinessSignal[] = [
  'config',
  'world',
  'socket',
  'render',
] as const;

/** On-brand, minimal stage labels (Manrope), keyed by the signal in flight. */
export const READINESS_LABELS: Record<ReadinessSignal, string> = {
  config: 'waking the frontier...',
  world: 'reading the weather...',
  socket: 'opening the wire...',
  render: 'carving the hills...',
};

interface ReadinessState {
  config: boolean;
  world: boolean;
  socket: boolean;
  render: boolean;
  mark: (signal: ReadinessSignal) => void;
  allReady: () => boolean;
}

export const useReadinessStore = create<ReadinessState>((set, get) => ({
  config: false,
  world: false,
  socket: false,
  render: false,
  mark: (signal) => {
    if (get()[signal]) return;
    set({ [signal]: true } as Pick<ReadinessState, ReadinessSignal>);
  },
  allReady: () => {
    const s = get();
    return s.config && s.world && s.socket && s.render;
  },
}));

/** Imperative marker usable outside React (stores, socket callbacks). */
export function markReady(signal: ReadinessSignal): void {
  useReadinessStore.getState().mark(signal);
}
