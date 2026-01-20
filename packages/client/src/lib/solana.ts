import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

/**
 * Get SOL balance for a wallet address.
 * @param connection - Solana RPC connection
 * @param publicKey - Wallet public key
 * @returns Balance in SOL (not lamports)
 */
export async function getBalance(
  connection: Connection,
  publicKey: PublicKey
): Promise<number> {
  const lamports = await connection.getBalance(publicKey);
  return lamports / LAMPORTS_PER_SOL;
}

/**
 * Format a wallet address for display (truncated).
 * @param address - Full base58 wallet address
 * @param chars - Number of characters to show on each end (default 4)
 * @returns Truncated address like "DzP4...7xKm"
 */
export function formatAddress(address: string, chars: number = 4): string {
  if (address.length <= chars * 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Format SOL amount for display.
 * @param sol - Amount in SOL
 * @param decimals - Decimal places to show (default 4)
 * @returns Formatted string like "1.2345 SOL"
 */
export function formatSol(sol: number, decimals: number = 4): string {
  return `${sol.toFixed(decimals)} SOL`;
}

/**
 * Get Solana explorer URL for an address or transaction.
 * @param value - Wallet address or transaction signature
 * @param type - 'address' or 'tx'
 * @param cluster - Network cluster (default 'devnet')
 * @returns Explorer URL
 */
export function getExplorerUrl(
  value: string,
  type: 'address' | 'tx' = 'address',
  cluster: 'devnet' | 'mainnet-beta' = 'devnet'
): string {
  const base = 'https://explorer.solana.com';
  const path = type === 'address' ? 'address' : 'tx';
  const clusterParam = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`;
  return `${base}/${path}/${value}${clusterParam}`;
}

/**
 * API base URL for server requests.
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
