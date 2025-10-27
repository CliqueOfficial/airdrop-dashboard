import { Accessor, createMemo, createResource } from 'solid-js';
import LinearPenaltyHookAbi from '../abi/LinearPenaltyHook';
import { PublicClient, TransactionReceipt } from 'viem';
import { useConfig } from './useConfig';
import { createPublicClient } from '../util';

export interface LinearPenaltyConf {
  beginTime: bigint;
  endTime: bigint;
}

interface UseLinearPenaltyConfProps {
  contractAddress: Accessor<`0x${string}`>;
  configurationId: Accessor<`0x${string}`>;
  chainId: Accessor<bigint>;
  rpcUrl: Accessor<string>;
  appId: Accessor<string>;
  deployment: Accessor<string>;
  projectAdmin: Accessor<`0x${string}`>;
}

const fetchLinearPenaltyConf = async (
  client: PublicClient,
  contractAddress: `0x${string}`,
  configurationId: `0x${string}`
): Promise<LinearPenaltyConf> => {
  const [beginTime, endTime] = await client.readContract({
    address: contractAddress,
    abi: LinearPenaltyHookAbi,
    functionName: 'penaltyConfigs',
    args: [configurationId],
  });

  return {
    beginTime,
    endTime,
  };
};

interface SetPenaltyConfRequest {
  appId: string;
  deployment: string;
  projectAdmin: string;
  configurationId: `0x${string}`;
  penaltyConfig: {
    beginTime: string;
    endTime: string;
  };
}

const callSetPenaltyConfApi = async (
  baseUrl: string,
  apiKey: string,
  appId: string,
  deployment: string,
  deployer: string,
  configurationId: `0x${string}`,
  penaltyConf: LinearPenaltyConf
): Promise<`0x${string}`> => {
  const request: SetPenaltyConfRequest = {
    appId,
    deployment,
    projectAdmin: deployer,
    configurationId,
    penaltyConfig: {
      beginTime: penaltyConf.beginTime.toString(),
      endTime: penaltyConf.endTime.toString(),
    },
  };

  const response = await fetch(`${baseUrl}/admin/relay/linear-penalty-hook/set-penalty-config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(`Failed to set penalty config: ${await response.text()}`);
  }
  const { txHash } = await response.json();
  return txHash as `0x${string}`;
};

export const useLinearPenaltyConf = ({
  contractAddress,
  configurationId,
  chainId,
  rpcUrl,
  appId,
  deployment,
  projectAdmin,
}: UseLinearPenaltyConfProps) => {
  const { config } = useConfig();
  const client = createMemo(() => createPublicClient(chainId().toString(), rpcUrl()));

  const [data, { refetch }] = createResource(
    () => {
      if (!client() || !contractAddress() || !configurationId() || !chainId() || !rpcUrl()) {
        return undefined;
      }
      return {
        client: client()!,
        contractAddress: contractAddress(),
        configurationId: configurationId(),
      };
    },
    ({ client, contractAddress, configurationId }) =>
      fetchLinearPenaltyConf(client, contractAddress, configurationId)
  );

  const update = async (penaltyConf: LinearPenaltyConf): Promise<TransactionReceipt> => {
    const currentClient = client();
    if (!currentClient) throw new Error('Client not initialized');
    const txHash = await callSetPenaltyConfApi(
      config.baseUrl,
      config.apiKey,
      appId(),
      deployment(),
      projectAdmin(),
      configurationId(),
      penaltyConf
    );
    const receipt = await currentClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 60_000,
    });
    if (receipt.status !== 'success') {
      throw new Error('Transaction reverted');
    }
    await refetch();
    return receipt;
  };

  return { data, update, refetch };
};
