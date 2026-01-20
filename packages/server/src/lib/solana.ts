import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

/**
 * Verify an Ed25519 signature from a Solana wallet.
 * @param message - The original message that was signed (as string)
 * @param signature - Base58-encoded signature from wallet
 * @param publicKeyStr - Base58-encoded public key (wallet address)
 * @returns true if signature is valid, false otherwise
 */
export function verifySignature(
  message: string,
  signature: string,
  publicKeyStr: string
): boolean {
  try {
    const publicKey = new PublicKey(publicKeyStr);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);

    return nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKey.toBytes()
    );
  } catch {
    return false;
  }
}
