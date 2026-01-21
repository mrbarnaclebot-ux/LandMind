/**
 * React hook for Umi instance with wallet identity
 * Based on: https://developers.metaplex.com/umi/getting-started
 *
 * Returns null when wallet not connected - components must handle this gracefully
 */
import { useMemo, useEffect, useState } from 'react';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplBubblegum } from '@metaplex-foundation/mpl-bubblegum';
import { dasApi } from '@metaplex-foundation/digital-asset-standard-api';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { useWallet } from '@solana/wallet-adapter-react';
import type { Umi } from '@metaplex-foundation/umi';
import { RPC_URL } from '../lib/umi';

export function useUmi(): Umi | null {
  const wallet = useWallet();
  const [umi, setUmi] = useState<Umi | null>(null);

  // Create base Umi instance (stable reference, doesn't change)
  const baseUmi = useMemo(() => {
    return createUmi(RPC_URL)
      .use(mplBubblegum())
      .use(dasApi());
  }, []);

  // Update identity when wallet connects/disconnects
  useEffect(() => {
    if (wallet.connected && wallet.publicKey) {
      // Clone base instance and add wallet identity
      const umiWithIdentity = baseUmi.use(walletAdapterIdentity(wallet));
      setUmi(umiWithIdentity);
    } else {
      setUmi(null);
    }
  }, [wallet.connected, wallet.publicKey, baseUmi, wallet]);

  return umi;
}
