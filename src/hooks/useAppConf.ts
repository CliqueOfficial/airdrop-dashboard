import { Accessor, createResource } from 'solid-js';
import { useConfig } from './useConfig';
import { AppConf, Deployment } from '../types';

export const useAppConf = (appId: Accessor<string>) => {
  const { config } = useConfig();

  const [appConf, { refetch }] = createResource(appId, async (appId) => {
    const response = await fetch(`${config.baseUrl}/admin/app_conf/${appId}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch app conf: ${response.statusText}`);
    }
    return response.json() as Promise<AppConf>;
  });

  const deployments = () => appConf()?.deployments || ({} as Record<string, Deployment>);

  return { appConf, deployments, refetch };
};
