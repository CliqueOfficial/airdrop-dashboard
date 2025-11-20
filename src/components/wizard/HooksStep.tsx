import { For, createSignal, Show, createMemo, useContext, JSX, Match, Switch } from 'solid-js';
import type { AppConf } from '../../types';
import { SetStoreFunction } from 'solid-js/store';
import { BsCheck2Circle, BsFire, BsLock } from 'solid-icons/bs';
import { VsWarning } from 'solid-icons/vs';
import { useConfig } from '../../hooks/useConfig';
import { defineChain, http } from 'viem';
import { createConfig, getPublicClient } from '@wagmi/core';
import TabView from '../TabView';
import { AppConfContext } from '../../hooks/context/AppConf';
import { DeploymentContext } from '../../hooks/context/Deployment';
import { FaBrandsBitcoin } from 'solid-icons/fa';
import EditableListView from '../EditableListView';
import DefaultHeader from '../editable-list-view/DefaultHeader';
interface HookType {
  id: string;
  name: string;
  title: string;
  description: string;
  color: string;
}

const hookDeployer =
  (key: string) =>
  async (baseUrl: string, apiKey: string, appId: string, deployment: string, deployer: string) => {
    const response = await fetch(`${baseUrl}/admin/relay/${key}/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ appId, deployment, deployer }),
    });
    if (!response.ok) {
      throw new Error(`Failed to deploy ${key} hook: ${response.statusText}`);
    }
    return response.json() as Promise<{ txHash: string }>;
  };

const HOOK_TYPES: HookType[] = [
  {
    id: 'transfer',
    name: 'Transfer Hook',
    title: 'Token Transfer',
    description:
      'Hook that executes during token transfer operations. Configure custom logic for transfer validation and processing.',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'lock',
    name: 'Lock Hook',
    title: 'Token Lock',
    description:
      'Hook that executes when tokens are locked. Set up vesting schedules, time-locks, and unlock conditions.',
    color: 'from-purple-500 to-pink-500',
  },
  {
    id: 'linearPenalty',
    name: 'Linear Penalty Hook',
    title: 'Linear Penalty',
    description:
      'Hook that applies linear penalty to the recipient before token transfer. Set up linear penalty schedules and penalty conditions.',
    color: 'from-purple-500 to-pink-500',
  },
];

interface HooksStepProps {}

export default function HooksStep(props: HooksStepProps) {
  const { appConf } = useContext(AppConfContext)!;

  const tabs = () =>
    Object.keys(appConf.deployments).map((deployment) => ({
      id: deployment,
      label: deployment,
      data: null,
    }));

  return (
    <TabView tabs={tabs()}>
      {(tab) => (
        <DeploymentContext.Provider
          value={{
            contractAddress: () => appConf.deployments[tab.id].roles.contract as `0x${string}`,
            chainId: () => BigInt(appConf.deployments[tab.id].chainId),
            rpcUrl: () => appConf.deployments[tab.id].rpcUrl,
            appId: () => appConf.appId,
            deployment: () => tab.id,
            roles: () => appConf.deployments[tab.id].roles as Record<string, `0x${string}`>,
            configurationNames: () =>
              Object.keys(appConf.deployments[tab.id].extra.configurations || {}),
          }}
        >
          <HooksPanel />
        </DeploymentContext.Provider>
      )}
    </TabView>
  );
}

function HooksPanel() {
  const { appConf, setAppConf, save } = useContext(AppConfContext)!;
  const { deployment, roles, appId, chainId, rpcUrl } = useContext(DeploymentContext)!;
  const { config } = useConfig();

  const [deployingHooks, setDeployingHooks] = createSignal<Record<string, boolean>>({});
  const [deployErrors, setDeployErrors] = createSignal<Record<string, string>>({});

  // Create chain config for this deployment
  const chainConfig = createMemo(() => {
    const chain = defineChain({
      id: Number(chainId()),
      name: deployment(),
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: { http: [rpcUrl()] },
      },
    });

    const config = createConfig({
      chains: [chain],
      transports: {
        [Number(chainId())]: http(),
      },
    });

    return config;
  });

  const publicClient = createMemo(() => {
    const config = chainConfig();
    if (!config) return null;
    return getPublicClient(config);
  });

  const getHookAddress = (hookId: string) => {
    const roleMapping: Record<string, string> = {
      transfer: 'transferHook',
      lock: 'lockHook',
      linearPenalty: 'linearPenaltyHook',
    };
    const roleKey = roleMapping[hookId];
    return roleKey ? roles()[roleKey] : undefined;
  };

  const getHookDeployKey = (hookId: string) => {
    const keyMapping: Record<string, string> = {
      transfer: 'transfer-hook',
      lock: 'cliquelock-hook',
      linearPenalty: 'linear-penalty-hook',
    };
    return keyMapping[hookId];
  };

  const getHookRoleKey = (hookId: string) => {
    const roleMapping: Record<string, string> = {
      transfer: 'transferHook',
      lock: 'lockHook',
      linearPenalty: 'linearPenaltyHook',
    };
    return roleMapping[hookId];
  };

  const handleDeploy = async (hookId: string) => {
    const deployer = roles()['deployer'];
    if (!deployer) {
      setDeployErrors({ ...deployErrors(), [hookId]: 'Deployer address not found' });
      return;
    }

    if (!config().baseUrl || !config().apiKey) {
      setDeployErrors({ ...deployErrors(), [hookId]: 'API configuration missing' });
      return;
    }

    setDeployingHooks({ ...deployingHooks(), [hookId]: true });
    setDeployErrors({ ...deployErrors(), [hookId]: '' });

    try {
      // Deploy hook and get transaction hash
      const deployKey = getHookDeployKey(hookId);
      const result = await hookDeployer(deployKey)(
        config().baseUrl,
        config().apiKey,
        appId(),
        deployment(),
        deployer
      );

      const txHash = result.txHash;
      if (!txHash) {
        throw new Error('No transaction hash returned');
      }

      console.log(`Hook ${hookId} deployed, tx hash:`, txHash);

      // Wait for transaction receipt
      const client = publicClient();
      if (!client) {
        throw new Error('No public client available');
      }

      const receipt = await client.waitForTransactionReceipt({
        hash: txHash as `0x${string}`,
        confirmations: 1,
      });

      if (receipt.status !== 'success') {
        throw new Error('Transaction failed on chain');
      }

      // Get contract address from receipt
      const contractAddress = receipt.contractAddress;
      if (!contractAddress) {
        throw new Error('No contract address in transaction receipt');
      }

      console.log(`Hook ${hookId} contract address:`, contractAddress);

      // Save hook address to roles
      const hookRoleKey = getHookRoleKey(hookId);
      setAppConf('deployments', deployment(), 'roles', hookRoleKey, contractAddress);

      // Save configuration
      if (save) {
        const saved = await save();
        if (!saved) {
          throw new Error('Failed to save configuration');
        }
      }

      console.log(`Hook ${hookId} deployed and saved successfully`);
    } catch (error) {
      console.error(`Failed to deploy ${hookId}:`, error);
      setDeployErrors({
        ...deployErrors(),
        [hookId]: error instanceof Error ? error.message : 'Deployment failed',
      });
    } finally {
      setDeployingHooks({ ...deployingHooks(), [hookId]: false });
    }
  };

  return (
    <EditableListView
      title={(isEditing, setIsEditing, onConfirm, onCancel, onAdd, canAdd, canEdit) => (
        <DefaultHeader
          canEdit={() => canEdit}
          canAdd={() => canAdd}
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          handleConfirm={onConfirm}
          handleCancel={onCancel}
          handleAdd={onAdd}
        />
      )}
      canAdd={false}
      canDelete={false}
      canEdit={false}
      items={HOOK_TYPES}
    >
      {(item) => {
        const address = getHookAddress(item.id);
        const isDeployed = !!address;
        const isDeploying = () => deployingHooks()[item.id] || false;
        const error = () => deployErrors()[item.id] || '';

        return (
          <div class="p-6 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-all duration-200">
            {/* Header with Icon */}
            <div class="flex items-start gap-4">
              {/* Icon */}
              <div
                class={`flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center text-white text-xl`}
              >
                <Switch>
                  <Match when={item.id === 'transfer'}>
                    <FaBrandsBitcoin />
                  </Match>
                  <Match when={item.id === 'lock'}>
                    <BsLock />
                  </Match>
                  <Match when={item.id === 'linearPenalty'}>
                    <BsFire />
                  </Match>
                </Switch>
              </div>

              {/* Content */}
              <div class="flex-1 min-w-0">
                {/* Title and Status */}
                <div class="flex items-center gap-3 mb-2">
                  <h3 class="text-lg font-semibold text-gray-900">{item.name}</h3>
                  <Show when={isDeployed}>
                    <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <BsCheck2Circle class="w-3 h-3" />
                      Deployed
                    </span>
                  </Show>
                  <Show when={!isDeployed}>
                    <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      <VsWarning class="w-3 h-3" />
                      Not Deployed
                    </span>
                  </Show>
                </div>

                {/* Description */}
                <p class="text-sm text-gray-600 mb-3">{item.description}</p>

                {/* Address */}
                <Show when={isDeployed}>
                  <div class="mt-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                    <div class="text-xs font-medium text-gray-500 mb-1">Contract Address:</div>
                    <div class="font-mono text-sm text-gray-900 break-all">{address}</div>
                  </div>
                </Show>

                {/* Deploy Button */}
                <Show when={!isDeployed}>
                  <div class="mt-3">
                    <button
                      class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 text-sm font-medium"
                      onClick={() => handleDeploy(item.id)}
                      disabled={isDeploying()}
                    >
                      <Show when={!isDeploying()} fallback="Deploying...">
                        Deploy Hook
                      </Show>
                    </button>
                  </div>
                </Show>

                {/* Error Message */}
                <Show when={error()}>
                  <div class="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p class="text-sm text-red-800">{error()}</p>
                  </div>
                </Show>
              </div>
            </div>
          </div>
        );
      }}
    </EditableListView>
  );
}
