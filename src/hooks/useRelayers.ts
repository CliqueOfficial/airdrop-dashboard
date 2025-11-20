import { createResource } from 'solid-js';
import { useConfig } from './useConfig';
import { Relayer } from '../types';

export const useRelayers = (appId: string) => {
  const { config } = useConfig();
  const [relayers, { refetch }] = createResource(
    () => ({ appId, baseUrl: config().baseUrl, apiKey: config().apiKey }),
    async ({ appId, baseUrl, apiKey }) => {
      const response = await fetch(`${baseUrl}/admin/relayer/${appId}`, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch relayers: ${response.statusText}`);
      }
      return response.json() as Promise<Relayer[]>;
    }
  );

  return { relayers, refetch };
};
