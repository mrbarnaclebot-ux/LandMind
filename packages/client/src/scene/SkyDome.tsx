/**
 * SkyDome — phase-driven skybox for the World Clock (System 1).
 *
 * Replaces the flat `scene.background` + drei <Sky> with a real, evolving sky:
 *
 *  1. GRADIENT DOME — a large inverted sphere (BackSide) with a custom
 *     ShaderMaterial. A vertical gradient runs from the sampled zenith color at
 *     the top to the horizon color at the bottom, with a soft horizon BAND whose
 *     width is keyframed (fat + layered at golden_hour / dusk, tight at day /
 *     night). Renders behind everything (depthWrite=false, renderOrder -1000) and
 *     is toneMapped=false so it never blooms. Fog color stays exactly the sampled
 *     horizon (owned by WorldSky).
 *
 *  2. CELESTIAL DISC — one soft-edged warm sun (or pale-cool moon at night)
 *     placed on the dome from the keyframed elevation + shared SUN_AZIMUTH, so it
 *     lines up with the directional light. LARGE + low at golden_hour / dusk,
 *     smaller / higher at day, a small pale moon at night. Sub-bloom brightness.
 *
 *  3. STARFIELD — deterministic Points (~760 stars) hashed onto the upper dome,
 *     three size tiers, gentle per-star twinkle in the shader. Opacity is driven
 *     by the sampled `starOpacity` (0 by day, full at night, fading across
 *     dusk→night and night→dawn). Cool white-indigo tints with two faint amber
 *     "ember stars" as a brand wink. Quality-gated: not mounted at low quality.
 *
 * Everything is driven by the SAME smooth cycleT (getSmoothCycleT) so there are
 * no pops at phase boundaries, including the night→dawn wrap. No per-frame
 * allocations: uniforms and a shared scratch keyframe / vector are mutated in
 * place.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorldStore } from '../stores/worldStore';
import { sampleSky, makeSkyTarget, sunDirection } from './worldPhases';

/** Dome radius — sits well inside the camera far plane (2000) but beyond the world. */
const DOME_RADIUS = 900;
/** Disc distance from origin along the sun direction (inside the dome). */
const DISC_DISTANCE = 820;
/** Star shell radius (just inside the dome so stars read as far sky). */
const STAR_RADIUS = 860;
const STAR_COUNT = 760;

// ---------------------------------------------------------------------------
// Shared per-frame scratch (module-level; SkyDome is a singleton in the scene).
// ---------------------------------------------------------------------------
const scratchSky = makeSkyTarget();
const scratchDir = new THREE.Vector3();

// ---------------------------------------------------------------------------
// 1. Gradient dome
// ---------------------------------------------------------------------------

const DOME_VERT = /* glsl */ `
  varying vec3 vWorldDir;
  void main() {
    // Direction from camera to this vertex, in world space — gives a stable
    // gradient that follows the horizon regardless of camera position.
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldDir = normalize(world.xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const DOME_FRAG = /* glsl */ `
  precision mediump float;
  varying vec3 vWorldDir;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform float uBandWidth;   // how far the horizon band bleeds up (0..1)

  void main() {
    // h: 0 at horizon, 1 at zenith (clamp lower hemisphere to horizon color).
    float h = clamp(vWorldDir.y, 0.0, 1.0);

    // Soft, curved rise out of the horizon band. Wider band => the horizon color
    // holds higher up the dome (the layered dusk look).
    float band = clamp(uBandWidth, 0.05, 0.95);
    float g = smoothstep(0.0, band, h);
    // Second, gentler curve toward the zenith so the top doesn't flatten.
    g = mix(g, smoothstep(0.0, 1.0, h), 0.35);

    vec3 col = mix(uHorizon, uZenith, g);

    // A subtle extra warm lift right at the horizon line for the stacked-band feel.
    float glow = smoothstep(band * 0.55, 0.0, h) * 0.18;
    col = mix(col, uHorizon, glow);

    gl_FragColor = vec4(col, 1.0);
  }
`;

function GradientDome({ skyRef }: { skyRef: React.MutableRefObject<THREE.ShaderMaterial | null> }) {
  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: DOME_VERT,
      fragmentShader: DOME_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      fog: false,
      uniforms: {
        uZenith: { value: new THREE.Color('#2E3A5C') },
        uHorizon: { value: new THREE.Color('#E8A26B') },
        uBandWidth: { value: 0.5 },
      },
    });
    return mat;
  }, []);

  // Expose the material so the parent's single useFrame can push uniforms.
  skyRef.current = material;

  return (
    <mesh renderOrder={-1000} frustumCulled={false} material={material}>
      <sphereGeometry args={[DOME_RADIUS, 32, 16]} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// 2. Celestial disc (sun / moon)
// ---------------------------------------------------------------------------

const DISC_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const DISC_FRAG = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uOpacity;

  void main() {
    // Radial soft disc: bright core, feathered halo, all sub-bloom.
    float d = length(vUv - 0.5) * 2.0;      // 0 at center, 1 at edge
    float core = smoothstep(0.62, 0.10, d); // solid-ish core
    float halo = smoothstep(1.0, 0.30, d) * 0.5; // soft outer feather
    float a = clamp(core + halo, 0.0, 1.0) * uOpacity;
    if (a <= 0.001) discard;
    vec3 col = uColor * uIntensity;
    gl_FragColor = vec4(col, a);
  }
`;

function CelestialDisc({
  matRef,
  meshRef,
}: {
  matRef: React.MutableRefObject<THREE.ShaderMaterial | null>;
  meshRef: React.MutableRefObject<THREE.Mesh | null>;
}) {
  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: DISC_VERT,
      fragmentShader: DISC_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      fog: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uColor: { value: new THREE.Color('#FFB262') },
        uIntensity: { value: 0.8 },
        uOpacity: { value: 1 },
      },
    });
    return mat;
  }, []);
  matRef.current = material;

  return (
    <mesh ref={meshRef} renderOrder={-990} frustumCulled={false} material={material}>
      {/* Unit quad; scaled per-frame to the keyframed disc size. */}
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// 3. Starfield
// ---------------------------------------------------------------------------

/** Deterministic hash in [0,1) from an integer seed. */
function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const STAR_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vTwinkle;
  uniform float uTime;
  uniform float uPixelRatio;
  void main() {
    vColor = aColor;
    // Gentle twinkle: each star breathes at its own phase.
    float tw = 0.65 + 0.35 * sin(uTime * 1.6 + aPhase * 6.2831);
    vTwinkle = tw;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio * tw;
  }
`;

const STAR_FRAG = /* glsl */ `
  precision mediump float;
  varying vec3 vColor;
  varying float vTwinkle;
  uniform float uOpacity;
  void main() {
    // Round, soft-edged point.
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = smoothstep(1.0, 0.15, d);
    a *= uOpacity * vTwinkle;
    if (a <= 0.001) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

function Starfield({
  matRef,
}: {
  matRef: React.MutableRefObject<THREE.ShaderMaterial | null>;
}) {
  const { gl } = useThree();

  const geometry = useMemo(() => {
    const positions = new Float32Array(STAR_COUNT * 3);
    const sizes = new Float32Array(STAR_COUNT);
    const phases = new Float32Array(STAR_COUNT);
    const colors = new Float32Array(STAR_COUNT * 3);

    // Cool white / indigo palette + two amber "ember stars" (brand wink).
    const cool = new THREE.Color('#DCE4FF');
    const indigo = new THREE.Color('#9AA6D8');
    const ember = new THREE.Color('#F0A63C');

    for (let i = 0; i < STAR_COUNT; i++) {
      // Hash onto the upper dome (bias toward y>0 so stars sit in the sky).
      const u = hash01(i * 2.13 + 1.0);
      const v = hash01(i * 3.77 + 7.0);
      const theta = u * Math.PI * 2.0;
      // cosPhi in [-0.05, 1] -> mostly upper hemisphere, a few near horizon.
      const cosPhi = -0.05 + v * 1.05;
      const clamped = Math.min(1, cosPhi);
      const sinPhi = Math.sqrt(Math.max(0, 1 - clamped * clamped));
      positions[i * 3] = STAR_RADIUS * sinPhi * Math.cos(theta);
      positions[i * 3 + 1] = STAR_RADIUS * clamped;
      positions[i * 3 + 2] = STAR_RADIUS * sinPhi * Math.sin(theta);

      // Three size tiers (mostly small, a few bright anchors).
      const tierR = hash01(i * 5.19 + 2.0);
      const size = tierR > 0.94 ? 7.0 : tierR > 0.78 ? 4.6 : 2.9;
      sizes[i] = size;
      phases[i] = hash01(i * 8.91 + 4.0);

      // Two ember stars at fixed indices; rest cool/indigo by hash.
      let c: THREE.Color;
      if (i === 37 || i === 512) {
        c = ember;
      } else {
        c = cool.clone().lerp(indigo, hash01(i * 9.53 + 3.0));
      }
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geom.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geom.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    return geom;
  }, []);

  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      fog: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uPixelRatio: { value: Math.min(gl.getPixelRatio(), 2) },
      },
    });
    return mat;
  }, [gl]);
  matRef.current = material;

  return (
    <points renderOrder={-995} frustumCulled={false} geometry={geometry} material={material} />
  );
}

// ---------------------------------------------------------------------------
// SkyDome (parent) — single useFrame drives all uniforms from sampleSky.
// ---------------------------------------------------------------------------

interface SkyDomeProps {
  /** Mount the starfield (medium+ quality). Off at low quality. */
  starsEnabled?: boolean;
}

export function SkyDome({ starsEnabled = true }: SkyDomeProps) {
  const domeMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const discMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const discMeshRef = useRef<THREE.Mesh | null>(null);
  const starMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const { camera, controls } = useThree();

  // Dev-only QA hook: aim the camera along the sun azimuth at a given elevation
  // so the celestial disc is framed for screenshots. Mirrors window.__setPhase.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __aimSun?: (elevDeg: number) => void }).__aimSun = (elevDeg: number) => {
      sunDirection(elevDeg, scratchDir);
      // Camera sits a little BEHIND origin (opposite the sun) and the controls
      // target is placed FAR along the sun direction, so OrbitControls.update()
      // keeps the camera looking straight at the disc (it derives its spherical
      // from position - target, so both must be set before update()).
      const target = scratchDir.clone().multiplyScalar(400);
      const camPos = scratchDir.clone().multiplyScalar(-40);
      camPos.y += 20;
      camera.position.copy(camPos);
      const anyControls = controls as unknown as {
        target?: THREE.Vector3;
        update?: () => void;
      } | null;
      if (anyControls && anyControls.target && anyControls.update) {
        anyControls.target.copy(target);
        anyControls.update();
      } else {
        camera.lookAt(target);
      }
      camera.updateMatrixWorld();
    };
  }, [camera, controls]);

  useFrame((state) => {
    const cycleT = useWorldStore.getState().getSmoothCycleT();
    const s = sampleSky(cycleT, scratchSky);

    // 1. Dome gradient uniforms.
    const dome = domeMatRef.current;
    if (dome) {
      (dome.uniforms.uZenith.value as THREE.Color).copy(s.zenith);
      (dome.uniforms.uHorizon.value as THREE.Color).copy(s.horizon);
      dome.uniforms.uBandWidth.value = s.horizonBandWidth;
    }

    // 2. Disc: place on the dome from elevation + shared azimuth, face the origin.
    const disc = discMeshRef.current;
    const discMat = discMatRef.current;
    if (disc && discMat) {
      sunDirection(s.sunElevationDeg, scratchDir);
      disc.position.copy(scratchDir).multiplyScalar(DISC_DISTANCE);
      disc.lookAt(0, 0, 0);
      const size = s.discSize * DISC_DISTANCE;
      disc.scale.set(size, size, 1);
      (discMat.uniforms.uColor.value as THREE.Color).copy(s.disc);
      discMat.uniforms.uIntensity.value = s.discIntensity;
      // Hide the disc when it dips below the horizon (never a floating disc in
      // the ground). Fade over the last few degrees for a clean set/rise.
      const belowFade = THREE.MathUtils.clamp((s.sunElevationDeg + 2) / 6, 0, 1);
      discMat.uniforms.uOpacity.value = belowFade;
      disc.visible = belowFade > 0.001;
    }

    // 3. Stars: twinkle time + phase-driven opacity.
    const starMat = starMatRef.current;
    if (starMat) {
      starMat.uniforms.uTime.value = state.clock.elapsedTime;
      starMat.uniforms.uOpacity.value = s.starOpacity;
    }
  });

  return (
    <group>
      <GradientDome skyRef={domeMatRef} />
      <CelestialDisc matRef={discMatRef} meshRef={discMeshRef} />
      {starsEnabled && <Starfield matRef={starMatRef} />}
    </group>
  );
}
