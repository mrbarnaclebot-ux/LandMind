/**
 * One-time script to create Merkle tree for cNFT storage
 *
 * Run from packages/server directory:
 *   npx tsx scripts/createMerkleTree.ts
 *
 * After success, copy MERKLE_TREE_ADDRESS to .env
 */
import path from 'path';
import { config } from 'dotenv';

// Load .env from project root (two levels up from packages/server)
config({ path: path.resolve(process.cwd(), '../../.env') });

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplBubblegum, createTree } from '@metaplex-foundation/mpl-bubblegum';
import { keypairIdentity, generateSigner } from '@metaplex-foundation/umi';
import bs58 from 'bs58';

async function main() {
  const rpcUrl = process.env.HELIUS_RPC_URL || process.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  console.log('Using RPC:', rpcUrl);

  const umi = createUmi(rpcUrl).use(mplBubblegum());

  // Load keypair - required for tree creation
  const secretKeyBase58 = process.env.SERVER_WALLET_SECRET;
  if (!secretKeyBase58) {
    console.error('Error: SERVER_WALLET_SECRET env var required');
    console.error('Generate a keypair and add to .env:');
    console.error('  solana-keygen new --outfile ~/.config/solana/server-keypair.json');
    console.error('  Then encode with: cat keypair.json | npx tsx -e "console.log(require(\'bs58\').encode(require(\'./keypair.json\')))"');
    process.exit(1);
  }

  const secretKey = bs58.decode(secretKeyBase58);
  const keypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
  umi.use(keypairIdentity(keypair));

  console.log('Tree creator:', keypair.publicKey);

  // Generate a new keypair for the tree account
  const merkleTree = generateSigner(umi);
  console.log('Creating Merkle tree:', merkleTree.publicKey);

  // Create tree with optimized parameters:
  // - maxDepth: 14 = 16,384 max cNFTs (2^14)
  // - maxBufferSize: 64 = concurrent updates supported
  // - canopyDepth: 8 = reduces proof size for transfers, lowering transaction size
  console.log('Configuration:');
  console.log('  maxDepth: 14 (16,384 max agents)');
  console.log('  maxBufferSize: 64 (concurrent minting support)');
  console.log('  canopyDepth: 8 (reduced proof size)');

  try {
    const tx = await createTree(umi, {
      merkleTree,
      maxDepth: 14,
      maxBufferSize: 64,
      canopyDepth: 8,
    }).sendAndConfirm(umi);

    console.log('');
    console.log('Tree created successfully!');
    console.log('Signature:', bs58.encode(tx.signature));
    console.log('');
    console.log('=====================================');
    console.log('Add to .env:');
    console.log(`MERKLE_TREE_ADDRESS=${merkleTree.publicKey}`);
    console.log('=====================================');
  } catch (error) {
    console.error('Failed to create tree:', error);
    process.exit(1);
  }
}

main().catch(console.error);
