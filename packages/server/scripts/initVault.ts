/**
 * One-time script to initialize the FeeVaultState account
 *
 * Run from packages/server directory:
 *   npx tsx scripts/initVault.ts
 *
 * Requirements:
 *   - SERVER_WALLET_SECRET in .env (base58-encoded secret key)
 *   - Devnet SOL for transaction fees (~0.003 SOL)
 */
import path from 'path';
import { config } from 'dotenv';

// Load .env from local packages/server directory first, then root
config(); // loads from packages/server/.env
config({ path: path.resolve(process.cwd(), '../../.env') }); // also load root .env

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';

// Program ID
const PROGRAM_ID = new PublicKey('D4JvrX3Rtp9RTGUbLqxGcwYqYBtz3T5qZ1Q4hABXosSQ');

// initialize_vault discriminator from IDL
const INITIALIZE_VAULT_DISCRIMINATOR = Buffer.from([48, 191, 163, 44, 71, 129, 63, 164]);

// FeeVaultState size: 8 (discriminator) + 32 (authority) + 32 (merkle_root) + 8 (total_distributed) + 1 (paused) + 1 (bump)
const FEE_VAULT_STATE_SIZE = 8 + 32 + 32 + 8 + 1 + 1;

async function main() {
  console.log('=== LandMind Vault Initialization ===');
  console.log('');

  // Load server wallet
  const secretKeyBase58 = process.env.SERVER_WALLET_SECRET;
  if (!secretKeyBase58) {
    console.error('Error: SERVER_WALLET_SECRET env var required');
    console.error('');
    console.error('Generate a keypair and add to .env:');
    console.error('  solana-keygen new --outfile ~/.config/solana/server-keypair.json');
    console.error('  Then encode with base58 and add to .env as SERVER_WALLET_SECRET');
    process.exit(1);
  }

  let authority: Keypair;
  try {
    // Try base58-encoded secret key first
    const secretKey = bs58.decode(secretKeyBase58);
    authority = Keypair.fromSecretKey(secretKey);
  } catch {
    // Try JSON array format
    try {
      const secretKeyArray = JSON.parse(secretKeyBase58);
      authority = Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
    } catch {
      console.error('Error: Invalid SERVER_WALLET_SECRET format');
      console.error('Expected base58-encoded secret key or JSON array');
      process.exit(1);
    }
  }

  console.log('Authority:', authority.publicKey.toBase58());

  // Create connection
  const rpcUrl = process.env.HELIUS_RPC_URL ||
                 process.env.VITE_SOLANA_RPC_URL ||
                 'https://api.devnet.solana.com';
  console.log('RPC URL:', rpcUrl);

  const connection = new Connection(rpcUrl, 'confirmed');

  // Check authority balance
  const balance = await connection.getBalance(authority.publicKey);
  console.log('Authority balance:', balance / 1e9, 'SOL');

  if (balance < 5_000_000) { // 0.005 SOL minimum
    console.error('');
    console.error('Error: Insufficient balance for transaction fees');
    console.error('Request an airdrop: solana airdrop 1 --url devnet');
    process.exit(1);
  }

  // Derive vault_state PDA
  const [vaultState, vaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault_state')],
    PROGRAM_ID
  );
  console.log('Vault State PDA:', vaultState.toBase58());
  console.log('Vault Bump:', vaultBump);

  // Check if already initialized
  const existingAccount = await connection.getAccountInfo(vaultState);
  if (existingAccount) {
    console.log('');
    console.log('Vault already initialized!');
    console.log('Account size:', existingAccount.data.length, 'bytes');
    console.log('Owner:', existingAccount.owner.toBase58());

    // Parse and display current state
    if (existingAccount.data.length >= FEE_VAULT_STATE_SIZE) {
      const data = existingAccount.data;
      // Skip 8-byte discriminator
      const storedAuthority = new PublicKey(data.slice(8, 40));
      const merkleRoot = data.slice(40, 72);
      const totalDistributed = data.readBigUInt64LE(72);
      const paused = data[80] === 1;

      console.log('');
      console.log('Current state:');
      console.log('  Authority:', storedAuthority.toBase58());
      console.log('  Merkle root:', Buffer.from(merkleRoot).toString('hex'));
      console.log('  Total distributed:', totalDistributed.toString(), 'lamports');
      console.log('  Paused:', paused);
    }

    return;
  }

  console.log('');
  console.log('Initializing vault...');

  // Build initialize_vault instruction
  const initializeVaultIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: vaultState, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: INITIALIZE_VAULT_DISCRIMINATOR,
  });

  // Create and send transaction
  const transaction = new Transaction().add(initializeVaultIx);

  try {
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [authority],
      { commitment: 'confirmed' }
    );

    console.log('');
    console.log('Vault initialized successfully!');
    console.log('Signature:', signature);
    console.log('');
    console.log('=====================================');
    console.log('Vault State PDA:', vaultState.toBase58());
    console.log('Authority:', authority.publicKey.toBase58());
    console.log('=====================================');
  } catch (error: unknown) {
    console.error('');
    console.error('Failed to initialize vault:');
    if (error instanceof Error) {
      console.error(error.message);
      if ('logs' in error && Array.isArray((error as { logs: unknown }).logs)) {
        console.error('Logs:', (error as { logs: string[] }).logs);
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
