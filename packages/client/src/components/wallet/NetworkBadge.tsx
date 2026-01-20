import { FC } from 'react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

interface NetworkBadgeProps {
  network: WalletAdapterNetwork;
}

const badgeStyle: React.CSSProperties = {
  backgroundColor: '#9945FF',
  color: 'white',
  padding: '2px 8px',
  borderRadius: '4px',
  fontSize: '11px',
  fontWeight: 'bold',
  textTransform: 'uppercase',
  marginRight: '8px'
};

/**
 * Shows network badge for non-mainnet networks.
 * Hidden on mainnet-beta (production).
 */
export const NetworkBadge: FC<NetworkBadgeProps> = ({ network }) => {
  // Don't show badge on mainnet
  if (network === WalletAdapterNetwork.Mainnet) {
    return null;
  }

  return <span style={badgeStyle}>{network}</span>;
};
