import { createSolanaRpc, signature } from '@solana/kit';
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

export const waitForSolanaReceipt = async (
  client: ReturnType<typeof createSolanaRpc>,
  txHash: string
) => {
  let retries = 0;
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  let delay = 500;

  for (retries = 0; retries < 10; retries++) {
    const receipt = await client.getTransaction(signature(txHash)).send();
    if (receipt) {
      return receipt;
    }
    await sleep(delay);
    delay *= 2;
  }
  throw new Error('Transaction failed on chain');
};
