/**
 * Delegated UI click sound.
 *
 * A single document-level (capture) listener plays a soft `ui_click` for any
 * `.pixel-btn`, `.pixel-btn-3d`, or native <button> the user activates. This
 * gives every button in the app a tactile blip without touching each component.
 *
 *  - Throttled so rapid clicks / bubbling don't stack blips.
 *  - No-ops while audio is locked or muted (sfx.play guards internally).
 *  - Buttons that already fire a MORE specific cue (e.g. DeployButton's
 *    ui_click + deploy) mark themselves with [data-no-uiclick] to opt out and
 *    avoid a double blip.
 */
import { sfx } from './sfx';

let installed = false;
let lastAt = 0;
const THROTTLE_MS = 60;

function onClick(e: MouseEvent) {
  const target = e.target as HTMLElement | null;
  if (!target) return;
  const el = target.closest('button, .pixel-btn, .pixel-btn-3d');
  if (!el) return;
  if (el.hasAttribute('data-no-uiclick')) return;
  if ((el as HTMLButtonElement).disabled) return;

  const now = performance.now();
  if (now - lastAt < THROTTLE_MS) return;
  lastAt = now;
  sfx.play('ui_click');
}

/** Install the delegated click listener once. Returns an uninstall fn. */
export function installUiClickSound(): () => void {
  if (installed) return () => {};
  installed = true;
  document.addEventListener('click', onClick, true);
  return () => {
    document.removeEventListener('click', onClick, true);
    installed = false;
  };
}
