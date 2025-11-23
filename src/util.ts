import { createConfig, getPublicClient } from '@wagmi/core';
import { defineChain, http } from 'viem';

export const createEvmPublicClient = (chainId: string, rpcUrl: string) => {
  const chain = defineChain({
    id: parseInt(chainId),
    name: 'Chain ' + chainId,
    nativeCurrency: {
      name: 'Chain ' + chainId,
      symbol: 'CHAIN' + chainId,
      decimals: 18,
    },
    rpcUrls: {
      default: { http: [rpcUrl] },
    },
  });

  const config = createConfig({
    chains: [chain],
    transports: {
      [chain.id]: http(rpcUrl, {
        batch: {
          batchSize: 3,
          wait: 500,
        },
      }),
    },
  });
  return getPublicClient(config);
};
