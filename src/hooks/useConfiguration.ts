import { type Accessor, createMemo, createResource, useContext } from 'solid-js';
import { keccak256, type PublicClient, type TransactionReceipt, toBytes, parseEther } from 'viem';
import { Configuration } from '../types';
import DistributorAbi from '../abi/Distributor';
import { useConfig } from './useConfig';
import { createPublicClient } from '../util';
import { DeploymentContext } from './context/Deployment';

interface UseConfigurationProps {
  contractAddress: Accessor<`0x${string}`>;
  configurationName: Accessor<string>;
  hookReverseMap: Accessor<Record<`0x${string}`, string>>;
  chainId: Accessor<bigint>;
  rpcUrl: Accessor<string>;
  appId: Accessor<string>;
  deployment: Accessor<string>;
  projectAdmin: Accessor<string>;
}

// Helper: Fetch configuration from chain
const fetchConfiguration = async (
  client: PublicClient,
  contractAddress: `0x${string}`,
  configurationName: string,
  hookReverseMap: Record<`0x${string}`, string>
): Promise<Configuration> => {
  const strategy = await client.readContract({
    address: contractAddress,
    abi: DistributorAbi,
    functionName: 'getBatchConfiguration',
    args: [keccak256(toBytes(configurationName))],
  });

  return {
    strategy: strategy.strategies.map((strategy) => ({
      hook: hookReverseMap[strategy.hook.toLowerCase() as `0x${string}`],
      proportion: strategy.proportion.toString(),
    })),
    fallbackIdx: strategy.fallbackHook.toString(),
    deployed: true,
  };
};

// Helper: Call API to apply configuration
const callApplyConfiguration = async (
  baseUrl: string,
  apiKey: string,
  appId: string,
  deployment: string,
  projectAdmin: string,
  name: string,
  configuration: Configuration
): Promise<`0x${string}`> => {
  const response = await fetch(`${baseUrl}/admin/relay/distributor/set-hook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      appId,
      deployment,
      hookName: name,
      projectAdmin,
      strategy: configuration.strategy,
      fallbackIdx: configuration.fallbackIdx,
    }),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to apply configuration: ${error}`);
  }
  const { txHash } = await response.json();
  return txHash as `0x${string}`;
};

export const useConfiguration = ({
  contractAddress,
  configurationName,
  hookReverseMap,
  chainId,
  rpcUrl,
  appId,
  deployment,
  projectAdmin,
}: UseConfigurationProps) => {
  const { config } = useConfig();
  const { roles } = useContext(DeploymentContext)!;
  const client = createMemo(() => createPublicClient(chainId().toString(), rpcUrl()));

  // Read configuration from chain
  const [data, { refetch }] = createResource(
    () => {
      if (
        !client() ||
        !contractAddress() ||
        !configurationName() ||
        !hookReverseMap() ||
        !chainId() ||
        !rpcUrl()
      ) {
        return undefined;
      }

      return {
        client: client()!,
        contractAddress: contractAddress(),
        configurationName: configurationName(),
        hookReverseMap: hookReverseMap(),
      };
    },
    async (
      { client, contractAddress, configurationName, hookReverseMap },
      { value, refetching }
    ): Promise<Configuration> => {
      console.log('refetching', refetching);
      console.log('value', JSON.stringify(value, null, 2));
      return fetchConfiguration(client, contractAddress, configurationName, hookReverseMap);
    }
  );

  // Update configuration
  const update = async (configuration: Configuration): Promise<TransactionReceipt> => {
    const currentClient = client();
    if (!currentClient) throw new Error('Client not initialized');

    const applyingConfiguration = {
      strategy: configuration.strategy.map((strategy) => ({
        hook: roles()[strategy.hook] as `0x${string}`, // convert name to address
        proportion: (parseEther(strategy.proportion) / 100n).toString(), // convert percentage to fixed point
      })),
      fallbackIdx: configuration.fallbackIdx,
      deployed: false, // It doesn't matter
    };

    // Call API to submit transaction
    const txHash = await callApplyConfiguration(
      config.baseUrl,
      config.apiKey,
      appId(),
      deployment(),
      projectAdmin(),
      configurationName(),
      applyingConfiguration
    );

    // Wait for confirmation
    const receipt = await currentClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 60_000,
    });

    if (receipt.status !== 'success') {
      throw new Error('Transaction reverted');
    }

    // Refetch to ensure consistency
    refetch();

    return receipt;
  };

  return { data, update, refetch };
};
