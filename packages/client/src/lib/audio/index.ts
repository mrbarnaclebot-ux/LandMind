/**
 * MINERUSH audio — public API.
 *
 *   import { audio } from '../lib/audio';
 *   audio.unlock();                // from a user gesture (START button)
 *   audio.music.start();           // begin generative ambient
 *   audio.sfx.play('deploy');      // one-shot synth SFX
 *   audio.setMuted(true);
 *
 * Autoplay policy: NOTHING sounds before unlock(); sfx.play / music.start
 * no-op while the context is locked.
 */
import {
  unlock,
  isUnlocked,
  setMuted,
  toggleMuted,
  setMusicVolume,
  setSfxVolume,
  getAudioState,
  subscribeAudioState,
  getGraph,
} from './context';
import { sfx, type SfxName } from './sfx';
import { music } from './music';

export type { SfxName };

export const audio = {
  unlock,
  isUnlocked,
  setMuted,
  toggleMuted,
  setMusicVolume,
  setSfxVolume,
  getState: getAudioState,
  subscribe: subscribeAudioState,
  sfx,
  music,
};

// --- dev-only debug hook ----------------------------------------------------
// Exposes the live AudioContext + node graph for headless verification.
// window.__audioDebug.state / .contextState / .nodes
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __audioDebug: unknown }).__audioDebug = {
    get contextState() {
      return getGraph()?.ctx.state ?? 'no-context';
    },
    get state() {
      return getAudioState();
    },
    get musicRunning() {
      return music.isRunning();
    },
    get nodes() {
      const g = getGraph();
      if (!g) return null;
      return {
        master: !!g.master,
        music: !!g.music,
        sfx: !!g.sfx,
        limiter: !!g.limiter,
        musicGain: g.music.gain.value,
        sfxGain: g.sfx.gain.value,
      };
    },
    unlock,
    play: (n: SfxName) => sfx.play(n),
    startMusic: () => music.start(),
    stopMusic: () => music.stop(),
  };
}
