/**
 * Agent cNFT minting service
 * Mints compressed NFTs representing agents using Metaplex Bubblegum
 */
import { getServerUmi } from '../lib/umi.js';
import { mintV1, findLeafAssetIdPda } from '@metaplex-foundation/mpl-bubblegum';
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
 * @param agentIndex - On-chain agent index (also used as leaf index)
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
  const merkleTreePubkey = publicKey(MERKLE_TREE_ADDRESS);

  // Mint the cNFT
  const result = await mintV1(umi, {
    leafOwner: publicKey(ownerAddress),
    merkleTree: merkleTreePubkey,
    metadata: {
      name: `LandMind Agent #${agentIndex}`,
      symbol: 'LMAG',
      uri: `${SERVER_URL}/api/agents/${agentId}/metadata`,
      sellerFeeBasisPoints: 0, // No royalties on agents
      collection: none(),
      creators: [],
    },
  }).sendAndConfirm(umi);

  // Derive asset ID from merkle tree and leaf index
  // Note: The leaf index is based on the tree's current state
  // For simplicity, we use agentIndex as a proxy (may need adjustment for production)
  const [assetId] = findLeafAssetIdPda(umi, {
    merkleTree: merkleTreePubkey,
    leafIndex: agentIndex - 1, // Zero-indexed
  });

  return {
    signature: bs58.encode(result.signature),
    assetId: assetId.toString(),
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
