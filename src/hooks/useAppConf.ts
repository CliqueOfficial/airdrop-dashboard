import { Accessor, createResource, createSignal } from 'solid-js';
import { useConfig } from './useConfig';
import { AppConf, Deployment } from '../types';

export const useAppConf = (appId: Accessor<string>) => {
  const { config } = useConfig();

  const [appConf, { refetch }] = createResource(appId, async (appId) => {
    if (!appId) {
      return null;
    }

    const response = await fetch(`${config().baseUrl}/admin/app_conf/${appId}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config().apiKey,
      },
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch app conf: ${response.statusText}`);
    }
    return response.json() as Promise<AppConf>;
  });

  const deployments = () => appConf()?.deployments || ({} as Record<string, Deployment>);

  const update = async (appConf: AppConf) => {
    if (!appConf.appId) {
      throw new Error('App ID is required');
    }
    const response = await fetch(`${config().baseUrl}/admin/app_conf/${appConf.appId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config().apiKey,
      },
      body: JSON.stringify(appConf),
    });

    if (!response.ok) {
      throw new Error(`Failed to save app conf: ${response.statusText}`);
    }
  };

  return { appConf, deployments, refetch, update };
};
