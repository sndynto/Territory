import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { monad, monadTestnet } from './chains';

const useMainnet = process.env.NEXT_PUBLIC_CHAIN === 'mainnet';

export const wagmiConfig = getDefaultConfig({
  appName: 'Territory',
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? 'demo',
  chains: useMainnet ? [monad, monadTestnet] : [monadTestnet, monad],
  transports: { [monad.id]: http(), [monadTestnet.id]: http() },
  ssr: true,
});
