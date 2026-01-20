# Phase 5: Agent Deployment - Research

**Researched:** 2026-01-20
**Domain:** Solana Compressed NFTs (cNFTs), Anchor Programs, React Three Fiber Animations
**Confidence:** MEDIUM-HIGH

## Summary

This phase introduces on-chain agent deployment using Solana compressed NFTs (cNFTs) via Metaplex's Bubblegum program, combined with real-time 3D visualization in React Three Fiber. The deployment flow requires: (1) an Anchor program that accepts 0.1 SOL payment and mints a cNFT representing the agent, (2) client-side integration with Metaplex Umi SDK for cNFT minting, (3) DAS API for fetching user's agents, and (4) React Three Fiber with drei for rendering agents on the hex grid with animations.

The project already has strong foundations: Socket.io with typed events, Redis-cached agent state, existing hex rendering with InstancedMesh, and wallet adapter integration. The main work involves: building the Agent Factory Anchor program, integrating Umi for cNFT operations, creating agent mesh components with mining animations, and extending the socket events for real-time agent updates.

**Primary recommendation:** Use Metaplex Umi SDK with `@metaplex-foundation/mpl-bubblegum` for cNFT minting (not raw CPI from Anchor), create a simple Anchor program that handles SOL payment and calls backend to trigger server-side minting, and use React Three Fiber's `useFrame` with refs for smooth agent animations.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @metaplex-foundation/mpl-bubblegum | latest | cNFT minting via Umi | Official Metaplex SDK for compressed NFTs, supports v2 features |
| @metaplex-foundation/umi-bundle-defaults | latest | Umi framework setup | Required foundation for Metaplex operations |
| @metaplex-foundation/umi-signer-wallet-adapters | latest | Connect wallet to Umi | Bridges existing wallet adapter to Umi identity |
| @metaplex-foundation/digital-asset-standard-api | latest | DAS API for fetching cNFTs | Required to query user's owned compressed NFTs |
| anchor-lang | 0.30.1 | Anchor program framework | Already in use, stable version |
| @coral-xyz/anchor | 0.30.1 | Anchor client SDK | Already in contracts package |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @react-three/drei | ^10.7.7 | R3F utilities (Html, Detailed) | Already installed - use for tooltips, LOD |
| three | ^0.182.0 | 3D rendering | Already installed - use for AnimationMixer if needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Umi SDK | Direct Bubblegum CPI from Anchor | Umi is simpler, CPI requires complex account setup and external tree management |
| InstancedMesh for agents | Individual meshes | InstancedMesh scales to thousands; individual meshes limited to ~100 agents |
| Drei Html for tooltips | Custom DOM overlay | Html auto-projects to 3D positions, handles occlusion |

**Installation (client):**
```bash
npm install @metaplex-foundation/umi @metaplex-foundation/umi-bundle-defaults @metaplex-foundation/mpl-bubblegum @metaplex-foundation/umi-signer-wallet-adapters @metaplex-foundation/digital-asset-standard-api
```

## Architecture Patterns

### Recommended Project Structure

```
packages/
├── client/src/
│   ├── scene/
│   │   ├── AgentMesh.tsx        # Individual agent with animations
│   │   ├── AgentLayer.tsx       # InstancedMesh for all agents
│   │   └── HexTooltip.tsx       # Drei Html tooltip component
│   ├── components/
│   │   ├── agents/
│   │   │   ├── DeployButton.tsx     # Deploy button in header
│   │   │   ├── AgentDashboard.tsx   # Side panel with agent list
│   │   │   └── AgentCard.tsx        # Individual agent info card
│   │   └── ui/
│   │       └── Toast.tsx            # Toast notification system
│   ├── hooks/
│   │   ├── useAgentDeploy.ts    # Deployment transaction logic
│   │   ├── useUserAgents.ts     # Fetch/subscribe to user agents
│   │   └── useUmi.ts            # Umi instance with wallet
│   ├── lib/
│   │   ├── umi.ts               # Umi setup and configuration
│   │   └── agents.ts            # Agent-related API calls
│   └── stores/
│       └── agentStore.ts        # Zustand store for agent state
├── server/src/
│   ├── routes/
│   │   └── agents.ts            # Agent deployment endpoint
│   ├── services/
│   │   └── agentMinting.ts      # cNFT minting with Umi (server-side)
│   └── events/
│       └── types.ts             # Extended socket event types
└── contracts/programs/landmind/src/
    ├── lib.rs                   # Main program with deploy_agent instruction
    ├── state.rs                 # Account structs (AgentConfig, etc.)
    └── errors.rs                # Custom error codes
```

### Pattern 1: Server-Side cNFT Minting

**What:** Mint cNFTs from the server rather than client-side
**When to use:** When you control the Merkle tree and want to batch/manage minting centrally
**Why:** Simplified client flow, tree management in one place, can validate payment on-chain before minting

```typescript
// Server: packages/server/src/services/agentMinting.ts
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplBubblegum, mintV1 } from '@metaplex-foundation/mpl-bubblegum';
import { keypairIdentity } from '@metaplex-foundation/umi';

const umi = createUmi(process.env.RPC_URL!)
  .use(mplBubblegum());

// Load server keypair for minting authority
const serverKeypair = /* load from env */;
umi.use(keypairIdentity(serverKeypair));

export async function mintAgentNFT(
  ownerAddress: string,
  agentId: string
): Promise<string> {
  const result = await mintV1(umi, {
    leafOwner: publicKey(ownerAddress),
    merkleTree: publicKey(process.env.MERKLE_TREE_ADDRESS!),
    metadata: {
      name: `LandMind Agent #${agentId}`,
      uri: `https://landmind.io/api/agents/${agentId}/metadata`,
      sellerFeeBasisPoints: 0,
      collection: none(),
      creators: []
    }
  }).sendAndConfirm(umi);

  return result.signature;
}
```

### Pattern 2: useFrame Animation with Refs

**What:** Animate meshes by mutating refs in useFrame, not React state
**When to use:** Any continuous animation (mining bobbing, relocation movement)
**Why:** React state updates trigger reconciliation; ref mutation is direct and fast

```typescript
// Source: https://r3f.docs.pmnd.rs/tutorials/basic-animations
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

function MiningAgent({ position }: { position: [number, number, number] }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    // Bobbing animation - subtle up/down movement
    meshRef.current.position.y = position[1] + Math.sin(clock.elapsedTime * 2) * 0.05;
    // Slight rotation for "working" feel
    meshRef.current.rotation.y = Math.sin(clock.elapsedTime) * 0.1;
  });

  return (
    <mesh ref={meshRef} position={position}>
      <boxGeometry args={[0.3, 0.4, 0.3]} />
      <meshLambertMaterial color="#4a90d9" />
    </mesh>
  );
}
```

### Pattern 3: Anchor SOL Payment with PDA

**What:** Accept 0.1 SOL payment and record deployment in program state
**When to use:** Any on-chain payment handling
**Why:** Verifiable payment, atomic with state update

```rust
// Source: https://rareskills.io/post/anchor-transfer-sol
use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

#[program]
pub mod landmind {
    use super::*;

    pub fn deploy_agent(ctx: Context<DeployAgent>) -> Result<()> {
        // Transfer 0.1 SOL to treasury
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.payer.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        );
        transfer(cpi_context, 100_000_000)?; // 0.1 SOL in lamports

        // Emit event for backend to pick up and mint cNFT
        emit!(AgentDeployedEvent {
            owner: ctx.accounts.payer.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct DeployAgent<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut, seeds = [b"treasury"], bump)]
    pub treasury: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[event]
pub struct AgentDeployedEvent {
    pub owner: Pubkey,
    pub timestamp: i64,
}
```

### Pattern 4: Drei Html for 3D Tooltips

**What:** Attach HTML tooltips to 3D objects
**When to use:** Agent info tooltips, hex resource display
**Why:** Auto-projects to 3D position, handles transforms

```typescript
// Source: https://drei.docs.pmnd.rs/misc/html
import { Html } from '@react-three/drei';

function AgentTooltip({ position, agent, visible }: Props) {
  if (!visible) return null;

  return (
    <Html
      position={position}
      center
      distanceFactor={15}
      style={{
        transition: 'opacity 0.2s',
        opacity: visible ? 1 : 0,
        pointerEvents: 'none',
      }}
    >
      <div className="pixel-tooltip">
        <div>Owner: {formatAddress(agent.owner)}</div>
        <div>Mining: {agent.miningRate}/tick</div>
        <div>Gold: {agent.resources.gold}</div>
      </div>
    </Html>
  );
}
```

### Pattern 5: DAS API for Fetching User Agents

**What:** Query compressed NFTs owned by a wallet
**When to use:** Loading user's agents on connection, refreshing after deploy
**Why:** cNFTs don't exist as regular accounts; must use DAS indexer

```typescript
// Source: https://www.helius.dev/docs/das-api
import { dasApi } from '@metaplex-foundation/digital-asset-standard-api';
import { publicKey } from '@metaplex-foundation/umi';

// Setup Umi with DAS
const umi = createUmi(RPC_URL).use(dasApi());

async function getUserAgents(walletAddress: string) {
  const assets = await umi.rpc.getAssetsByOwner({
    owner: publicKey(walletAddress),
    limit: 100,
  });

  // Filter to only LandMind agents by collection or creator
  return assets.items.filter(asset =>
    asset.content.metadata.name?.startsWith('LandMind Agent')
  );
}
```

### Anti-Patterns to Avoid

- **Minting cNFTs from client with user's tree:** User would need to create/pay for Merkle tree. Use server-controlled tree instead.
- **Using React state for animations:** Causes expensive re-renders. Always use refs with useFrame.
- **Individual meshes for many agents:** Won't scale past ~100 agents. Use InstancedMesh.
- **Polling for agent updates:** Inefficient. Use existing Socket.io infrastructure.
- **Storing full agent data in Zustand:** Only store IDs and derived state; actual data comes from socket/server.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| cNFT minting | Raw Bubblegum CPI | Umi SDK with mplBubblegum | Account setup is complex, Umi handles tree config, proofs |
| Fetching cNFTs | Direct RPC calls | DAS API via Umi | cNFTs aren't regular accounts; need indexer |
| 3D tooltips | Custom DOM positioning | Drei Html component | Auto-handles 3D-to-2D projection, occlusion |
| Agent animations | Manual matrix updates | useFrame + refs | R3F pattern, integrates with render loop |
| Wallet-Umi bridge | Manual conversion | umi-signer-wallet-adapters | Handles all type conversions |
| LOD switching | Custom distance checks | Drei Detailed component | Built-in LOD with proper thresholds |

**Key insight:** The Metaplex Umi ecosystem is purpose-built for cNFT operations. Attempting to work directly with Bubblegum program accounts requires understanding Merkle proofs, tree configs, and concurrent buffer management - all handled by Umi.

## Common Pitfalls

### Pitfall 1: Merkle Tree Not Created

**What goes wrong:** Minting fails because no Merkle tree exists to store cNFTs
**Why it happens:** Tree must be created before any cNFTs can be minted; it's not automatic
**How to avoid:** Create Merkle tree in setup/initialization script with appropriate depth
**Warning signs:** "Account not found" errors on first mint

```typescript
// One-time tree creation (run during setup)
import { createTree } from '@metaplex-foundation/mpl-bubblegum';

const merkleTree = generateSigner(umi);
await createTree(umi, {
  merkleTree,
  maxDepth: 14,      // 16,384 max cNFTs
  maxBufferSize: 64,
  canopyDepth: 8,    // Reduces proof size for transfers
}).sendAndConfirm(umi);
```

### Pitfall 2: DAS RPC Required

**What goes wrong:** `getAssetsByOwner` fails or returns empty
**Why it happens:** Standard RPC doesn't support DAS methods; need DAS-enabled RPC
**How to avoid:** Use Helius, QuickNode with DAS add-on, or other DAS-enabled provider
**Warning signs:** Method not found errors, always-empty results

### Pitfall 3: Umi Identity Not Set

**What goes wrong:** Transactions fail with "no identity" or signer errors
**Why it happens:** Umi instance created but wallet adapter not connected as identity
**How to avoid:** Call `umi.use(walletAdapterIdentity(wallet))` after wallet connects
**Warning signs:** "Signer required" errors on mint

```typescript
// Correct pattern - set identity when wallet connects
const wallet = useWallet();

useEffect(() => {
  if (wallet.connected) {
    umi.use(walletAdapterIdentity(wallet));
  }
}, [wallet.connected]);
```

### Pitfall 4: Animation Performance with Many Agents

**What goes wrong:** Frame rate drops with 50+ agents animating
**Why it happens:** Individual meshes + separate useFrame calls per agent
**How to avoid:** Use InstancedMesh with single useFrame updating all matrices
**Warning signs:** FPS drops below 30 when zoomed out showing many agents

```typescript
// Good: Single useFrame updates all instances
useFrame(({ clock }) => {
  agents.forEach((agent, i) => {
    const y = baseY + Math.sin(clock.elapsedTime * 2 + i * 0.5) * 0.05;
    tempMatrix.makeTranslation(agent.x, y, agent.z);
    instancedMeshRef.current.setMatrixAt(i, tempMatrix);
  });
  instancedMeshRef.current.instanceMatrix.needsUpdate = true;
});
```

### Pitfall 5: Socket Room Subscription Timing

**What goes wrong:** User doesn't receive agent updates after deployment
**Why it happens:** Socket subscription happens before wallet auth, or room name mismatch
**How to avoid:** Subscribe to room after authentication confirms, use consistent room naming
**Warning signs:** Server shows events emitted but client doesn't receive

## Code Examples

Verified patterns from official sources:

### Umi Setup with Wallet Adapter

```typescript
// Source: https://developers.metaplex.com/umi/getting-started
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplBubblegum } from '@metaplex-foundation/mpl-bubblegum';
import { dasApi } from '@metaplex-foundation/digital-asset-standard-api';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { useWallet } from '@solana/wallet-adapter-react';

export function useUmi() {
  const wallet = useWallet();

  const umi = useMemo(() => {
    const instance = createUmi(import.meta.env.VITE_RPC_URL)
      .use(mplBubblegum())
      .use(dasApi());
    return instance;
  }, []);

  useEffect(() => {
    if (wallet.connected && wallet.publicKey) {
      umi.use(walletAdapterIdentity(wallet));
    }
  }, [wallet.connected, wallet.publicKey, umi]);

  return umi;
}
```

### Smooth Agent Relocation Animation

```typescript
// Lerp-based movement for relocation
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function RelocatingAgent({ from, to, progress }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const startPos = useMemo(() => new THREE.Vector3(...from), [from]);
  const endPos = useMemo(() => new THREE.Vector3(...to), [to]);

  useFrame(() => {
    if (!meshRef.current) return;
    // Smooth interpolation with easing
    const t = Math.min(progress, 1);
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    meshRef.current.position.lerpVectors(startPos, endPos, eased);
    // Add slight bounce at end
    meshRef.current.position.y += Math.sin(t * Math.PI) * 0.2;
  });

  return <mesh ref={meshRef}>{/* ... */}</mesh>;
}
```

### Agent Deployment Flow (Client)

```typescript
// Complete deployment hook
export function useAgentDeploy() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [isDeploying, setIsDeploying] = useState(false);

  const deploy = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    setIsDeploying(true);
    try {
      // 1. Call server to get deployment transaction
      const response = await fetch(`${API_BASE_URL}/api/agents/deploy`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const { transaction: serializedTx } = await response.json();

      // 2. Deserialize and sign
      const tx = Transaction.from(Buffer.from(serializedTx, 'base64'));
      const signed = await wallet.signTransaction(tx);

      // 3. Send and confirm
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature, 'confirmed');

      return signature;
    } finally {
      setIsDeploying(false);
    }
  }, [wallet, connection]);

  return { deploy, isDeploying };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Regular NFTs for game assets | Compressed NFTs (cNFTs) | 2023 | 1000x cost reduction for minting |
| Metaplex JS SDK | Umi SDK | 2023-2024 | Better TypeScript, smaller bundles |
| Bubblegum v1 | Bubblegum v2 | 2025 | Freeze/thaw, soulbound, enforced royalties |
| Individual mesh per object | InstancedMesh | Standard | Required for 100+ objects |
| Manual 3D-to-DOM calculation | Drei Html | Standard | Automatic projection and transforms |

**Deprecated/outdated:**
- `@metaplex-foundation/js` (old SDK): Replaced by Umi, no longer maintained
- Manual Merkle proof calculation: Umi handles this internally
- Client-side tree creation: Should be server-managed for game assets

## Open Questions

Things that couldn't be fully resolved:

1. **Merkle Tree Sizing**
   - What we know: maxDepth 14 = 16,384 cNFTs, costs ~0.34 SOL
   - What's unclear: Expected max agents per deployment period
   - Recommendation: Start with depth 14, can create additional trees if needed

2. **DAS Provider Selection**
   - What we know: Need DAS-enabled RPC (Helius, QuickNode)
   - What's unclear: Whether current devnet RPC supports DAS
   - Recommendation: Verify RPC supports DAS before implementation; may need Helius

3. **Agent Metadata Storage**
   - What we know: cNFT metadata URI points to off-chain JSON
   - What's unclear: Host on server vs IPFS vs Arweave
   - Recommendation: Server-hosted initially (simpler), migrate to permanent storage later

4. **Concurrent Minting**
   - What we know: maxBufferSize limits concurrent tree updates
   - What's unclear: Expected concurrent deployment rate
   - Recommendation: maxBufferSize 64 should handle normal load; monitor and adjust

## Sources

### Primary (HIGH confidence)
- [Metaplex Bubblegum Documentation](https://developers.metaplex.com/bubblegum) - Tree creation, minting, cost tables
- [Metaplex Umi Getting Started](https://developers.metaplex.com/umi/getting-started) - SDK setup, wallet integration
- [React Three Fiber Basic Animations](https://r3f.docs.pmnd.rs/tutorials/basic-animations) - useFrame patterns
- [Drei Html Component](https://drei.docs.pmnd.rs/misc/html) - Tooltip implementation
- [Anchor PDA Documentation](https://www.anchor-lang.com/docs/basics/pda) - Account derivation patterns

### Secondary (MEDIUM confidence)
- [QuickNode DAS API Guide](https://www.quicknode.com/guides/solana-development/nfts/das-api) - getAssetsByOwner usage
- [Helius DAS API Docs](https://www.helius.dev/docs/das-api) - DAS method reference
- [RareSkills Anchor SOL Transfer](https://rareskills.io/post/anchor-transfer-sol) - Payment handling patterns
- [Umi Web3.js Adapters](https://developers.metaplex.com/umi/web3js-differences-and-adapters) - Type conversions

### Tertiary (LOW confidence - verify before use)
- Bubblegum CPI from Anchor: Limited examples found; Umi preferred approach
- InstancedMesh LOD: Community solutions exist (@three.ez/instanced-mesh) but may be overkill

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Metaplex docs, actively maintained
- Architecture patterns: MEDIUM-HIGH - Combines official patterns with project context
- Pitfalls: MEDIUM - Based on documented gotchas and community issues
- Animation patterns: HIGH - Official R3F documentation

**Research date:** 2026-01-20
**Valid until:** 2026-02-20 (30 days - Umi/Bubblegum are stable)
