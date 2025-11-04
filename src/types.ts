export interface AppConfExtra {
  root: Record<string, string>;
  tosTemplate: string;
  tosMessage: string;
  partialClaim?: {
    url: string;
    responseMapping: string;
  };
  [key: string]: any;
}

export interface Relayer {
  address: string;
  chainId: string;
  nonce: string;
  online: boolean;
}

export interface DeploymentExtra {
  configurations?: Record<string, Configuration>;
  [key: string]: any;
}

export interface Configuration {
  strategy: Strategy[];
  fallbackIdx: string;
  deployed: boolean;
}

export interface Strategy {
  hook: string;
  proportion: string;
}

export interface AppConf {
  appId: string;
  deployments: Record<string, Deployment>;
  gated: boolean;
  uniqueDevice: boolean;
  extra: AppConfExtra;
}

export interface Deployment {
  chainId: string;
  rpcUrl: string;
  roles: Record<string, string>;
  extra: DeploymentExtra;
}

export interface EnvConfig {
  apiKey: string;
  baseUrl: string;
}
