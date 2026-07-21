# LandMind Gameplay Design — "The Living Frontier" (proposed 2026-07-21)

Design review answering: how to make the game more interesting than deploy-and-mine. Grounded in engagement research (reference numbers from shipped games — see research summary at bottom) and in the systems we already run: 5s server tick, Redis agent cache, per-hex biomes/resources, 7-tier terrain with pits+caves, weighted scores → leaderboard → Merkle claims, socket events, admin economy config.

## Design pillars
1. **Every system creates a placement or timing DECISION** — never pure spectacle, never pure tax.
2. **Never net-negative an offline player.** Hazards are opt-in while present; caps slow gains, never claw back banked earnings. (Loss aversion λ=2.25 — losses feel ~2.25× worse than gains.)
3. **All modifiers are server-authoritative and published** (a readable modifier table in-game). Earnings-affecting RNG must eventually be verifiable (VRF) once on-chain.
4. Visuals stay inside Golden-Hour Dusk + Sunken Ember Hollows: the cycle moves between warm amber light and deep indigo night — never a flat noon.

---

## System 1 — World Clock: day/night cycle (FOUNDATION)

**24-minute full cycle** (the Minecraft/Terraria band — noticeable between sessions, not babysat):
| Phase | Length | Yield effect | Look |
|---|---|---|---|
| Dawn | 2 min | ramp to 1.0× | pale amber east light, fog lifts |
| Day | 8 min | 1.0× | warm bright (still golden-leaning, no white noon) |
| **Golden Hour** | 2 min | **1.25× global** | peak dusk look — our signature frame |
| Dusk | 4 min | 1.0× | current live look |
| **Night** | 8 min | surface 0.9×, **pit/cave-adjacent 1.2×** | deep indigo, ember speckles brighten, cave mouths glow |

- Golden Hour is the check-in moment (2 min every 24 — catchable, not demanding). Cap swing at 1.25×/0.9× per research (2× reads manipulative; zero-yield phases punish idle players).
- Night inverts placement value: the pits/caves we built become the smart night real estate → "where" decisions change with "when".
- **Server**: `worldClock` in Redis advanced by the tick loop; phase modifier resolved inside the mining calc per agent per tick. Broadcast `world:update {phase, phaseProgress, nextPhaseAt}`.
- **Client**: sky/sun/fog lerp between phase keyframes (all colors already specced); a small phase clock in the HUD with the modifier table one click away.

## System 2 — Weather fronts (regional, telegraphed, sometimes GOOD)

Drifting weather cells (server-side noise + velocity over the hex map), **diegetically telegraphed** — you see the front rolling in across neighbouring hexes (Sea of Thieves model) plus a forecast strip in the HUD (Stardew TV model) with at least one full phase of lead time.

| Front | Frequency | Effect while over a hex | Counterplay |
|---|---|---|---|
| Rainband | common | marsh/grassland **+15%**, rocky −10% | move Fe agents out, Cu agents in |
| Dust storm | common | plains −20%, visibility haze | relocate or ride it out |
| Snow front | uncommon | alpine **+20%**, forest −10% | alpine land-rush window |
| **Ember storm** | rare, small cell | **+50% all yields in cell, cave-in risk ×3** | opt-in risk/reward: stay or evacuate |

- At least half of fronts are net-positive somewhere — weather is opportunity, not only tax.
- **Relocation becomes a player action**: "Move agent" with a per-agent cooldown (e.g. 10 min) — free but time-gated, so choosing positions matters. (Auto-relocation on depletion stays.)
- Server: `weatherService` owns cells; modifier joins the mining-calc product: `yield = base × phaseMod × weatherMod × hazardMod × wearMod`.

## System 3 — Hazards & depth risk (opt-in, never confiscatory)

- **Deep deployment tiers**: deploying on pit floors / cave-adjacent hexes gives a standing **+20–30% yield weight** but exposes the agent to cave-ins. Published probabilities (e.g. 2%/hour base, ×3 under ember storm). OSRS-Wilderness principle: risk is chosen, knowingly, while present.
- **Cave-in**: the agent stops mining (status TRAPPED, visual: dust + dimmed core) until the player taps **Rescue** (small SOL fee → treasury = healthy sink) or waits a 4-hour self-dig timer. Never claws back mined resources; never fires on an agent whose owner has been offline >1 hour (grace rule — hazards pause for absent players' agents, their yield simply stays at the safe baseline).
- **Rich vein strikes**: periodically a hex upgrades to a temporary ×3 vein, announced globally (socket + map ping) for a land-rush moment. Additive-only; expires in 20 min.
- **Equipment wear**: accrues only while actively mining (Minecraft model — never idle-time decay). Efficiency drifts 100%→70% floor over ~3 days of mining; **Repair** (small fee → treasury) restores. A real burn sink (Naavik smoke test) that feeds the 50/50 vault instead of inflating.

## System 4 — Engagement layer

- **Daily contracts** ("mine 500 Cu from marsh hexes"): resume-not-reset streaks (Egg Inc calendar model), rewards scale with rank, paid as treasury bonus share.
- **Prospecting**: a Survey action (per-player cooldown) reveals a hex's hidden richness/affinity before deploying — durable knowledge, deterministic per hex, never pay-to-see.
- **Gold Rush community events**: weekend shared goals ("community mines 10M Au → +10% treasury bonus split"). Additive only; strongest measured DAU lever (+35% industry adoption of LTEs).
- **Seasons (soft prestige)**: monthly leaderboard snapshot → payout → rank reset. Agents (cNFTs) and a permanent +X% per-season badge carry over. Never a hard wipe.

## Hard anti-pattern rules (from research — non-negotiable)
1. No losses to offline players, ever. 2. No withering/appointment mechanics. 3. No RNG that can zero a session. 4. No PvP looting of earnings. 5. No hidden odds on anything earnings-affecting. 6. Sinks must burn (repair/rescue fees), not "spend-to-earn-more". 7. Seasons reset rank, never assets. 8. Check-in cadence stays optional, 30min–2h rhythm.

## Build order (each phase shippable alone)
- **A. World Clock** — server phase + modifiers + client sky lerp + HUD clock. Foundation for everything; biggest feel-per-effort.
- **B. Weather** — cells, diegetic fronts + forecast strip, relocation-as-action.
- **C. Hazards** — deep-deploy bonus, cave-ins + rescue, rich veins, wear/repair sinks.
- **D. Engagement** — contracts, prospecting, gold rush events, seasons.

Research basis: Don't Starve/Minecraft/Terraria cycle timings; Stardew/RimWorld/Sea of Thieves weather; OSRS/DRG/Tarkov risk-banking; Cookie Clicker/Melvor offline caps; Egg Inc/AdCap retention loops; Axie collapse post-mortem + Chainlink VRF fairness norms; Tversky-Kahneman loss aversion (λ=2.25).
