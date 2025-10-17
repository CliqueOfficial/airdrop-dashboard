import { For, createSignal, Show, createMemo, createResource } from 'solid-js';
import type { AppConf } from '../../types';
import { SetStoreFunction, produce } from 'solid-js/store';
import { BsCheck2Circle, BsX } from 'solid-icons/bs';
import { VsWarning } from 'solid-icons/vs';
import { FaSolidLink } from 'solid-icons/fa';
import { defineChain, http, keccak256, toBytes } from 'viem';
import { createConfig, getPublicClient } from '@wagmi/core';
import { useConfig } from '../../hooks/useConfig';
import DistributorAbi from '../../abi/Distributor.abi.json';

interface ApplyStrategyStepProps {
  appConf: AppConf;
  setAppConf: SetStoreFunction<AppConf>;
  onSave?: () => Promise<boolean>;
}

const setClaimRoot = async (
  baseUrl: string,
  apiKey: string,
  appId: string,
  deployment: string,
  projectAdmin: string,
  root: `0x${string}`,
  configurationName: string
) => {
  const response = await fetch(`${baseUrl}/admin/relay/distributor/set-claim-root`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      appId,
      deployment,
      projectAdmin,
      root,
      configuration: configurationName,
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to set claim root`);
  }
  return response.json() as Promise<{ txHash: string }>;
};

export default function ApplyStrategyStep(props: ApplyStrategyStepProps) {
  const config = useConfig();
  const [bindingRoot, setBindingRoot] = createSignal<string | null>(null);
  const [deployingRoot, setDeployingRoot] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [success, setSuccess] = createSignal<string | null>(null);
  const [showDebug, setShowDebug] = createSignal(false);

  // Toggle debug panel with Ctrl+Shift+H
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'H') {
      setShowDebug(!showDebug());
    }
  };

  // Add event listener
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeyDown);
  }

  const batchRoots = createMemo(() => {
    // Get roots from appConf.extra.root (global batch roots)
    const globalRoots = props.appConf.extra?.root || {};

    return Object.entries(globalRoots).map(([key, value]) => ({
      key,
      value,
    }));
  });

  // Get all available configurations across all deployments
  const availableConfigurations = createMemo(() => {
    const configs: Array<{
      deploymentKey: string;
      configName: string;
      chainId: string;
      isDeployed: boolean;
    }> = [];

    Object.entries(props.appConf.deployments).forEach(([deploymentKey, deployment]) => {
      if (deployment.roles?.contract) {
        const configurations = deployment.extra?.configurations || {};
        Object.entries(configurations).forEach(([configName, config]) => {
          configs.push({
            deploymentKey,
            configName,
            chainId: deployment.chainId,
            isDeployed: config.deployed || false,
          });
        });
      }
    });

    return configs;
  });

  // Get binding info for a root
  const getRootBinding = (rootKey: string) => {
    for (const [deploymentKey, deployment] of Object.entries(props.appConf.deployments)) {
      const rootBindings = deployment.extra?.root || {};
      if (rootBindings[rootKey]) {
        return {
          deploymentKey,
          configName: rootBindings[rootKey],
        };
      }
    }
    return null;
  };

  // Create publicClients for all deployments
  const deploymentClients = createMemo(() => {
    const clients: Record<string, { client: any; chainId: number; contractAddress: string }> = {};

    Object.entries(props.appConf.deployments).forEach(([deploymentKey, deployment]) => {
      const contractAddress = deployment.roles?.contract;
      if (!contractAddress) return;

      const chainId = parseInt(deployment.chainId);
      const chain = defineChain({
        id: chainId,
        name: `Chain ${chainId}`,
        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
        rpcUrls: {
          default: { http: [deployment.rpcUrl] },
        },
      });

      const wagmiConfig = createConfig({
        chains: [chain],
        transports: {
          [chainId]: http(deployment.rpcUrl),
        },
      });

      clients[deploymentKey] = {
        client: getPublicClient(wagmiConfig, { chainId }),
        chainId,
        contractAddress,
      };
    });

    return clients;
  });

  // Query on-chain status for all roots across all deployments
  const [rootOnChainStatus, { refetch: refetchRootStatus }] = createResource(
    () => {
      const roots = batchRoots();
      const clients = deploymentClients();

      if (roots.length === 0 || Object.keys(clients).length === 0) return null;

      return { roots, clients };
    },
    async (source) => {
      const statusMap: Record<
        string,
        Record<
          string,
          {
            isDeployed: boolean;
            isMatched: boolean;
            onChainConfigId: string;
          }
        >
      > = {};

      // Query all roots on all deployments in parallel
      const results = await Promise.all(
        source.roots.flatMap((root) =>
          Object.entries(source.clients).map(
            async ([deploymentKey, { client, contractAddress }]) => {
              try {
                // Query on-chain configurationId for this root
                const onChainConfigId = (await client.readContract({
                  address: contractAddress as `0x${string}`,
                  abi: DistributorAbi,
                  functionName: 'configurationId',
                  args: [root.value as `0x${string}`],
                })) as `0x${string}`;

                const isDeployed =
                  onChainConfigId !==
                  '0x0000000000000000000000000000000000000000000000000000000000000000';

                // Get local binding for this root
                const localBinding = getRootBinding(root.key);

                // Determine if the on-chain state matches local configuration
                let isMatched = true;

                if (!isDeployed) {
                  // If not deployed on-chain, it's considered matched (no conflict)
                  isMatched = true;
                } else {
                  // On-chain has a deployment
                  if (!localBinding) {
                    // Chain has deployment but no local binding - not matched
                    isMatched = false;
                  } else if (localBinding.deploymentKey !== deploymentKey) {
                    // Local binding is for a different deployment - consider it matched for this deployment
                    isMatched = true;
                  } else {
                    // Local binding is for this deployment - check if configurationId matches
                    const expectedConfigId = keccak256(toBytes(localBinding.configName));
                    isMatched = onChainConfigId.toLowerCase() === expectedConfigId.toLowerCase();
                  }
                }

                return { rootKey: root.key, deploymentKey, isDeployed, isMatched, onChainConfigId };
              } catch (err) {
                console.error(`Failed to query root ${root.key} on ${deploymentKey}:`, err);
                return {
                  rootKey: root.key,
                  deploymentKey,
                  isDeployed: false,
                  isMatched: true,
                  onChainConfigId:
                    '0x0000000000000000000000000000000000000000000000000000000000000000',
                };
              }
            }
          )
        )
      );

      // Organize results by root and deployment
      results.forEach(({ rootKey, deploymentKey, isDeployed, isMatched, onChainConfigId }) => {
        if (!statusMap[rootKey]) {
          statusMap[rootKey] = {};
        }
        statusMap[rootKey][deploymentKey] = { isDeployed, isMatched, onChainConfigId };
      });

      return statusMap;
    }
  );

  // Get on-chain status for a specific root/deployment combination
  const getRootDeploymentStatus = (rootKey: string, deploymentKey: string) => {
    const status = rootOnChainStatus();
    return (
      status?.[rootKey]?.[deploymentKey] || {
        isDeployed: false,
        isMatched: true,
        onChainConfigId: '0x0',
      }
    );
  };

  const handleBindConfiguration = async (
    rootKey: string,
    deploymentKey: string,
    configName: string
  ) => {
    setBindingRoot(rootKey);
    setError(null);

    try {
      // Get the root value from global roots
      const rootValue = props.appConf.extra?.root?.[rootKey];
      if (!rootValue) {
        setError('Root value not found');
        return;
      }

      // First, unbind any existing binding for this root
      const existingBinding = getRootBinding(rootKey);
      if (existingBinding) {
        await handleUnbindConfiguration(rootKey);
      }

      // Store the binding in deployment.extra.root: batchName -> configurationName
      props.setAppConf('deployments', deploymentKey, 'extra', 'root', rootKey, configName);

      setSuccess(`Successfully bound "${rootKey}" to ${deploymentKey}/${configName}`);

      // Auto-save
      await props.onSave?.();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to bind configuration:', err);
      setError(err instanceof Error ? err.message : 'Failed to bind configuration');
    } finally {
      setBindingRoot(null);
    }
  };

  const handleUnbindConfiguration = async (rootKey: string) => {
    setBindingRoot(rootKey);
    setError(null);

    try {
      const binding = getRootBinding(rootKey);
      if (!binding) {
        setError('No binding found');
        return;
      }

      const { deploymentKey, configName } = binding;

      // Use produce to properly delete properties from the store
      props.setAppConf(
        'deployments',
        deploymentKey,
        'extra',
        produce((extra) => {
          // Remove from deployment.extra.root (batchName -> configName mapping)
          if (extra.root?.[rootKey]) {
            delete extra.root[rootKey];
          }
        })
      );

      setSuccess(`Successfully unbound "${rootKey}"`);

      // Auto-save
      await props.onSave?.();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to unbind configuration:', err);
      setError(err instanceof Error ? err.message : 'Failed to unbind configuration');
    } finally {
      setBindingRoot(null);
    }
  };

  const handleDeployRoot = async (rootKey: string) => {
    const binding = getRootBinding(rootKey);
    if (!binding) {
      setError('Root must be bound to a configuration before deploying');
      return;
    }

    const { deploymentKey, configName } = binding;
    const root = batchRoots().find((r) => r.key === rootKey);
    if (!root) {
      setError('Root not found');
      return;
    }

    const clientInfo = deploymentClients()[deploymentKey];
    if (!clientInfo) {
      setError('Failed to get blockchain client');
      return;
    }

    setDeployingRoot(rootKey);
    setError(null);

    try {
      // Call the deploy API (server will handle keccak256 hashing)
      const result = await setClaimRoot(
        config.config.baseUrl,
        config.config.apiKey,
        props.appConf.appId,
        deploymentKey,
        props.appConf.deployments[deploymentKey]?.roles?.projectAdmin,
        root.value as `0x${string}`,
        configName
      );

      // Wait for transaction receipt
      const receipt = await clientInfo.client.waitForTransactionReceipt({
        hash: result.txHash as `0x${string}`,
      });

      if (receipt.status === 'success') {
        setSuccess(`Successfully deployed root "${rootKey}" to ${deploymentKey}`);

        // Refetch on-chain status
        refetchRootStatus();

        await props.onSave?.();

        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError('Transaction failed');
      }
    } catch (err) {
      console.error('Failed to deploy root:', err);
      setError(err instanceof Error ? err.message : 'Failed to deploy root');
    } finally {
      setDeployingRoot(null);
    }
  };

  return (
    <div class="space-y-6 p-4">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-gray-900">Batch Strategy Bindings</h2>
          <p class="text-sm text-gray-600 mt-1">Bind batch roots to deployment configurations</p>
        </div>
        <Show when={showDebug()}>
          <div class="px-3 py-1.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded border border-yellow-300">
            🐛 Debug Mode (Ctrl+Shift+H to toggle)
          </div>
        </Show>
      </div>
      {/* Success Message */}
      <Show when={success()}>
        <div class="p-3 bg-green-50 border border-green-200 rounded-lg">
          <div class="flex items-center gap-2 text-green-800 text-sm">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clip-rule="evenodd"
              />
            </svg>
            <span>{success()}</span>
          </div>
        </div>
      </Show>

      {/* Error Message */}
      <Show when={error()}>
        <div class="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div class="flex items-center gap-2 text-red-800 text-sm">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clip-rule="evenodd"
              />
            </svg>
            <span>{error()}</span>
          </div>
        </div>
      </Show>

      {/* Batch Roots List */}
      <Show
        when={batchRoots().length > 0}
        fallback={
          <div class="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
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
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            <p class="text-sm font-medium text-gray-500">No batch roots available</p>
            <p class="text-xs text-gray-400 mt-1">Upload batch files first to create roots</p>
          </div>
        }
      >
        <div class="space-y-3">
          <For each={batchRoots()}>
            {(root) => {
              const binding = getRootBinding(root.key);
              const isBound = !!binding;
              const isProcessing = bindingRoot() === root.key;

              return (
                <div class="border-2 border-gray-200 rounded-lg p-4 bg-white hover:border-gray-300 transition-all">
                  {/* Root Header */}
                  <div class="flex items-start justify-between mb-3">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <h3 class="font-semibold text-gray-900">{root.key}</h3>
                        <Show when={isBound}>
                          <span class="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                            Bound
                          </span>
                        </Show>
                      </div>
                      <div class="text-xs text-gray-500 font-mono truncate" title={root.value}>
                        {root.value}
                      </div>
                    </div>
                  </div>

                  {/* Current Binding or Selection */}
                  <Show
                    when={isBound && binding}
                    fallback={
                      <div class="flex items-center gap-3">
                        <select
                          class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                          onChange={(e) => {
                            const value = e.currentTarget.value;
                            if (value) {
                              const [deploymentKey, configName] = value.split('/');
                              handleBindConfiguration(root.key, deploymentKey, configName);
                              e.currentTarget.value = ''; // Reset selection
                            }
                          }}
                          disabled={isProcessing}
                          value=""
                        >
                          <option value="">Select a configuration to bind (optional)...</option>
                          <For each={availableConfigurations()}>
                            {(config) => (
                              <option value={`${config.deploymentKey}/${config.configName}`}>
                                {config.deploymentKey} / {config.configName} (Chain {config.chainId}
                                ) {config.isDeployed ? '✓ Deployed' : '⚠ Not Deployed'}
                              </option>
                            )}
                          </For>
                        </select>
                      </div>
                    }
                  >
                    <div class="space-y-2">
                      <Show when={binding}>
                        {(b) => {
                          const status = getRootDeploymentStatus(root.key, b().deploymentKey);
                          const showWarning = status.isDeployed && !status.isMatched;

                          return (
                            <div
                              class={`border rounded-lg p-3 ${showWarning ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}
                            >
                              <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2 flex-1 flex-wrap">
                                  <FaSolidLink
                                    size={14}
                                    class={showWarning ? 'text-yellow-600' : 'text-green-600'}
                                  />
                                  <span class="text-sm font-medium text-gray-900">
                                    {b().deploymentKey} / {b().configName}
                                  </span>
                                  <span class="text-xs text-gray-500">
                                    (Chain {props.appConf.deployments[b().deploymentKey]?.chainId})
                                  </span>
                                  <Show
                                    when={
                                      props.appConf.deployments[b().deploymentKey]?.extra
                                        ?.configurations?.[b().configName]?.deployed
                                    }
                                  >
                                    <span class="px-1.5 py-0.5 bg-green-200 text-green-800 text-xs font-medium rounded">
                                      ✓ Config Deployed
                                    </span>
                                  </Show>
                                  <Show
                                    when={
                                      !props.appConf.deployments[b().deploymentKey]?.extra
                                        ?.configurations?.[b().configName]?.deployed
                                    }
                                  >
                                    <span class="px-1.5 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
                                      ⚠ Config Not Deployed
                                    </span>
                                  </Show>
                                  <Show when={showWarning}>
                                    <span class="px-1.5 py-0.5 bg-yellow-200 text-yellow-900 text-xs font-medium rounded flex items-center gap-1">
                                      <VsWarning size={12} />
                                      Chain Mismatch
                                    </span>
                                  </Show>
                                </div>
                                <button
                                  onClick={() => handleUnbindConfiguration(root.key)}
                                  disabled={isProcessing || deployingRoot() === root.key}
                                  class="px-3 py-1.5 text-xs font-medium bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 flex items-center gap-1"
                                >
                                  <BsX size={16} />
                                  Unbind
                                </button>
                              </div>
                            </div>
                          );
                        }}
                      </Show>

                      {/* On-Chain Status and Deploy Button */}
                      <Show
                        when={
                          binding &&
                          getRootDeploymentStatus(root.key, binding.deploymentKey).isDeployed &&
                          getRootDeploymentStatus(root.key, binding.deploymentKey).isMatched
                        }
                      >
                        {/* Deployed and matched - not clickable */}
                        <div class="w-full px-3 py-1.5 text-xs font-medium bg-white text-gray-700 border border-gray-300 rounded flex items-center justify-center gap-2">
                          <BsCheck2Circle size={14} class="text-green-600" />
                          Deployed
                        </div>
                      </Show>

                      <Show
                        when={
                          binding &&
                          getRootDeploymentStatus(root.key, binding.deploymentKey).isDeployed &&
                          !getRootDeploymentStatus(root.key, binding.deploymentKey).isMatched
                        }
                      >
                        {/* Deployed but not matched - clickable Redeploy button */}
                        <button
                          onClick={() => handleDeployRoot(root.key)}
                          disabled={deployingRoot() === root.key}
                          class="w-full px-3 py-1.5 text-xs font-medium bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          <VsWarning size={14} />
                          {deployingRoot() === root.key ? 'Deploying...' : 'Redeploy'}
                        </button>
                      </Show>

                      <Show
                        when={
                          binding &&
                          !getRootDeploymentStatus(root.key, binding.deploymentKey).isDeployed
                        }
                      >
                        {/* Not deployed - clickable Deploy button */}
                        <button
                          onClick={() => handleDeployRoot(root.key)}
                          disabled={deployingRoot() === root.key}
                          class="w-full px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          {deployingRoot() === root.key ? 'Deploying...' : 'Deploy'}
                        </button>
                      </Show>
                    </div>
                  </Show>

                  {/* Debug Panel */}
                  <Show when={showDebug()}>
                    <div class="mt-3 p-3 bg-gray-900 text-gray-100 rounded-lg text-xs font-mono">
                      <div class="font-bold text-yellow-400 mb-2">Debug: {root.key}</div>
                      <div class="space-y-2">
                        <div>
                          <strong>Root Value:</strong> {root.value}
                        </div>
                        <div>
                          <strong>Local Binding:</strong> {JSON.stringify(binding || 'None')}
                        </div>
                        <div class="border-t border-gray-700 pt-2 mt-2">
                          <strong class="text-cyan-400">On-Chain Status per Deployment:</strong>
                        </div>
                        <For each={Object.keys(deploymentClients())}>
                          {(deploymentKey) => {
                            const status = getRootDeploymentStatus(root.key, deploymentKey);
                            const localBinding = getRootBinding(root.key);
                            const expectedConfigId =
                              localBinding && localBinding.deploymentKey === deploymentKey
                                ? keccak256(toBytes(localBinding.configName))
                                : 'N/A';

                            return (
                              <div class="pl-4 border-l-2 border-gray-700">
                                <div class="text-purple-400">{deploymentKey}:</div>
                                <div class="pl-2 space-y-1">
                                  <div>
                                    <strong>isDeployed:</strong>{' '}
                                    <span
                                      class={status.isDeployed ? 'text-green-400' : 'text-red-400'}
                                    >
                                      {String(status.isDeployed)}
                                    </span>
                                  </div>
                                  <div>
                                    <strong>isMatched:</strong>{' '}
                                    <span
                                      class={status.isMatched ? 'text-green-400' : 'text-red-400'}
                                    >
                                      {String(status.isMatched)}
                                    </span>
                                  </div>
                                  <div>
                                    <strong>onChainConfigId:</strong> {status.onChainConfigId}
                                  </div>
                                  <div>
                                    <strong>expectedConfigId:</strong> {expectedConfigId}
                                  </div>
                                  <Show
                                    when={
                                      localBinding && localBinding.deploymentKey === deploymentKey
                                    }
                                  >
                                    <div>
                                      <strong>Match:</strong>{' '}
                                      <span
                                        class={
                                          status.onChainConfigId.toLowerCase() ===
                                          (expectedConfigId as string).toLowerCase()
                                            ? 'text-green-400'
                                            : 'text-red-400'
                                        }
                                      >
                                        {status.onChainConfigId.toLowerCase() ===
                                        (expectedConfigId as string).toLowerCase()
                                          ? '✓ Match'
                                          : '✗ Mismatch'}
                                      </span>
                                    </div>
                                  </Show>
                                </div>
                              </div>
                            );
                          }}
                        </For>
                      </div>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
}
