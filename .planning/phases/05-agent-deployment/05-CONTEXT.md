# Phase 5: Agent Deployment - Context

**Gathered:** 2026-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can deploy agents as compressed NFTs that appear on the hex grid and mine. Includes deployment flow, agent rendering, placement logic, agent management dashboard, and hex resource display. Fee economics and claiming rewards are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Deployment Flow
- Click deploy → wallet confirmation pops up immediately (no preview modal)
- Cost (0.1 SOL) shown on hover tooltip over deploy button
- Deploy button lives in the header/navbar, always accessible
- One agent per transaction (no batch deploy)
- Progress shown via toast notification: "Deploying..." then "Agent deployed!"
- On failure: error toast with retry button, user stays on current screen
- After successful deploy: camera auto-pans to show where agent landed
- Soft cap of 10-20 agents per wallet (UI warns but allows more)

### Agent Visuals
- Agents rendered as small mining robots (fits Minecraft pixel theme)
- Size: small (20-30% of hex) — subtle, doesn't dominate the hex
- Ownership: color coding — user's agents bright/highlighted, others dimmed/greyed
- Mining animation: small idle animation (bobbing, arm movement, spinning pickaxe)
- Relocation: smooth move animation (slides/walks to new hex over 1-2 seconds)
- Clicking agent shows quick tooltip: owner, mining rate, resources mined
- LOD: switch to simplified colored dots when zoomed out far
- No rank/tier visual indicators — all agents look the same except ownership color

### Placement Logic
- Initial hex: random available hex (system picks)
- Max 20 agents per hex — resources split among them
- Relocation: random hex within a radius that has resources
- No restricted hexes — agents can land on any hex with resources

### Agent Dashboard
- Location: side panel (slide-out, similar to transaction history)
- Each agent card shows: ID, current hex, resources by type, mining rate, time active
- Action available: "Locate" button pans camera to agent's location
- Summary stats at top: total agents, total resources mined, combined mining rate

### Resource Display
- Visibility: hover over hex to see tooltip
- Tooltip shows: total resources remaining, breakdown by type (Gold/Silver/Copper/Iron), number of agents mining here
- Depletion visual: cracked/damaged texture on depleted hexes
- Resources regenerate slowly over time
- Biome specialization: each biome favors certain resource types (mountains = gold, forests = copper, etc.)

### Claude's Discretion
- Exact mining robot 3D model/style
- Animation timing and easing
- Tooltip styling and positioning
- Exact LOD distance thresholds
- Resource regeneration rate
- Specific biome-to-resource mappings
- Relocation radius distance

</decisions>

<specifics>
## Specific Ideas

- Mining robots should feel like they belong in a Minecraft-inspired world — blocky, pixel-art aesthetic
- Smooth agent movement during relocation should feel satisfying, not jarring
- Resource tooltips should be informative but not overwhelming

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-agent-deployment*
*Context gathered: 2026-01-20*
