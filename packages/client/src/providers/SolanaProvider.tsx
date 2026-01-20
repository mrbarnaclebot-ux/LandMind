import { FC, ReactNode, useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider
} from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

// Import wallet adapter default styles
import '@solana/wallet-adapter-react-ui/styles.css';

interface SolanaProviderProps {
  children: ReactNode;
}

/**
 * Provides Solana wallet context to the entire application.
 * - ConnectionProvider: RPC connection to Solana cluster
 * - WalletProvider: Wallet state management (empty wallets array = Wallet Standard auto-detection)
 * - WalletModalProvider: Modal UI for wallet selection
 */
export const SolanaProvider: FC<SolanaProviderProps> = ({ children }) => {
  // Use devnet for development - switch to mainnet-beta for production
  const network = WalletAdapterNetwork.Devnet;

  // Use custom RPC endpoint if provided, otherwise use public cluster URL
  const endpoint = useMemo(() => {
    return import.meta.env.VITE_SOLANA_RPC_URL || clusterApiUrl(network);
  }, [network]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      {/* Empty wallets array - Wallet Standard auto-detects installed wallets (Phantom, Solflare, etc.) */}
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
