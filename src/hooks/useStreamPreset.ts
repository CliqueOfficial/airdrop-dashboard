import { type Accessor, createMemo, createResource, useContext } from 'solid-js';
import type { PublicClient, TransactionReceipt } from 'viem';
import { useConfig } from './useConfig';
import CliqueLockHookAbi from '../abi/CliqueLockHook';
import { ClientContext } from './context/ClientContext';

export interface StreamPreset {
  startTime: bigint;
  cliffDuration: bigint;
  vestingDuration: bigint;
  startUnlockPercentage: bigint;
  cliffUnlockPercentage: bigint;
  pieceDuration: bigint;
  lock: `0x${string}`;
  isFixedStart: boolean;
}

interface UseStreamPresetProps {
  contractAddress: Accessor<`0x${string}`>;
  distributorAddress: Accessor<`0x${string}`>;
  configurationId: Accessor<`0x${string}`>;
  chainId: Accessor<bigint>;
  rpcUrl: Accessor<string>;
  appId: Accessor<string>;
  deployment: Accessor<string>;
  deployer: Accessor<string>;
}

// Helper: Fetch stream preset from chain
const fetchStreamPreset = async (
  client: PublicClient,
  contractAddress: `0x${string}`,
  distributorAddress: `0x${string}`,
  configurationId: `0x${string}`
): Promise<StreamPreset> => {
  const [
    startTime,
    cliffDuration,
    vestingDuration,
    startUnlockPercentage,
    cliffUnlockPercentage,
    pieceDuration,
    lock,
    isFixedStart,
  ] = await client.readContract({
    address: contractAddress,
    abi: CliqueLockHookAbi,
    functionName: 'streamPresets',
    args: [distributorAddress, configurationId],
  });

  return {
    startTime,
    cliffDuration,
    vestingDuration,
    startUnlockPercentage,
    cliffUnlockPercentage,
    pieceDuration,
    lock,
    isFixedStart,
  };
};

// Helper: Call API to set stream preset
const callSetPresetApi = async (
  baseUrl: string,
  apiKey: string,
  appId: string,
  deployment: string,
  deployer: string,
  configurationId: `0x${string}`,
  preset: StreamPreset
): Promise<`0x${string}`> => {
  const response = await fetch(`${baseUrl}/admin/relay/cliquelock-hook/set-preset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      appId,
      deployment,
      deployer,
      preset: configurationId,
      startTime: preset.startTime.toString(),
      cliffDuration: preset.cliffDuration.toString(),
      vestingDuration: preset.vestingDuration.toString(),
      startUnlockPercentage: preset.startUnlockPercentage.toString(),
      cliffUnlockPercentage: preset.cliffUnlockPercentage.toString(),
      pieceDuration: preset.pieceDuration.toString(),
      lock: preset.lock,
      isFixedStart: preset.isFixedStart,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to set stream preset: ${error}`);
  }

  const { txHash } = await response.json();
  return txHash as `0x${string}`;
};

export const useStreamPreset = ({
  contractAddress,
  distributorAddress,
  configurationId,
  chainId,
  rpcUrl,
  appId,
  deployment,
  deployer,
}: UseStreamPresetProps) => {
  const { config } = useConfig();
  const clientCtx = useContext(ClientContext);
  const client = createMemo(() => {
    return clientCtx.getClient({
      chainId: chainId().toString(),
      rpcUrl: rpcUrl(),
    });
  });

  // Read stream preset from chain
  const [data, { refetch }] = createResource(
    () => {
      if (
        !client()?.asEvmClient() ||
        !contractAddress() ||
        !distributorAddress() ||
        !configurationId() ||
        !chainId() ||
        !rpcUrl()
      ) {
        return undefined;
      }

      return {
        client: client()?.asEvmClient()!,
        contractAddress: contractAddress(),
        distributorAddress: distributorAddress(),
        configurationId: configurationId(),
      };
    },
    ({ client, contractAddress, distributorAddress, configurationId }) =>
      fetchStreamPreset(client, contractAddress, distributorAddress, configurationId)
  );

  // Update stream preset
  const update = async (preset: StreamPreset): Promise<TransactionReceipt> => {
    const currentClient = client()?.asEvmClient();
    if (!currentClient) throw new Error('Client not initialized');

    // Call API to submit transaction
    const txHash = await callSetPresetApi(
      config().baseUrl,
      config().apiKey,
      appId(),
      deployment(),
      deployer(),
      configurationId(),
      preset
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
    await refetch();

    return receipt;
  };

  return { data, update, refetch };
};
