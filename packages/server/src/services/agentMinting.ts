/**
 * Agent cNFT minting service
 * Mints compressed NFTs representing agents using Metaplex Bubblegum
 */
import { getServerUmi } from '../lib/umi.js';
import { mintV1 } from '@metaplex-foundation/mpl-bubblegum';
import { publicKey, none } from '@metaplex-foundation/umi';
import bs58 from 'bs58';

const MERKLE_TREE_ADDRESS = process.env.MERKLE_TREE_ADDRESS || '';

// Server base URL for metadata
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';

export interface MintResult {
  signature: string;
  assetId: string;
}

/**
 * Mint a new agent cNFT to the specified owner
 * @param ownerAddress - Wallet address to own the cNFT
 * @param agentId - Internal agent UUID
 * @param agentIndex - On-chain agent index
 * @returns Transaction signature and asset ID
 */
export async function mintAgentNFT(
  ownerAddress: string,
  agentId: string,
  agentIndex: number
): Promise<MintResult> {
  if (!MERKLE_TREE_ADDRESS) {
    throw new Error('MERKLE_TREE_ADDRESS not configured');
  }

  const umi = getServerUmi();

  // Mint the cNFT
  const result = await mintV1(umi, {
    leafOwner: publicKey(ownerAddress),
    merkleTree: publicKey(MERKLE_TREE_ADDRESS),
    metadata: {
      name: `LandMind Agent #${agentIndex}`,
      symbol: 'LMAG',
      uri: `${SERVER_URL}/api/agents/${agentId}/metadata`,
      sellerFeeBasisPoints: 0, // No royalties on agents
      collection: none(),
      creators: [],
    },
  }).sendAndConfirm(umi);

  return {
    signature: bs58.encode(result.signature),
    assetId: result.result.assetId?.toString() || '',
  };
}

/**
 * Get agent metadata for cNFT URI
 * Returns JSON following Metaplex NFT standard
 */
export function getAgentMetadata(agentId: string, agentIndex: number) {
  return {
    name: `LandMind Agent #${agentIndex}`,
    symbol: 'LMAG',
    description: 'A mining agent in the LandMind metaverse. Earns passive income from PumpFun trading fees.',
    image: `${SERVER_URL}/assets/agent-nft.png`, // Placeholder - add actual image
    external_url: 'https://landmind.io',
    attributes: [
      {
        trait_type: 'Agent ID',
        value: agentId,
      },
      {
        trait_type: 'Agent Index',
        value: agentIndex,
      },
    ],
    properties: {
      category: 'image',
      files: [
        {
          uri: `${SERVER_URL}/assets/agent-nft.png`,
          type: 'image/png',
        },
      ],
    },
  };
}
