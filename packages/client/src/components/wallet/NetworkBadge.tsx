import { FC } from 'react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import '../../styles/pixel-theme.css';

interface NetworkBadgeProps {
  network: WalletAdapterNetwork;
}

/**
 * Pixel-styled network badge.
 * Shows "DEVNET" or "TESTNET" with Minecraft aesthetic.
 * Hidden on mainnet-beta (production).
 */
export const NetworkBadge: FC<NetworkBadgeProps> = ({ network }) => {
  // Don't show badge on mainnet
  if (network === WalletAdapterNetwork.Mainnet) {
    return null;
  }

  const isDevnet = network === WalletAdapterNetwork.Devnet;

  return (
    <span
      className="pixel-badge"
      style={{
        background: isDevnet ? '#55CDFC' : '#FFAA00',
        boxShadow: isDevnet
          ? 'inset -2px -2px 0 0 #35ADDC, inset 2px 2px 0 0 #85EDFF'
          : 'inset -2px -2px 0 0 #CC8800, inset 2px 2px 0 0 #FFCC44',
      }}
    >
      {isDevnet ? '⛏ DEV' : '⚗ TEST'}
    </span>
  );
};
