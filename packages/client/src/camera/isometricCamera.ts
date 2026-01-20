import {
  ArcRotateCamera,
  Camera,
  Scene,
  Vector3,
  PointerEventTypes,
  Observer,
  PointerInfo,
} from '@babylonjs/core';

// Camera configuration constants
const DEFAULT_ALPHA = Math.PI / 4; // 45 degrees horizontal rotation
const DEFAULT_BETA = Math.PI / 3; // ~60 degrees vertical (isometric feel)
const DEFAULT_ORTHO_SIZE = 40; // Initial zoom level (shows ~80 unit diameter)
const MIN_ORTHO_SIZE = 5; // Maximum zoom in (increased to prevent clipping)
const MAX_ORTHO_SIZE = 100; // Maximum zoom out (can view entire grid)
const ZOOM_SPEED = 3; // Ortho units per wheel tick (faster zoom)

// Clipping plane distances for orthographic camera
const NEAR_CLIP = 0.1; // Very close to camera
const FAR_CLIP = 500; // Far enough to see entire world

/**
 * Creates an isometric-style orthographic camera with pan/rotate controls
 */
export function setupIsometricCamera(
  scene: Scene,
  canvas: HTMLCanvasElement
): ArcRotateCamera {
  const camera = new ArcRotateCamera(
    'isoCam',
    DEFAULT_ALPHA,
    DEFAULT_BETA,
    100, // Radius doesn't affect ortho, but needed for initialization
    Vector3.Zero(),
    scene
  );

  // Set orthographic mode
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;

  // CRITICAL: Set clipping planes to prevent disappearing geometry
  // For ortho cameras, minZ/maxZ define the visible depth range
  camera.minZ = NEAR_CLIP;
  camera.maxZ = FAR_CLIP;

  // Calculate aspect ratio and set initial ortho bounds
  const aspectRatio = canvas.width / canvas.height;
  camera.orthoLeft = -DEFAULT_ORTHO_SIZE * aspectRatio;
  camera.orthoRight = DEFAULT_ORTHO_SIZE * aspectRatio;
  camera.orthoTop = DEFAULT_ORTHO_SIZE;
  camera.orthoBottom = -DEFAULT_ORTHO_SIZE;

  // Configure controls
  camera.panningSensibility = 50; // Lower = faster panning
  camera.wheelPrecision = 0; // Disable default zoom (we handle it)
  camera.allowUpsideDown = false;
  camera.lowerBetaLimit = 0.3; // Prevent looking straight down
  camera.upperBetaLimit = Math.PI / 2.2; // Prevent looking horizontal

  // Attach controls to canvas
  camera.attachControl(canvas, true);

  return camera;
}

/**
 * Handles orthographic zoom by adjusting ortho bounds
 */
export function handleZoom(
  camera: ArcRotateCamera,
  delta: number,
  canvas: HTMLCanvasElement
): void {
  const currentSize = camera.orthoTop!;
  const newSize = Math.max(
    MIN_ORTHO_SIZE,
    Math.min(MAX_ORTHO_SIZE, currentSize + delta * ZOOM_SPEED)
  );
  const aspectRatio = canvas.width / canvas.height;
  camera.orthoLeft = -newSize * aspectRatio;
  camera.orthoRight = newSize * aspectRatio;
  camera.orthoTop = newSize;
  camera.orthoBottom = -newSize;
}

/**
 * Attaches a zoom handler to the scene's pointer observable
 * Returns a cleanup function to remove the observer
 */
export function attachZoomHandler(
  scene: Scene,
  camera: ArcRotateCamera,
  canvas: HTMLCanvasElement
): () => void {
  const observer: Observer<PointerInfo> = scene.onPointerObservable.add(
    (pointerInfo) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERWHEEL) {
        return;
      }

      const event = pointerInfo.event as WheelEvent;
      // Normalize wheel delta across browsers
      // Positive delta = scroll down = zoom out (increase ortho size)
      // Negative delta = scroll up = zoom in (decrease ortho size)
      const delta = Math.sign(event.deltaY);
      handleZoom(camera, delta, canvas);
    }
  )!;

  return () => {
    scene.onPointerObservable.remove(observer);
  };
}

/**
 * Updates camera ortho bounds when canvas is resized
 */
export function updateCameraAspectRatio(
  camera: ArcRotateCamera,
  canvas: HTMLCanvasElement
): void {
  const currentSize = camera.orthoTop ?? DEFAULT_ORTHO_SIZE;
  const aspectRatio = canvas.width / canvas.height;
  camera.orthoLeft = -currentSize * aspectRatio;
  camera.orthoRight = currentSize * aspectRatio;
}
