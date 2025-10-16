import { useParams } from '@solidjs/router';
import { useCurrentAppConf } from '../hooks/useAppConf';
import { createMemo, createResource, Show } from 'solid-js';
import { createPublicClient, defineChain, http, maxUint256, parseAbiItem } from 'viem';
import { createConfig } from 'wagmi';
import { getPublicClient } from '@wagmi/core';

interface DeploymentParams {
  appId: string;
  deployment: string;
  [key: string]: string;
}

export default function Deployment() {
  const params = useParams<DeploymentParams>();
  const { appConf, deployment, loading } = useCurrentAppConf();

  const curDeployment = createMemo(() => {
    if (loading()) {
      return undefined;
    }
    return deployment(params.deployment);
  });

  const [contractInfo] = createResource(
    () => curDeployment(),
    async (deployment) => {
      const chainId = parseInt(deployment.chainId);
      const rpcUrl = deployment.rpcUrl;
      const contractAddrss = deployment.roles['contract'];

      const chain = defineChain({
        id: chainId,
        name: 'Chain ' + chainId,
        nativeCurrency: {
          name: 'Chain ' + chainId,
          symbol: 'CHAIN' + chainId,
          decimals: 18,
        },
        rpcUrls: {
          default: {
            http: [rpcUrl],
          },
        },
      });

      const config = createConfig({
        chains: [chain],
        transports: {
          [chainId]: http(),
        },
      });

      const vault = await getPublicClient(config, { chainId: chainId })!.readContract({
        address: contractAddrss as `0x${string}`,
        abi: [parseAbiItem('function vault() view returns (address)')],
        functionName: 'vault',
      });

      const token = await getPublicClient(config, { chainId: chainId })!.readContract({
        address: contractAddrss as `0x${string}`,
        abi: [parseAbiItem('function token() view returns (address)')],
        functionName: 'token',
      });

      const vaultBalance = await getPublicClient(config, { chainId: chainId })!.readContract({
        address: token as `0x${string}`,
        abi: [parseAbiItem('function balanceOf(address owner) view returns (uint256)')],
        functionName: 'balanceOf',
        args: [vault as `0x${string}`],
      });

      const allowance = await getPublicClient(config, { chainId: chainId })!.readContract({
        address: token as `0x${string}`,
        abi: [
          parseAbiItem('function allowance(address owner, address spender) view returns (uint256)'),
        ],
        functionName: 'allowance',
        args: [vault as `0x${string}`, contractAddrss as `0x${string}`],
      });

      const active = await getPublicClient(config, { chainId: chainId })!.readContract({
        address: contractAddrss as `0x${string}`,
        abi: [parseAbiItem('function active() view returns (bool)')],
        functionName: 'active',
      });

      return {
        vault,
        token,
        vaultBalance,
        allowance,
        active,
      };
    }
  );

  return (
    <Show when={contractInfo.state === 'ready'} fallback={<div>Loading...</div>}>
      <h1 class="text-2xl font-bold">Deployment Information</h1>
      <div class="mt-4 grid grid-cols-3 gap-4">
        <div class="flex flex-col gap-2">
          <span class="text-lg font-bold">Vault</span>
          <span class="text-sm text-gray-500">{contractInfo()!.vault}</span>
        </div>
        <div class="flex flex-col gap-2">
          <span class="text-lg font-bold">Token</span>
          <span class="text-sm text-gray-500">{contractInfo()!.token}</span>
        </div>
        <div class="flex flex-col gap-2">
          <span class="text-lg font-bold">Vault Balance</span>
          <span class="text-sm text-gray-500">{contractInfo()!.vaultBalance.toString()}</span>
        </div>
        <div class="flex flex-col gap-2">
          <span class="text-lg font-bold">Allowance</span>
          <span class="text-sm text-gray-500">
            {contractInfo()!.allowance === maxUint256
              ? 'Unlimited'
              : contractInfo()!.allowance.toString()}
          </span>
        </div>
        <div class="flex flex-col gap-2">
          <span class="text-lg font-bold">Active</span>
          <span class="text-sm text-gray-500">
            {contractInfo()!.active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>
    </Show>
  );
}
