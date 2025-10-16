import { createEffect, createMemo, createResource, createSignal } from 'solid-js';
import { useConfig } from './useConfig';
import { createStore } from 'solid-js/store';
import { createConfig } from 'wagmi';
import { defineChain } from 'viem';

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

export const useCurrentAppConf = () => {
  const { config } = useConfig();
  const [isCreating, setIsCreating] = createSignal(false);
  const [appConf, setAppConf] = createStore<AppConf>({
    appId: config.currentAppId,
    deployments: {},
    gated: false,
    uniqueDevice: false,
    extra: {
      root: {},
      tosTemplate: '',
      tosMessage: '',
    },
  });

  const [data, { refetch }] = createResource(
    () => config.baseUrl,
    async (baseUrl: string) => {
      const data = await fetch(`${baseUrl}/admin/app_conf`, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
        },
      });
      const json = await data.json();
      return json as AppConf[];
    }
  );

  createEffect(() => {
    if (data.state === 'ready') {
      const _appConf = data().find((appConf) => appConf.appId === config.currentAppId);
      if (_appConf) {
        const deployments = Object.entries(_appConf.deployments).map(([key, value]) => {
          if (!('root' in value.extra)) {
            value.extra.root = {};
          }
          if (!('configurations' in value.extra)) {
            value.extra.configurations = {};
          }
          return [key, value];
        });
        setAppConf({
          ..._appConf,
          deployments: Object.fromEntries(deployments),
        });
      } else {
        setIsCreating(true);
      }
    }
  }, [data]);

  const appRoot = () => appConf.extra.root;
  const deployment = (name: string): Deployment | undefined =>
    name in appConf.deployments ? appConf.deployments[name] : undefined;
  const setDeployment = (name: string, deployment: Deployment) =>
    setAppConf('deployments', name, deployment);
  const setGated = (gated: boolean) => setAppConf('gated', gated);
  const setUniqueDevice = (uniqueDevice: boolean) => setAppConf('uniqueDevice', uniqueDevice);
  const setTosTemplate = (tosTemplate: string) => setAppConf('extra', 'tosTemplate', tosTemplate);
  const setTosMessage = (tosMessage: string) => setAppConf('extra', 'tosMessage', tosMessage);

  return {
    loading: () => data.state !== 'ready',
    isCreating,
    appConf,
    appRoot,
    deployment,
    setDeployment,
    setGated,
    setUniqueDevice,
    setTosTemplate,
    setTosMessage,
    refetch,
  };
};
