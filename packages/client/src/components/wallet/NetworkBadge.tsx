import { FC } from 'react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import '../../styles/pixel-theme.css';

interface NetworkBadgeProps {
  network: WalletAdapterNetwork;
}

/**
 * Pixel-styled network badge with Minecraft voxel aesthetic.
 * Shows "DEV" or "TEST" with blocky 3D effects.
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
      className={`pixel-badge ${isDevnet ? 'pixel-badge-devnet' : 'pixel-badge-testnet'}`}
      style={{
        fontFamily: "var(--font-body)",
        fontSize: '13px',
        lineHeight: 1.5,
        padding: '6px 10px',
        color: 'var(--dusk-panel-lo)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        letterSpacing: '0.5px',
      }}
    >
      {/* Pixel art pickaxe icon */}
      <span
        className="pixel-pickaxe"
        style={{
          transform: 'scale(0.9)',
          marginTop: '-2px',
        }}
      />
      <span>{isDevnet ? 'DEV' : 'TEST'}</span>
    </span>
  );
};
