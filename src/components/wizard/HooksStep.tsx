import { For, createSignal, Show, createMemo } from 'solid-js';
import type { AppConf } from '../../types';
import { SetStoreFunction } from 'solid-js/store';
import { BsCheck2Circle } from 'solid-icons/bs';
import { VsWarning } from 'solid-icons/vs';
import { useConfig } from '../../hooks/useConfig';
import { defineChain, http } from 'viem';
import { createConfig, getPublicClient } from '@wagmi/core';

interface HooksStepProps {
  appConf: AppConf;
  setAppConf: SetStoreFunction<AppConf>;
  onSave?: () => Promise<boolean>;
}

interface HookType {
  id: string;
  name: string;
  title: string;
  description: string;
  icon: string;
  color: string;
}

const deployTransferHook = async (
  baseUrl: string,
  apiKey: string,
  appId: string,
  deployment: string,
  projectAdmin: string,
  deployer: string
) => {
  const response = await fetch(`${baseUrl}/admin/relay/transfer-hook/deploy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ appId, deployment, projectAdmin, deployer }),
  });
  if (!response.ok) {
    throw new Error(`Failed to deploy transfer hook: ${response.statusText}`);
  }
  return response.json() as Promise<{ txHash: string }>;
};

const deployLockHook = async (
  baseUrl: string,
  apiKey: string,
  appId: string,
  deployment: string,
  deployer: string
) => {
  const response = await fetch(`${baseUrl}/admin/relay/cliquelock-hook/deploy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ appId, deployment, deployer }),
  });
  if (!response.ok) {
    throw new Error(`Failed to deploy lock hook: ${response.statusText}`);
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
    icon: '💸',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'lock',
    name: 'Lock Hook',
    title: 'Token Lock',
    description:
      'Hook that executes when tokens are locked. Set up vesting schedules, time-locks, and unlock conditions.',
    icon: '🔒',
    color: 'from-purple-500 to-pink-500',
  },
];

export default function HooksStep(props: HooksStepProps) {
  const { config } = useConfig();
  const [selectedHook, setSelectedHook] = createSignal<string | null>(null);
  const [selectedDeployment, setSelectedDeployment] = createSignal<string | null>(null);
  const [isDeploying, setIsDeploying] = createSignal(false);
  const [deployError, setDeployError] = createSignal<string | null>(null);
  const [deployingHookId, setDeployingHookId] = createSignal<string | null>(null);

  const handleSelectHook = (hookId: string) => {
    setSelectedHook(hookId === selectedHook() ? null : hookId);
  };

  const deploymentKeys = createMemo(() => Object.keys(props.appConf.deployments));

  const isDeploymentDeployed = (deploymentKey: string) => {
    return !!props.appConf.deployments[deploymentKey]?.roles?.contract;
  };

  const handleSelectDeployment = (deploymentKey: string) => {
    if (isDeploymentDeployed(deploymentKey)) {
      setSelectedDeployment(deploymentKey === selectedDeployment() ? null : deploymentKey);
    }
  };

  const isHookDeployed = (hookId: string) => {
    const deployment = selectedDeployment();
    if (!deployment) return false;
    const hookRoleKey = `${hookId}Hook`;
    return !!props.appConf.deployments[deployment]?.roles?.[hookRoleKey];
  };

  // Create chain config and public client for selected deployment
  const chainConfig = createMemo(() => {
    const deployment = selectedDeployment();
    if (!deployment) return null;
    const deploymentConfig = props.appConf.deployments[deployment];
    if (!deploymentConfig) return null;

    const chain = defineChain({
      id: parseInt(deploymentConfig.chainId),
      name: 'Chain ' + deploymentConfig.chainId,
      nativeCurrency: {
        name: 'Chain ' + deploymentConfig.chainId,
        symbol: 'CHAIN' + deploymentConfig.chainId,
        decimals: 18,
      },
      rpcUrls: {
        default: {
          http: [deploymentConfig.rpcUrl],
        },
      },
    });

    const chainConfig = createConfig({
      chains: [chain],
      transports: {
        [parseInt(deploymentConfig.chainId)]: http(),
      },
    });

    return chainConfig;
  });

  const publicClient = createMemo(() => {
    const config = chainConfig();
    if (!config) return null;
    return getPublicClient(config);
  });

  const validateAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  const handleDeployButtonClick = (hookId: string) => {
    handleDeployHook(hookId);
  };

  const handleDeployHook = async (hookId: string) => {
    const deployment = selectedDeployment();
    if (!deployment) {
      setDeployError('No deployment selected');
      return;
    }

    const deploymentConfig = props.appConf.deployments[deployment];
    const deployer = deploymentConfig.roles?.deployer;
    const projectAdmin = deploymentConfig.roles?.projectAdmin;

    if (!deployer) {
      setDeployError('Deployer not found in deployment roles');
      return;
    }

    setIsDeploying(true);
    setDeployError(null);
    setDeployingHookId(hookId);

    try {
      let txHash: string;

      if (hookId === 'transfer') {
        if (!projectAdmin) {
          throw new Error('Project admin not found in deployment roles');
        }
        const result = await deployTransferHook(
          config.baseUrl,
          config.apiKey,
          props.appConf.appId,
          deployment,
          projectAdmin,
          deployer
        );
        txHash = result.txHash;
      } else if (hookId === 'lock') {
        const result = await deployLockHook(
          config.baseUrl,
          config.apiKey,
          props.appConf.appId,
          deployment,
          deployer
        );
        txHash = result.txHash;
      } else {
        throw new Error('Unknown hook type');
      }

      if (!txHash) {
        throw new Error('No transaction hash returned');
      }

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

      // Save hook address to roles
      const hookRoleKey = `${hookId}Hook`;
      props.setAppConf('deployments', deployment, 'roles', hookRoleKey, contractAddress);

      // Save configuration
      if (props.onSave) {
        const saved = await props.onSave();
        if (!saved) {
          throw new Error('Failed to save configuration');
        }
      }
    } catch (err) {
      setDeployError(err instanceof Error ? err.message : 'Deployment failed');
    } finally {
      setIsDeploying(false);
      setDeployingHookId(null);
    }
  };

  return (
    <div class="flex gap-6 -m-4">
      {/* Left Sidebar - Deployments */}
      <div class="w-64 flex-shrink-0 bg-gray-50 border-r border-gray-200 p-4 overflow-y-auto max-h-[600px]">
        <h3 class="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          Deployments
        </h3>

        <Show
          when={deploymentKeys().length > 0}
          fallback={
            <div class="text-center py-8 text-gray-400 text-xs">
              <svg
                class="w-12 h-12 mx-auto mb-2 text-gray-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              No deployments yet
            </div>
          }
        >
          <div class="space-y-2">
            <For each={deploymentKeys()}>
              {(key) => {
                const deployment = props.appConf.deployments[key];
                const isDeployed = isDeploymentDeployed(key);
                const isSelected = selectedDeployment() === key;

                return (
                  <div
                    onClick={() => handleSelectDeployment(key)}
                    class={`p-3 rounded-lg border-2 transition-all ${
                      isDeployed
                        ? isSelected
                          ? 'border-blue-500 bg-blue-50 shadow-md cursor-pointer'
                          : 'border-gray-300 bg-white hover:border-blue-300 hover:shadow-sm cursor-pointer'
                        : 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <div class="flex items-start justify-between gap-2 mb-2">
                      <div class="flex items-center gap-2 flex-1 min-w-0">
                        <Show
                          when={isDeployed}
                          fallback={<VsWarning size={14} class="text-yellow-500 flex-shrink-0" />}
                        >
                          <BsCheck2Circle size={14} class="text-green-500 flex-shrink-0" />
                        </Show>
                        <span class="font-semibold text-sm text-gray-900 truncate">{key}</span>
                      </div>
                      {isSelected && (
                        <div class="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fill-rule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clip-rule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div class="text-xs text-gray-600 space-y-0.5">
                      <div class="truncate">
                        <span class="font-medium">Chain:</span> {deployment.chainId}
                      </div>
                      <Show when={isDeployed}>
                        <div
                          class="truncate font-mono text-[10px]"
                          title={deployment.roles?.contract}
                        >
                          {deployment.roles?.contract?.slice(0, 8)}...
                          {deployment.roles?.contract?.slice(-6)}
                        </div>
                      </Show>
                      <Show when={!isDeployed}>
                        <div class="text-yellow-600 text-[10px] font-medium">Not deployed</div>
                      </Show>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
      </div>

      {/* Main Content Area */}
      <div class="flex-1 p-4 space-y-6 overflow-y-auto max-h-[600px]">
        {/* Error Message */}
        <Show when={deployError()}>
          <div class="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div class="flex items-center gap-2 text-red-800 text-sm">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clip-rule="evenodd"
                />
              </svg>
              <span>{deployError()}</span>
            </div>
          </div>
        </Show>

        {/* Info Banner */}
        <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div class="flex items-start gap-3">
            <svg
              class="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clip-rule="evenodd"
              />
            </svg>
            <div class="flex-1">
              <h4 class="text-sm font-semibold text-blue-900">Configure Hooks</h4>
              <p class="text-xs text-blue-800 mt-1">
                <Show
                  when={selectedDeployment()}
                  fallback="Select a deployed deployment from the left sidebar to configure hooks for it."
                >
                  Configuring hooks for <span class="font-bold">{selectedDeployment()}</span>.
                  Select a hook type below.
                </Show>
              </p>
            </div>
          </div>
        </div>

        {/* Hook Cards Grid */}
        <Show
          when={selectedDeployment()}
          fallback={
            <div class="text-center py-12 text-gray-400">
              <svg
                class="w-16 h-16 mx-auto mb-4 text-gray-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.657l-2.12 2.122"
                />
              </svg>
              <p class="text-sm font-medium">Select a deployment to continue</p>
              <p class="text-xs mt-1">Choose a deployed deployment from the left sidebar</p>
            </div>
          }
        >
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <For each={HOOK_TYPES}>
              {(hook) => (
                <div
                  onClick={() => handleSelectHook(hook.id)}
                  class={`relative border-2 rounded-lg p-6 cursor-pointer transition-all duration-200 ${
                    selectedHook() === hook.id
                      ? 'border-blue-500 bg-blue-50 shadow-lg scale-105'
                      : 'border-gray-300 bg-white hover:border-gray-400 hover:shadow-md'
                  }`}
                >
                  {/* Selected indicator */}
                  {selectedHook() === hook.id && (
                    <div class="absolute top-3 right-3">
                      <div class="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fill-rule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clip-rule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Icon with gradient background */}
                  <div
                    class={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${hook.color} mb-4 text-3xl`}
                  >
                    {hook.icon}
                  </div>

                  {/* Hook info */}
                  <h3 class="text-lg font-bold text-gray-900 mb-2">{hook.name}</h3>
                  <p class="text-sm text-gray-600 mb-3">{hook.title}</p>
                  <p class="text-xs text-gray-500 leading-relaxed">{hook.description}</p>

                  {/* Deploy button or status */}
                  <div class="mt-4 pt-4 border-t border-gray-200">
                    <Show
                      when={isHookDeployed(hook.id)}
                      fallback={
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeployButtonClick(hook.id);
                          }}
                          disabled={isDeploying() && deployingHookId() === hook.id}
                          class={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                            isDeploying() && deployingHookId() === hook.id
                              ? 'bg-blue-400 text-white cursor-wait'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {isDeploying() && deployingHookId() === hook.id ? (
                            <>
                              <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle
                                  class="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  stroke-width="4"
                                ></circle>
                                <path
                                  class="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                              </svg>
                              Deploying...
                            </>
                          ) : (
                            <>
                              <svg
                                class="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2"
                                  d="M13 10V3L4 14h7v7l9-11h-7z"
                                />
                              </svg>
                              Deploy Hook
                            </>
                          )}
                        </button>
                      }
                    >
                      <div class="flex items-center gap-2 text-green-600 text-sm">
                        <BsCheck2Circle size={16} />
                        <span class="font-medium">Deployed</span>
                      </div>
                      <div
                        class="mt-1 text-xs text-gray-600 font-mono truncate"
                        title={
                          selectedDeployment()
                            ? props.appConf.deployments[selectedDeployment()!]?.roles?.[
                                `${hook.id}Hook`
                              ]
                            : ''
                        }
                      >
                        {selectedDeployment()
                          ? props.appConf.deployments[selectedDeployment()!]?.roles?.[
                              `${hook.id}Hook`
                            ]?.slice(0, 10)
                          : ''}
                        ...
                        {selectedDeployment()
                          ? props.appConf.deployments[selectedDeployment()!]?.roles?.[
                              `${hook.id}Hook`
                            ]?.slice(-8)
                          : ''}
                      </div>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>

          {/* Selected Hook Details - Placeholder */}
          {selectedHook() && (
            <div class="p-6 border-2 border-blue-200 rounded-lg bg-blue-50">
              <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg
                    class="w-6 h-6 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <h3 class="text-lg font-bold text-blue-900">
                  {HOOK_TYPES.find((h) => h.id === selectedHook())?.name} Configuration
                </h3>
              </div>
              <p class="text-sm text-blue-800 mb-4">
                Detailed configuration options for this hook type will be available soon. You'll be
                able to set parameters, conditions, and custom logic.
              </p>
              <div class="flex items-center gap-2 text-xs text-blue-700">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                    clip-rule="evenodd"
                  />
                </svg>
                <span>Under Development</span>
              </div>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}
