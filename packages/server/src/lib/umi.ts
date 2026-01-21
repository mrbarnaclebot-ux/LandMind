/**
 * Server-side Umi setup for cNFT operations
 * Configured with keypair identity for minting agents
 */
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplBubblegum } from '@metaplex-foundation/mpl-bubblegum';
import { dasApi } from '@metaplex-foundation/digital-asset-standard-api';
import { keypairIdentity, Umi } from '@metaplex-foundation/umi';
import bs58 from 'bs58';

let serverUmi: Umi | null = null;

/**
 * Creates a new Umi instance configured for server operations
 * Includes Bubblegum (cNFT minting) and DAS API (asset querying)
 */
export function createServerUmi(): Umi {
  const rpcUrl = process.env.HELIUS_RPC_URL || process.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com';

  const umi = createUmi(rpcUrl)
    .use(mplBubblegum())
    .use(dasApi());

  // Load server keypair from env for signing transactions
  const secretKeyBase58 = process.env.SERVER_WALLET_SECRET;
  if (secretKeyBase58) {
    const secretKey = bs58.decode(secretKeyBase58);
    const keypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
    umi.use(keypairIdentity(keypair));
  }

  return umi;
}

/**
 * Returns a singleton Umi instance for server operations
 * Lazy-initialized on first call
 */
export function getServerUmi(): Umi {
  if (!serverUmi) {
    serverUmi = createServerUmi();
  }
  return serverUmi;
}
