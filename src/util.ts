import { createConfig, getPublicClient } from "@wagmi/core";
import { defineChain, http } from "viem";

export const createPublicClient = (chainId: string, rpcUrl: string) => {
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
      [chain.id]: http(rpcUrl),
    },
  });
  return getPublicClient(config);
};