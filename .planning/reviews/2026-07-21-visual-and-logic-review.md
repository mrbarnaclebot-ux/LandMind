# LandMind Review — 2026-07-21 (Fable orchestrator + Opus reviewers)

Two parallel Opus reviews: visual/premium-feel of the client, and logic/architecture/security of the whole monorepo. Findings verified against source with file:line refs. Companion knowledge graph: `graphify-out/` (graph.html, GRAPH_REPORT.md, obsidian/ vault).

---

## A. Visual review (packages/client)

### Current state
- No post-processing at all (no bloom/SSAO/tone mapping/fog/Environment) — raw forward-rendered Three.js (ThreeScene.tsx).
- Shadows explicitly disabled (`castShadow={false}` ThreeScene.tsx:89); flat 3-light rig; Sky sun not synced to light direction.
- Hex tiles: un-beveled flat prisms, one flat RGB per biome, meshLambert + flatShading, fake AO via emissive hack (hexMesh.ts, HexWorld.tsx:90-95, ChunkedHexWorld.tsx:91-97, biomes.ts:26-44).
- Water/marsh = static opaque cyan tile. Clouds = drifting white boxes. Agents = hand-built voxel box robots; "mining effect" is just a point light (AgentLayer.tsx:44-146).
- UI: 100% inline styles + pixel-theme.css; Press Start 2P at 7-10px everywhere via CDN; icons are CSS box-shadow pixel art; logo is unicode `⬡ LANDMIND`; no public/ dir, no favicon, no OG meta, no image/model/font assets at all.
- No design tokens in practice — colors/fonts duplicated as literals; multiple drifting greens (#5D8C3E / #7DB356 / #2E7D32).
- console.log left in render paths (HeatMapOverlay.tsx:103,109; ChunkedHexWorld.tsx).

### Top 10 improvements (ranked)
1. **Post-processing stack** — @react-three/postprocessing EffectComposer: Bloom (threshold ~0.9) + ACESFilmic tone mapping + SMAA. Biggest premium jump. (M, procedural)
2. **Real shadows** — Canvas `shadows`, tuned directional shadow camera, ContactShadows for near LOD. (M, procedural)
3. **Per-instance tile color variation + vertex-AO** — jittered biome ramps, lighter tops/darker skirts, elevation tinting. (M, procedural)
4. **Real water** — separate translucent animated shader material for wetlands, sits below land. (M, procedural)
5. **Fog + sun sync + Environment IBL** — FogExp2 matched to LOD cutoff; one sunPosition constant for Sky + light; drei Environment for metallic reflections. (S-M, procedural)
6. **Agent upgrade + mining effects** — short-term: particle sparks, ground ring pulse, emissive halo; long-term: real GLB agent character (generated asset). (M/L)
7. **Design-token system** — tokens.ts / CSS vars, one type scale, pixel display font + readable data font pair. (L, procedural)
8. **Real logo/wordmark** — SVG/PNG lockup + favicon + OG meta (index.html has none). (S integration, generated asset)
9. **Loading/empty/first-run polish** — branded loading screen over terrain gen (currently a flat blue void), skeletons, illustrated empty states. (M)
10. **Micro-interactions** — framer-motion (already installed, unused): panel transitions, deploy drop-in animation, claim coin-burst celebration, hex hover ring. (M)

### Assets worth generating (Higgsfield or similar)
1. Wordmark + hex logo mark (512x512 icon, 1024x256 lockup, favicons) — emerald + gold, pixel/voxel style.
2. Agent character GLB (~2k tris, 512 atlas, glowing core) or 8-dir sprite sheet.
3. Resource icon set: gold/silver/copper/iron + pickaxe (512 transparent PNG/SVG, pixel art).
4. UI action icon set (heat-map, earnings, agents, deploy, settings, wallet, admin).
5. Self-hosted font pair (Press Start 2P woff2 + readable mono/pixel body font).
6. Loading splash 1920x1080 + empty-state illustrations.
7. Optional stylized 1k HDRI for Environment IBL.
8. OG/social card 1200x630.

### Quick wins (<1h each)
ACES tone mapping one-liner; FogExp2 one-liner; favicon/title/OG meta + font preconnect; sync Sky sun with light; vertex-color AO in hexMesh (~15 lines); remove render-path console.logs; bump emissives bloom-ready; consolidate greens/fonts into existing :root vars; empty-state copy+icon. Drei already ships ContactShadows/Environment/Sparkles/Float — no new deps except @react-three/postprocessing.

---

## B. Logic / architecture / security review

### CRITICAL (must fix before hosting)
- **CR-1** agents `/confirm` (server routes/agents.ts:166-214) accepts any confirmed signature — no payment/signer/uniqueness check (`deployTxSig` not `@unique`, schema.prisma:43), 20-agent cap not enforced in confirm → unlimited free server-paid mints.
- **CR-2** earnings `/confirm` (earnings.ts:219-267) trusts client-supplied `amount`, only checks tx existence → totalClaimed inflation/corruption.
- **CR-3** on-chain `claim_earnings` (lib.rs:92-161) has NO double-claim protection (no nullifier/claim-state PDA) → same Merkle proof replays until treasury drained. Unused `ClaimExceedsAllowance` error confirms unimplemented design.
- **CR-4** server-built claim ix accounts diverge from on-chain program (extra claim_state PDA, wrong writability; earnings.ts:151-183 vs lib.rs:266-287) → every real claim fails.
- **CR-5** 50/50 split exists only off-chain (earningsService.ts:105); on-chain deposit+payout share one treasury PDA with balance-only cap.
- **CR-6** JWT_SECRET hardcoded fallback `dev-jwt-secret-change-in-production` (authMiddleware.ts:4-6, auth.ts:14-16) → forgeable auth if env unset.
- **CR-7** admin metrics socket channel unauthenticated (`admin:subscribe`, socket.ts:62-92) + socket CORS defaults `*`.

### HIGH
- H-1 any client joins any `user:<wallet>` socket room unverified (socket.ts:53-58).
- H-2 Merkle leaf/node hashing not domain-separated (lib.rs:118-124, 209-222; mirrored merkleService.ts) → second-preimage risk.
- H-3 `initialize_vault` first-come admin takeover (lib.rs:247-263); deploy migration is empty stub.
- H-4 `agent_index` from treasury balance is non-monotonic after claims → cNFT leaf/asset-id collisions (lib.rs:49-54; three competing index sources).
- H-5 no rate limiting; `/claim` rebuilds full Merkle tree per request → DoS.
- H-6 dead `earnings:update` listener + payload field drift (client useEarnings.ts:12-17,182 vs server events/types.ts:17-21) — live earnings never reach UI.

### MEDIUM (selected)
- Tick loop N+1 DB queries per agent per 5s (tickLoop.ts:66-72, relocation.ts:77,99); unconditional decrement can go negative; findNearestHexWithResources loads all hexes; 30s write-behind loss window (calculateMissedTicks dead code); deploy cap race; SIWS message not bound to server nonce/domain; admin economy config unvalidated; Redis leaderboard scores as JS number (2^53 precision); duplicate client socket connections + redeclared types; resourceType hardcoded 'GOLD' in 5 handlers.

### LOW (selected)
- `app.set('io')` never called → route-level socket emits silently no-op; `http://localhost:3001` fallback in 6 client files; SERVER_URL leaks into cNFT metadata; contract tests cover only placeholder initialize; health endpoint leaks topology.

### Architecture notes
- Client/server hexMath duplicated but currently in agreement (drift risk — extract shared package).
- Off-chain economy is authoritative; contract is a dumb escrow with forgeable Merkle check — central risk.
- 6 Zustand stores + per-hook socket singletons; contracts redeclared instead of shared types.
- Buffer polyfill only at main.tsx entry; vite.config has no node polyfill config — fragile prod build.
- 341 weakly-connected graph nodes corroborated as dead/unwired code.

### Railway deployment blockers
1. No Dockerfile/railway.json/nixpacks — no declared build/run for monorepo.
2. Contract not deployed (Anchor.toml cluster=Localnet; pending devnet todo; initVault blocked).
3. Secrets not prod-safe (CR-6/CR-7); .env loaded via relative path breaks in container.
4. docker-compose is dev-only; need managed Postgres/Redis via DATABASE_URL/REDIS_URL.
5. Hardcoded localhost fallbacks; CI bakes VITE_API_URL=localhost.
6. `/dev` router (destructive reset endpoints) mounted unless NODE_ENV exactly 'production'.
7. CI typecheck uses `|| true` — never fails; no `prisma migrate deploy` strategy.

### Recommended fix order
CR-1..CR-5 (economy exploitable, claims broken) → CR-6/CR-7 (auth) → contract devnet deploy + init → packaging (Dockerfile/railway) + kill dev router → H-series → visual quick wins → visual top-10.
