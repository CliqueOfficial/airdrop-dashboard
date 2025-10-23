import { Accessor, createContext } from 'solid-js';

export interface DeploymentContextProps {
  contractAddress: Accessor<`0x${string}`>;
  chainId: Accessor<bigint>;
  rpcUrl: Accessor<string>;
  appId: Accessor<string>;
  deployment: Accessor<string>;
  roles: Accessor<Record<string, `0x${string}`>>;
  configurationNames: Accessor<string[]>;
}

export const DeploymentContext = createContext<DeploymentContextProps | null>(null);
