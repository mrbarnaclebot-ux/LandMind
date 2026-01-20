# Phase 4: Wallet Integration - Research

**Researched:** 2026-01-20
**Domain:** Solana wallet connection, authentication, RPC methods
**Confidence:** HIGH

## Summary

Phase 4 implements Solana wallet integration for LandMind, enabling users to connect Phantom/Solflare wallets, authenticate via message signing, view SOL balance, and see transaction history. The Solana ecosystem has mature, well-documented tools for this:

- **@solana/wallet-adapter-react** provides React hooks and context for wallet management
- **Sign In With Solana (SIWS)** standardizes authentication via message signing
- **Solana RPC methods** enable balance queries and transaction history retrieval
- **Zustand with persist middleware** manages wallet session state client-side

**Primary recommendation:** Use @solana/wallet-adapter-react for connection, implement SIWS for server-side auth with JWT sessions, store session in httpOnly cookies, and use Zustand for client-side wallet state.

## Standard Stack

The established libraries/tools for Solana wallet integration:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @solana/wallet-adapter-react | ^0.15.39 | Wallet connection hooks | Official Anza library, standard for all Solana dApps |
| @solana/wallet-adapter-react-ui | ^0.9.39 | Pre-built wallet modal/buttons | Consistent UX, handles wallet detection |
| @solana/wallet-adapter-base | ^0.9.27 | Wallet adapter interfaces | Required peer dependency |
| @solana/web3.js | ^1.95.x | RPC connection, PublicKey utilities | Core Solana SDK for JavaScript |
| @solana/wallet-standard-util | ^1.1.x | SIWS verification utilities | Official verification helpers |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @solana/wallet-adapter-wallets | ^0.19.x | Legacy wallet adapters | Only if supporting old wallets |
| zustand | ^5.x | Client-side state management | Wallet session state, UI state |
| jose | ^5.x | JWT creation/verification | Server-side session tokens |
| bs58 | ^6.x | Base58 encoding/decoding | Signature encoding |
| tweetnacl | ^1.0.x | Ed25519 signature verification | Alternative verification method |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @solana/wallet-adapter-react-ui | Custom modal | More control but more work; standard UI is familiar to users |
| JWT sessions | Cookie-only sessions | JWT allows stateless verification; cookies alone need DB lookup |
| Zustand | React Context | Zustand is simpler, has persist middleware built-in |
| @solana/web3.js | @solana/kit | kit is newer but wallet-adapter still uses web3.js |

**Installation:**

```bash
# Client packages
npm install @solana/wallet-adapter-react @solana/wallet-adapter-react-ui @solana/wallet-adapter-base @solana/web3.js @solana/wallet-standard-util bs58 zustand

# Server packages (for auth)
npm install @solana/web3.js tweetnacl bs58 jose
```

## Architecture Patterns

### Recommended Project Structure

```
packages/client/src/
├── providers/
│   └── SolanaProvider.tsx      # ConnectionProvider + WalletProvider wrapper
├── stores/
│   └── walletStore.ts          # Zustand store for wallet session state
├── components/wallet/
│   ├── ConnectButton.tsx       # Header connect/connected button
│   ├── WalletModal.tsx         # Wallet selection modal (uses adapter-ui)
│   ├── AccountMenu.tsx         # Dropdown menu when connected
│   └── TransactionHistory.tsx  # Side panel with tx list
├── hooks/
│   └── useWalletSession.ts     # Session management hook
└── lib/
    └── solana.ts               # RPC helpers, balance formatting

packages/server/src/
├── routes/
│   └── auth.ts                 # /auth/nonce, /auth/verify endpoints
├── middleware/
│   └── authMiddleware.ts       # JWT verification middleware
└── lib/
    └── solana.ts               # Signature verification utilities
```

### Pattern 1: Wallet Provider Setup

**What:** Wrap app with ConnectionProvider and WalletProvider for wallet context
**When to use:** Root of React application

```typescript
// packages/client/src/providers/SolanaProvider.tsx
import { FC, ReactNode, useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider
} from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

// Import default styles
import '@solana/wallet-adapter-react-ui/styles.css';

interface SolanaProviderProps {
  children: ReactNode;
}

export const SolanaProvider: FC<SolanaProviderProps> = ({ children }) => {
  // Use devnet for development, switch to mainnet-beta for production
  const network = WalletAdapterNetwork.Devnet;

  // Can use custom RPC endpoint (Helius, QuickNode) instead of public
  const endpoint = useMemo(() =>
    process.env.VITE_SOLANA_RPC_URL || clusterApiUrl(network),
    [network]
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      {/* Empty wallets array - Wallet Standard auto-detects installed wallets */}
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
```

### Pattern 2: useWallet Hook Usage

**What:** Access wallet state and methods in components
**When to use:** Any component needing wallet interaction

```typescript
// Source: @solana/wallet-adapter-react documentation
import { useWallet, useConnection } from '@solana/wallet-adapter-react';

function WalletComponent() {
  const { connection } = useConnection();
  const {
    publicKey,        // PublicKey | null - connected wallet address
    connected,        // boolean - connection status
    connecting,       // boolean - connection in progress
    disconnect,       // () => Promise<void> - disconnect wallet
    signMessage,      // (message: Uint8Array) => Promise<Uint8Array>
    sendTransaction,  // (tx, connection, options?) => Promise<string>
    wallet,           // Wallet | null - wallet adapter instance
    wallets,          // Wallet[] - all detected wallets
    select,           // (walletName) => void - select a wallet
  } = useWallet();

  // Check connection before operations
  if (!connected || !publicKey) {
    return <ConnectButton />;
  }

  return <div>Connected: {publicKey.toBase58()}</div>;
}
```

### Pattern 3: SIWS Authentication Flow

**What:** Server-side wallet ownership verification using message signing
**When to use:** After wallet connection, before granting authenticated access

```typescript
// CLIENT: Request nonce and sign message
// packages/client/src/hooks/useWalletSession.ts
import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';

export function useWalletSession() {
  const { publicKey, signMessage, connected } = useWallet();

  const authenticate = async () => {
    if (!publicKey || !signMessage) throw new Error('Wallet not connected');

    // 1. Get nonce from server
    const { nonce, message } = await fetch(
      `/api/auth/nonce?address=${publicKey.toBase58()}`
    ).then(r => r.json());

    // 2. Sign the message
    const messageBytes = new TextEncoder().encode(message);
    const signature = await signMessage(messageBytes);

    // 3. Send signature to server for verification
    const response = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Important for cookies
      body: JSON.stringify({
        address: publicKey.toBase58(),
        signature: bs58.encode(signature),
        message,
        nonce
      })
    });

    if (!response.ok) throw new Error('Authentication failed');
    return response.json(); // { accessToken }
  };

  return { authenticate, connected, publicKey };
}
```

```typescript
// SERVER: Nonce generation and signature verification
// packages/server/src/routes/auth.ts
import { Router } from 'express';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { SignJWT } from 'jose';
import { redis } from '../lib/redis.js';

const router = Router();
const NONCE_TTL = 300; // 5 minutes
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

// Generate nonce
router.get('/nonce', async (req, res) => {
  const { address } = req.query;
  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Address required' });
  }

  // Generate cryptographically secure nonce
  const nonce = crypto.randomBytes(16).toString('base64url');

  // Store in Redis with TTL
  await redis.set(`nonce:${address}`, nonce, 'EX', NONCE_TTL);

  // SIWS-compliant message format
  const message = [
    `landmind.app wants you to sign in with your Solana account:`,
    address,
    '',
    'Sign in to LandMind',
    '',
    `Nonce: ${nonce}`,
    `Issued At: ${new Date().toISOString()}`
  ].join('\n');

  res.json({ nonce, message });
});

// Verify signature
router.post('/verify', async (req, res) => {
  const { address, signature, message, nonce } = req.body;

  // 1. Verify nonce exists and matches
  const storedNonce = await redis.get(`nonce:${address}`);
  if (!storedNonce || storedNonce !== nonce) {
    return res.status(401).json({ error: 'Invalid or expired nonce' });
  }

  // 2. Delete nonce immediately (one-time use)
  await redis.del(`nonce:${address}`);

  // 3. Verify signature
  try {
    const publicKey = new PublicKey(address);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);

    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKey.toBytes()
    );

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  } catch (error) {
    return res.status(401).json({ error: 'Signature verification failed' });
  }

  // 4. Create or get user
  // (user creation/lookup logic here)

  // 5. Issue JWT
  const accessToken = await new SignJWT({
    sub: address,
    iat: Math.floor(Date.now() / 1000)
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(JWT_SECRET);

  // 6. Set httpOnly cookie
  res.cookie('session', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  });

  res.json({ accessToken });
});

export default router;
```

### Pattern 4: Balance & Transaction History Fetching

**What:** Query Solana RPC for balance and transaction history
**When to use:** After wallet connection, with auto-refresh

```typescript
// packages/client/src/lib/solana.ts
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

export async function getBalance(
  connection: Connection,
  publicKey: PublicKey
): Promise<number> {
  const lamports = await connection.getBalance(publicKey);
  return lamports / LAMPORTS_PER_SOL;
}

export async function getTransactionHistory(
  connection: Connection,
  publicKey: PublicKey,
  limit: number = 20
): Promise<TransactionInfo[]> {
  // Get signatures for address
  const signatures = await connection.getSignaturesForAddress(
    publicKey,
    { limit }
  );

  // Fetch full transaction details for each signature
  const transactions = await Promise.all(
    signatures.map(async (sig) => {
      const tx = await connection.getTransaction(sig.signature, {
        maxSupportedTransactionVersion: 0
      });
      return {
        signature: sig.signature,
        slot: sig.slot,
        blockTime: sig.blockTime,
        err: sig.err,
        memo: sig.memo,
        // Parse transaction for display
        ...parseTransaction(tx)
      };
    })
  );

  return transactions;
}

// Filter for LandMind program transactions only
const LANDMIND_PROGRAM_ID = 'YOUR_PROGRAM_ID'; // Set after deployment

export async function getLandMindTransactions(
  connection: Connection,
  publicKey: PublicKey,
  limit: number = 20
): Promise<TransactionInfo[]> {
  const allTx = await getTransactionHistory(connection, publicKey, limit * 5);

  // Filter to only transactions involving LandMind program
  return allTx.filter(tx =>
    tx.programIds?.includes(LANDMIND_PROGRAM_ID)
  ).slice(0, limit);
}
```

### Pattern 5: Zustand Store for Wallet Session

**What:** Client-side state for wallet session with localStorage persistence
**When to use:** Managing session state across page refreshes

```typescript
// packages/client/src/stores/walletStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface WalletSession {
  // Session state
  isAuthenticated: boolean;
  walletAddress: string | null;
  accessToken: string | null;
  sessionExpiry: number | null; // Unix timestamp

  // Actions
  setSession: (address: string, token: string, expiry: number) => void;
  clearSession: () => void;
  isSessionValid: () => boolean;
}

export const useWalletStore = create<WalletSession>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      walletAddress: null,
      accessToken: null,
      sessionExpiry: null,

      setSession: (address, token, expiry) => set({
        isAuthenticated: true,
        walletAddress: address,
        accessToken: token,
        sessionExpiry: expiry
      }),

      clearSession: () => set({
        isAuthenticated: false,
        walletAddress: null,
        accessToken: null,
        sessionExpiry: null
      }),

      isSessionValid: () => {
        const { sessionExpiry, isAuthenticated } = get();
        if (!isAuthenticated || !sessionExpiry) return false;
        return Date.now() < sessionExpiry;
      }
    }),
    {
      name: 'landmind-wallet-session',
      storage: createJSONStorage(() => localStorage),
      // Only persist these fields
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        walletAddress: state.walletAddress,
        sessionExpiry: state.sessionExpiry
        // Don't persist accessToken - rely on httpOnly cookie
      })
    }
  )
);
```

### Anti-Patterns to Avoid

- **Storing access tokens in localStorage:** Use httpOnly cookies for tokens, only store non-sensitive session metadata
- **Trusting client-side wallet connection as auth:** Always verify with server-side signature check
- **Calling connect() without user interaction:** Browser security requires user gesture
- **Ignoring wallet change events:** User may switch wallets in extension; check address on page load

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Wallet connection modal | Custom wallet list with icons | `<WalletModalProvider>` + `<WalletMultiButton>` | Handles wallet detection, icons, state |
| Signature verification | Manual Ed25519 implementation | `tweetnacl.sign.detached.verify()` or `@solana/wallet-standard-util.verifySignIn()` | Cryptographic edge cases |
| Nonce generation | `Math.random()` | `crypto.randomBytes()` | Must be cryptographically secure |
| Session expiry checks | Manual timestamp math | JWT `exp` claim + library validation | Standard, battle-tested |
| Base58 encoding | Custom implementation | `bs58` package | Standard Solana encoding |
| Lamports to SOL | Manual division | `LAMPORTS_PER_SOL` constant from @solana/web3.js | Avoids magic numbers |

**Key insight:** The Solana wallet adapter library handles the complex browser extension communication, wallet detection, and connection state. Building custom solutions leads to compatibility issues across different wallets.

## Common Pitfalls

### Pitfall 1: React Strict Mode Disconnection

**What goes wrong:** Wallet disconnects on page refresh in development mode
**Why it happens:** React Strict Mode runs effects twice; the cleanup function calls `adapter.disconnect()` unintentionally
**How to avoid:**
- Use production build for testing wallet flows
- Or temporarily disable Strict Mode when debugging wallet issues
**Warning signs:** `walletName` key disappears from localStorage on refresh

### Pitfall 2: autoConnect Not Working

**What goes wrong:** Setting `autoConnect={true}` doesn't reconnect wallet
**Why it happens:** autoConnect only works if wallet was previously connected AND the wallet adapter is detected
**How to avoid:**
- Ensure wallet extension is installed
- Check that wallet is unlocked
- Verify localStorage has the wallet name stored
**Warning signs:** `connecting` stays false, no connection attempt visible

### Pitfall 3: publicKey is null After Connection

**What goes wrong:** `useWallet().publicKey` returns null even after `connected` is true
**Why it happens:** Race condition between connection state and publicKey availability
**How to avoid:** Always check both `connected && publicKey` before using publicKey
**Warning signs:** Type errors when calling `publicKey.toBase58()`

### Pitfall 4: CORS Issues with Auth Endpoints

**What goes wrong:** 401 errors or cookies not being set
**Why it happens:** Credentials not included in fetch, or CORS not configured for credentials
**How to avoid:**
```typescript
// Client
fetch('/api/auth/verify', { credentials: 'include' })

// Server (Express)
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
```
**Warning signs:** Cookie visible in response but not stored

### Pitfall 5: Session Invalid After Wallet Switch

**What goes wrong:** User switches wallet in Phantom, but app still shows old address
**Why it happens:** No event listener for wallet change, or page doesn't re-verify
**How to avoid:**
```typescript
// Check wallet address matches session on mount
useEffect(() => {
  if (publicKey && storedAddress && publicKey.toBase58() !== storedAddress) {
    // Wallet changed - clear session and prompt re-auth
    clearSession();
    showReconnectModal();
  }
}, [publicKey, storedAddress]);
```
**Warning signs:** Wrong address displayed, transactions fail

### Pitfall 6: Transaction History Empty for New Wallets

**What goes wrong:** `getSignaturesForAddress` returns empty array
**Why it happens:** New wallet has no transactions yet
**How to avoid:** Handle empty state gracefully, show "No transactions yet" message
**Warning signs:** UI shows loading forever or crashes on empty array

## Code Examples

Verified patterns from official sources:

### Connect Button Component

```typescript
// packages/client/src/components/wallet/ConnectButton.tsx
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

export function ConnectButton() {
  const { connected, connecting, publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  if (connecting) {
    return (
      <button disabled className="wallet-button connecting">
        Connecting...
      </button>
    );
  }

  if (connected && publicKey) {
    return (
      <button
        onClick={() => disconnect()}
        className="wallet-button connected"
      >
        {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
      </button>
    );
  }

  return (
    <button
      onClick={() => setVisible(true)}
      className="wallet-button"
    >
      Connect Wallet
    </button>
  );
}
```

### Balance Display with Auto-Refresh

```typescript
// packages/client/src/components/wallet/BalanceDisplay.tsx
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useEffect, useState } from 'react';

const REFRESH_INTERVAL = 30_000; // 30 seconds per CONTEXT.md

export function BalanceDisplay() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!connected || !publicKey) {
      setBalance(null);
      return;
    }

    const fetchBalance = async () => {
      setLoading(true);
      try {
        const lamports = await connection.getBalance(publicKey);
        setBalance(lamports / LAMPORTS_PER_SOL);
      } catch (err) {
        console.error('Failed to fetch balance:', err);
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchBalance();

    // Auto-refresh interval
    const interval = setInterval(fetchBalance, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [connection, publicKey, connected]);

  if (!connected) return null;

  return (
    <span className="balance">
      {loading ? '...' : balance?.toFixed(4)} SOL
    </span>
  );
}
```

### Auth Middleware (Server)

```typescript
// packages/server/src/middleware/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export interface AuthenticatedRequest extends Request {
  walletAddress?: string;
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const token = req.cookies?.session ||
    req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No session token' });
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    req.walletAddress = payload.sub as string;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| connect + signMessage (2 steps) | SIWS signIn (1 step) | Phantom 23.11 (late 2023) | Better UX, standardized |
| @solana/web3.js only | Wallet Standard auto-detection | 2023 | No need to list wallets manually |
| Custom wallet list | Empty wallets array + auto-detect | 2023 | Works with any Wallet Standard wallet |
| getSignaturesForAddress + getTransaction | Helius getTransactionsForAddress | 2024 | Single call for full tx data |

**Deprecated/outdated:**
- `@solana/wallet-adapter-wallets` individual adapters: Modern wallets implement Wallet Standard, no need for specific adapters
- Manual wallet adapter initialization: Wallet Standard handles detection

## Open Questions

Things that couldn't be fully resolved:

1. **React 19 Peer Dependency**
   - What we know: @solana/wallet-adapter-react 0.15.39 doesn't explicitly list React 19 in peer deps
   - What's unclear: Whether it works without issues or needs `--legacy-peer-deps`
   - Recommendation: Test with React 19, use npm overrides if peer dep errors

2. **SIWS vs Legacy signMessage**
   - What we know: SIWS is better UX but requires wallet support
   - What's unclear: Exact wallet coverage in 2026
   - Recommendation: Implement both paths - use SIWS if available, fall back to connect + signMessage

3. **Helius getTransactionsForAddress Rate Limits**
   - What we know: Combines two RPC calls into one
   - What's unclear: Rate limits on free/paid tiers for this specific method
   - Recommendation: Use standard RPC methods initially, upgrade to Helius enhanced API if needed

## Sources

### Primary (HIGH confidence)
- [Solana Wallet Adapter Documentation](https://solana.com/developers/cookbook/wallets/connect-wallet-react) - Official setup guide
- [anza-xyz/wallet-adapter GitHub](https://github.com/anza-xyz/wallet-adapter) - Source repository
- [Phantom SIWS Documentation](https://phantom.com/learn/developers/sign-in-with-solana) - SIWS specification
- [phantom/sign-in-with-solana GitHub](https://github.com/phantom/sign-in-with-solana) - SIWS reference implementation
- [Solana RPC HTTP Methods](https://solana.com/docs/rpc/http) - getBalance, getSignaturesForAddress, getTransaction

### Secondary (MEDIUM confidence)
- [QuickNode Solana Auth Guide](https://www.quicknode.com/guides/solana-development/dapps/how-to-authenticate-users-with-a-solana-wallet) - Auth flow patterns
- [DEV.to NestJS Solana Auth](https://dev.to/david_essien/how-to-authenticate-users-with-solana-wallets-in-nestjs-46gd) - Server-side implementation
- [Zustand Persist Documentation](https://zustand.docs.pmnd.rs/middlewares/persist) - State persistence patterns

### Tertiary (LOW confidence)
- WebSearch results on React 19 compatibility - needs validation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Anza packages, well-documented
- Architecture: HIGH - Standard patterns from official docs and production apps
- Pitfalls: HIGH - Documented in GitHub issues, verified with official sources
- SIWS implementation: MEDIUM - Newer pattern, some variation in implementations

**Research date:** 2026-01-20
**Valid until:** 2026-02-20 (30 days - wallet adapter ecosystem is stable)
