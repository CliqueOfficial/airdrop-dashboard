export interface AppConfExtra {
  root: Record<string, string>;
  tosTemplate: string;
  tosMessage: string;
  [key: string]: any;
}

export interface DeploymentExtra {
  root?: Record<string, string>;
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