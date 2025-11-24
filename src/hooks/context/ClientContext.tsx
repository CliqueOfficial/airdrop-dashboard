import { createSolanaRpc } from '@solana/kit';

import { createContext, JSX } from 'solid-js';
import { createEvmPublicClient } from '../../util';
import { Deployment } from '../../types';

export interface GeneralClient {
  chainId: string;
  asEvmClient: () => ReturnType<typeof createEvmPublicClient>;
  asSolanaClient: () => ReturnType<typeof createSolanaRpc>;
}

export interface ClientContextProps {
  getClient: (options: { chainId: string; rpcUrl?: string }) => GeneralClient | undefined;
}

export const ClientContext = createContext<ClientContextProps>({
  getClient: (options: { chainId: string; rpcUrl?: string }) => {
    return undefined;
  },
});

export const ClientContextProvider = (props: { children: JSX.Element }) => {
  const clients = new Map<string, GeneralClient>();
  const defineChain = (chainId: string, rpcUrl: string) => {
    if (clients.has(chainId)) {
      return;
    }
    if (chainId.startsWith('sol:')) {
      const client = createSolanaRpc(rpcUrl);
      clients.set(chainId, {
        chainId: chainId,
        asEvmClient: () => {
          throw new Error('Not supported');
        },
        asSolanaClient: () => client,
      });
    } else {
      const client = createEvmPublicClient(chainId, rpcUrl);
      clients.set(chainId, {
        chainId: chainId,
        asEvmClient: () => client,
        asSolanaClient: () => {
          throw new Error('Not supported');
        },
      });
    }
  };

  const getClient = (options: { chainId: string; rpcUrl?: string }) => {
    if (options.rpcUrl) {
      defineChain(options.chainId, options.rpcUrl);
    }
    return clients.get(options.chainId);
  };
  return <ClientContext.Provider value={{ getClient }}>{props.children}</ClientContext.Provider>;
};
