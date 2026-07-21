# LandMind Art Direction — "Golden-Hour Dusk" (LOCKED 2026-07-21)

Chosen by user from 3 researched directions (alternatives archived below research notes). Moody premium-retro: the hex world at magic hour — low warm sun, long cool shadows, thick warm fog, dark indigo/amber pixel UI where exactly one glow (amber) earns its keep. Reference lineage: Loop Hero (dark premium pixel UI), Monument Valley (dusk gradients, printed-artwork vignette), Dorfromantik (single-sun discipline, warm/cool mood), Bad North (soft-shadow diorama).

## Non-negotiable anti-slop rules
1. No purple/indigo *gradient* fills, no cyan-on-dark neon, no glassmorphism/backdrop-blur, no gradient text, no gradient button fills.
2. Glow is earned: ONLY the agent amber core (and brief amber spark particles) may bloom. Everything else matte. Bloom threshold 0.9, `toneMapped={false}` on the glowing emissive only.
3. No black shadows ever — AO and shadow tints are cool indigo (`0.55,0.60,0.74` crevice multiplier region).
4. No saturated-AND-dark colors; every biome color comes from its 3-value ramp below.
5. Pixel font (Press Start 2P) for titles/hero numbers only, integer sizes (8/16/24/32). Manrope carries body/stats/addresses.
6. Hard 1px-offset pixel shadows in UI; never gaussian drop-shadow soup. One bevel treatment held everywhere.
7. Grayscale check: after any palette change, screenshot in grayscale — biomes must separate by value, not hue.

## World spec
- **Tone mapping**: `THREE.NeutralToneMapping`, exposure 0.95 (requires three >= r162; fallback AgX + HueSaturation +0.05). Canvas `antialias: false` (SMAA in composer), `outputColorSpace: SRGBColorSpace`.
- **Sky/fog**: dusk gradient zenith `#2E3A5C` → horizon `#E8A26B`. `<fog>` color = `#E8A26B`, linear 50 → 320. Fog color MUST equal horizon band.
- **Lighting**: low warm sun `#FFB86B`, intensity 2.4, ~22° elevation (long shadows); cool ambient `#4A5A78`, 0.45. `<Canvas shadows>` PCFSoft, mapSize 2048, frustum ±80, near 0.5 far 200, bias -0.0005, normalBias 0.02.
- **Biome ramps** (shadow / mid / light — cool-shadow, warm-lit):
  - grassland `#3C5A2E / #6B8C3E / #9DB85A`
  - marsh `#2C5E62 / #47898A / #74B0AC`
  - plains `#8A6A2E / #C89A44 / #F0CC72` (golden hero — catches the sun)
  - forest `#26402C / #3E6440 / #5E8858`
  - rocky `#7A3E2A / #B4613A / #E0966A` (terracotta hero at dusk)
  - alpine `#8E9AB0 / #C4CBD6 / #F2E4D4` (pink-gold snow)
- **Vertex AO** (baked in chunk geometry, multiply-only, linear space): tops 1.0 warm `(1.0,0.98,0.94)`, edge verts ~0.8, crevices/skirts cool `(0.55,0.60,0.74)`.
- **Post chain** (@react-three/postprocessing, in order): Bloom (mipmapBlur, intensity 0.5, threshold 0.9, smoothing 0.05) → ToneMapping → HueSaturation (saturation -0.06) → Vignette (offset 0.25, darkness 0.7) → SMAA. Pick tonemapping in composer OR gl, not both.
- **Water/marsh**: translucent animated shader tile sitting below land level (separate material branch).

## Agents & motion
- Dark matte body; single amber core cube `emissive #F0A63C`, `emissiveIntensity 1.5`, `toneMapped={false}` — the only bloomer. Remove ALL per-agent pointLights and the `#00FF41` all-over emissive.
- MINING: core pulses emissive 0.8 → 1.5 at 1.2 Hz. Idle: bob 0.3 Hz + sway 0.18 Hz, per-instance phase noise.
- Deploy: squash-land (scaleY 0.88→1.0, 220ms easeOutBack `cubic-bezier(0.34,1.56,0.64,1)`) + 12 amber spark particles + 2-frame hit-pause + Perlin trauma-shake (trauma 0.25, ~4px, 100-250ms decay).
- Collect/claim: amber coin arcs to counter 400ms, counter scale-punch + SFX on ARRIVAL frame.
- UI motion: micro 120-200ms standard easing; panels 300-400ms emphasized, exits ~10-15% faster than entries; springs stiffness 300-400 damping 30-50; never bounce/elastic on chrome, never animate width/height.

## UI spec
- Ground: near-black indigo `#14161F`. Panels: 9-slice indigo with amber-highlight top edge, hard bevels re-paletted from grey stone to indigo/amber.
- Accents (3 only): amber `#F0A63C` (primary/rewards/glow), teal `#3FB6A8` (info/positive), ember `#E0553C` (danger).
- Fonts: Press Start 2P (self-hosted woff2) titles/balances; Manrope body. 8px spacing grid.
- Amber glow in UI = a real 4px pixel-bloom sprite, not CSS blur.
- Re-palette all CSS box-shadow pixel icons to amber/teal/ember; kill `linear-gradient` fills in `.pixel-btn-3d` → flat + bevel.

## Terrain addendum — "Sunken Ember Hollows" (added 2026-07-21, orchestrator design decision)

Dramatic relief + underground character, staying inside the dusk palette and bloom discipline.

- **Seamless tiling (bug fix)**: hex columns must tile with ZERO visible gaps — geometry radius must exactly match the grid pitch (no shrink factor), and every column's side skirt extends down to at least the lowest adjacent hex top (or bedrock −1 tier) so elevation steps never show through to the sky/fog behind.
- **Relief amplification**: height range widens to ~7 tiers. Add a ridged-noise channel (abs-value fBm) blended with the base fBm for ridgelines and mesas; quantize highland tops into plateau steps. A second very-low-frequency noise carves winding valley lines; valley floors below the waterline become water/marsh.
- **Pits**: deterministic sinkholes on ~1.5% of land hexes (clusters of 1–3), floor dropped 2–3 tiers below the surrounding rim. Walls use the cool shadow ramp with strengthened AO (down to 0.45 multiplier); floors get sparse amber ember speckles — emissive #F0A63C at intensity ≤0.3, `toneMapped` normal, deliberately BELOW the 0.9 bloom threshold (warm glimmer, no glow halo).
- **Caves**: where adjacent hexes differ by ≥2 tiers, ~10% of those cliff faces (deterministic hash) get a cave mouth — a dark inset opening (near-black indigo #0C0E16 interior) with a faint warm gradient deep inside (amber emissive ≤0.25, non-blooming) suggesting ember light from the deep. Purely visual set dressing; no gameplay collision changes.
- **Bloom rule amendment**: the agent amber core remains the ONLY blooming element. Pit embers and cave interiors may use sub-threshold amber emissive (≤0.3) — glimmer, never halo.
- **Perf**: all new features are deterministic from (q,r) hash, instanced/batched, chunk-owned, and disabled or simplified at low quality tier. Budgets: ≤80 cave mouths, ≤60 pit clusters visible.

## Implementation order
1. `terrain/biomes.ts` → ramps + `getBiomeRamp(biome)`; wire per-instance color jitter + sun-facing value pick in HexWorld/ChunkedHexWorld.
2. `scene/ThreeScene.tsx` → tonemap/exposure, dusk Sky params, fog, warm sun + cool ambient + shadows, EffectComposer chain.
3. Chunk mesh builders (`hexMesh.ts`, `LODHexGeometry.ts`) → cool-tinted vertex AO; materials `vertexColors`.
4. `AgentLayer.tsx` → de-neon, amber core, pulse/idle/deploy juice, shake util.
5. `pixel-theme.css` + components → indigo/amber/teal/ember tokens, font pairing, de-gradient, 9-slice panels.
6. Water shader for marsh; loading splash; assets (logo/icons — Higgsfield) per the asset list in `.planning/reviews/2026-07-21-visual-and-logic-review.md`.

Full research (reference findings, technique library, the two unchosen directions) lives in the review conversation of 2026-07-21; the three universal wins are baked in above.
