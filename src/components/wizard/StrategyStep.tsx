import { For, createSignal, Show, createMemo, createResource } from 'solid-js';
import type { AppConf, Configuration, Strategy } from '../../types';
import { SetStoreFunction, produce } from 'solid-js/store';
import { BsCheck2Circle, BsTrash } from 'solid-icons/bs';
import { VsWarning } from 'solid-icons/vs';
import { FaSolidPlus } from 'solid-icons/fa';
import { parseEther, formatEther, defineChain, http, keccak256, toBytes } from 'viem';
import { createConfig, getPublicClient } from '@wagmi/core';
import { useConfig } from '../../hooks/useConfig';
import DistributorAbi from '../../abi/Distributor.abi.json';

interface StrategyStepProps {
  appConf: AppConf;
  setAppConf: SetStoreFunction<AppConf>;
  onSave?: () => Promise<boolean>;
}

const applyConfiguration = async (
  baseUrl: string,
  apiKey: string,
  appId: string,
  deployment: string,
  projectAdmin: string,
  name: string,
  configuration: Configuration
) => {
  const response = await fetch(`${baseUrl}/admin/relay/distributor/set-hook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      appId,
      deployment,
      projectAdmin,
      hookName: name,
      strategy: configuration.strategy,
      fallbackIdx: configuration.fallbackIdx,
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to apply configuration`);
  }
  return response.json() as Promise<{ txHash: string }>;
};

export default function StrategyStep(props: StrategyStepProps) {
  const config = useConfig();
  const [selectedDeployment, setSelectedDeployment] = createSignal<string | null>(null);
  const [selectedConfiguration, setSelectedConfiguration] = createSignal<string | null>(null);
  const [isAddingConfiguration, setIsAddingConfiguration] = createSignal(false);
  const [newConfigurationName, setNewConfigurationName] = createSignal('');
  const [error, setError] = createSignal<string | null>(null);
  const [deployingConfig, setDeployingConfig] = createSignal<string | null>(null);
  const [deployError, setDeployError] = createSignal('');

  const deploymentKeys = createMemo(() => Object.keys(props.appConf.deployments));

  const isDeploymentDeployed = (deploymentKey: string) => {
    return !!props.appConf.deployments[deploymentKey]?.roles?.contract;
  };

  const handleSelectDeployment = (deploymentKey: string) => {
    if (isDeploymentDeployed(deploymentKey)) {
      setSelectedDeployment(deploymentKey === selectedDeployment() ? null : deploymentKey);
      setSelectedConfiguration(null);
    }
  };

  const configurations = createMemo(() => {
    const deployment = selectedDeployment();
    if (!deployment) return {};
    return props.appConf.deployments[deployment]?.extra?.configurations || {};
  });

  const availableHooks = createMemo(() => {
    const deployment = selectedDeployment();
    if (!deployment) return [];
    const roles = props.appConf.deployments[deployment]?.roles || {};
    return Object.keys(roles)
      .filter((key) => key.endsWith('Hook'))
      .map((key) => ({ name: key, address: roles[key] }));
  });

  const chainConfig = createMemo(() => {
    const deployment = selectedDeployment();
    if (!deployment) return null;
    const details = props.appConf.deployments[deployment];
    if (!details) return null;
    return defineChain({
      id: parseInt(details.chainId),
      name: `Chain ${details.chainId}`,
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: { http: [details.rpcUrl] },
      },
    });
  });

  const publicClient = createMemo(() => {
    const chain = chainConfig();
    if (!chain) return null;
    const wagmiConfig = createConfig({
      chains: [chain],
      transports: {
        [chain.id]: http(chain.rpcUrls.default.http[0]),
      },
    });
    return getPublicClient(wagmiConfig, { chainId: chain.id });
  });

  // Query configuration deployment status
  const [configurationDeployStatus, { refetch: refetchDeployStatus }] = createResource(
    () => {
      const deployment = selectedDeployment();
      const client = publicClient();
      const configs = configurations();

      if (!deployment || !client) return null;

      const contractAddress = props.appConf.deployments[deployment]?.roles?.contract;
      if (!contractAddress) return null;

      return { deployment, client, configs, contractAddress };
    },
    async (source) => {
      const configNames = Object.keys(source.configs);
      const deploymentRoles = props.appConf.deployments[source.deployment]?.roles || {};

      // Query all configurations in parallel
      const results = await Promise.all(
        configNames.map(async (configName) => {
          try {
            // Generate configurationId using keccak256(toBytes(name))
            const configurationId = keccak256(toBytes(configName));

            // Call getBatchConfiguration
            const onChainConfig = (await source.client.readContract({
              address: source.contractAddress as `0x${string}`,
              abi: DistributorAbi,
              functionName: 'getBatchConfiguration',
              args: [configurationId],
            })) as {
              strategies: Array<{ proportion: bigint; hook: string }>;
              fallbackHook: bigint;
            };

            const isDeployed = onChainConfig.strategies.length > 0;

            if (!isDeployed) {
              return { configName, isDeployed: false, isMatched: true };
            }

            // Check if on-chain configuration matches local configuration
            const localConfig = source.configs[configName];
            let isMatched = true;

            // Check if strategy length matches
            if (onChainConfig.strategies.length !== localConfig.strategy.length) {
              isMatched = false;
            } else {
              // Check each strategy
              for (let i = 0; i < localConfig.strategy.length; i++) {
                const localStrategy = localConfig.strategy[i];
                const onChainStrategy = onChainConfig.strategies[i];

                // Convert local hook name to address
                const localHookAddress = (
                  deploymentRoles[localStrategy.hook] || localStrategy.hook
                ).toLowerCase();
                const onChainHookAddress = onChainStrategy.hook.toLowerCase();

                // Compare hook address and proportion
                if (
                  localHookAddress !== onChainHookAddress ||
                  BigInt(localStrategy.proportion) !== onChainStrategy.proportion
                ) {
                  isMatched = false;
                  break;
                }
              }

              // Check fallback index
              if (BigInt(localConfig.fallbackIdx) !== onChainConfig.fallbackHook) {
                isMatched = false;
              }
            }

            return { configName, isDeployed, isMatched };
          } catch (err) {
            console.error(`Failed to query configuration ${configName}:`, err);
            return { configName, isDeployed: false, isMatched: true };
          }
        })
      );

      // Convert results array to statusMap object
      const statusMap: Record<string, { isDeployed: boolean; isMatched: boolean }> = {};
      results.forEach(({ configName, isDeployed, isMatched }) => {
        statusMap[configName] = { isDeployed, isMatched };
      });

      return statusMap;
    }
  );

  const handleAddConfiguration = () => {
    const name = newConfigurationName().trim();
    const deployment = selectedDeployment();

    if (!deployment) {
      setError('No deployment selected');
      return;
    }

    if (!name) {
      setError('Configuration name is required');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      setError('Configuration name can only contain letters, numbers, hyphens and underscores');
      return;
    }

    if (name in configurations()) {
      setError('Configuration name already exists');
      return;
    }

    const newConfiguration: Configuration = {
      strategy: [],
      fallbackIdx: '0',
      deployed: false,
    };

    props.setAppConf('deployments', deployment, 'extra', 'configurations', name, newConfiguration);
    setNewConfigurationName('');
    setIsAddingConfiguration(false);
    setSelectedConfiguration(name);
    setError(null);
  };

  const handleDeleteConfiguration = (name: string) => {
    const deployment = selectedDeployment();
    if (!deployment) return;

    if (confirm(`Are you sure you want to delete configuration "${name}"?`)) {
      // Use produce to properly delete the configuration
      props.setAppConf(
        'deployments',
        deployment,
        'extra',
        produce((extra) => {
          if (extra.configurations?.[name]) {
            delete extra.configurations[name];
          }
        })
      );

      if (selectedConfiguration() === name) {
        setSelectedConfiguration(null);
      }
    }
  };

  const handleAddHook = (hookName: string) => {
    const deployment = selectedDeployment();
    const config = selectedConfiguration();
    if (!deployment || !config) return;

    const currentConfig = configurations()[config];
    const newStrategy: Strategy = {
      hook: hookName,
      proportion: parseEther('0').toString(),
    };

    props.setAppConf('deployments', deployment, 'extra', 'configurations', config, 'strategy', [
      ...currentConfig.strategy,
      newStrategy,
    ]);
  };

  const handleRemoveHook = (index: number) => {
    const deployment = selectedDeployment();
    const config = selectedConfiguration();
    if (!deployment || !config) return;

    const currentConfig = configurations()[config];
    const newStrategy = currentConfig.strategy.filter((_, i) => i !== index);

    props.setAppConf(
      'deployments',
      deployment,
      'extra',
      'configurations',
      config,
      'strategy',
      newStrategy
    );
  };

  const handleProportionChange = (index: number, value: string) => {
    const deployment = selectedDeployment();
    const config = selectedConfiguration();
    if (!deployment || !config) return;

    // Validate proportion (0-100 with 2 decimals)
    const num = parseFloat(value);
    if (isNaN(num) || num < 0 || num > 100) return;

    try {
      // Convert percentage to decimal: 25.5% -> 0.255
      // Then convert to bigint using parseEther and toString
      const proportionBigInt = parseEther(value) / 100n;
      const proportionString = proportionBigInt.toString();
      props.setAppConf(
        'deployments',
        deployment,
        'extra',
        'configurations',
        config,
        'strategy',
        index,
        'proportion',
        proportionString
      );
    } catch (error) {
      console.error('Error parsing proportion:', error);
    }
  };

  const handleSetFallback = (index: number) => {
    const deployment = selectedDeployment();
    const config = selectedConfiguration();
    if (!deployment || !config) return;

    props.setAppConf(
      'deployments',
      deployment,
      'extra',
      'configurations',
      config,
      'fallbackIdx',
      index.toString()
    );
  };

  const isFallback = (index: number) => {
    const config = selectedConfiguration();
    if (!config) return false;
    const currentConfig = configurations()[config];
    return currentConfig?.fallbackIdx === index.toString();
  };

  const isConfigurationDeployed = (configName: string) => {
    const status = configurationDeployStatus();
    return status?.[configName]?.isDeployed || false;
  };

  const isConfigurationMatched = (configName: string) => {
    const status = configurationDeployStatus();
    return status?.[configName]?.isMatched ?? true;
  };

  const handleDeployConfiguration = async (configName: string) => {
    const deployment = selectedDeployment();
    if (!deployment) {
      setDeployError('No deployment selected');
      return;
    }

    const configuration = configurations()[configName];
    if (!configuration) {
      setDeployError('Configuration not found');
      return;
    }

    if (!configuration.strategy || configuration.strategy.length === 0) {
      setDeployError('Configuration must have at least one hook');
      return;
    }

    if (!configuration.fallbackIdx) {
      setDeployError('Configuration must have a fallback hook');
      return;
    }

    const client = publicClient();
    if (!client) {
      setDeployError('Failed to create blockchain client');
      return;
    }

    // Convert hook names to addresses
    const deploymentRoles = props.appConf.deployments[deployment]?.roles || {};
    const strategyWithAddresses = configuration.strategy.map((s) => ({
      hook: deploymentRoles[s.hook] || s.hook,
      proportion: s.proportion,
    }));

    const configurationWithAddresses = {
      ...configuration,
      strategy: strategyWithAddresses,
    };

    setDeployingConfig(configName);
    setDeployError('');

    try {
      // Call the deploy API
      const result = await applyConfiguration(
        config.config.baseUrl,
        config.config.apiKey,
        props.appConf.appId,
        deployment,
        props.appConf.deployments[deployment]?.roles?.projectAdmin,
        configName,
        configurationWithAddresses
      );

      // Wait for transaction receipt
      const receipt = await client.waitForTransactionReceipt({
        hash: result.txHash as `0x${string}`,
      });

      if (receipt.status === 'success') {
        // Save deployed status to appConf
        props.setAppConf(
          'deployments',
          deployment,
          'extra',
          'configurations',
          configName,
          'deployed',
          true
        );

        // Refetch deployment status from blockchain
        refetchDeployStatus();

        await props.onSave?.();
      } else {
        setDeployError('Transaction failed');
      }
    } catch (err) {
      console.error('Failed to deploy configuration:', err);
      setDeployError(err instanceof Error ? err.message : 'Failed to deploy configuration');
    } finally {
      setDeployingConfig(null);
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

        {/* Deploy Error Message */}
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
              <h4 class="text-sm font-semibold text-blue-900">Configure Strategy</h4>
              <p class="text-xs text-blue-800 mt-1">
                <Show
                  when={selectedDeployment()}
                  fallback="Select a deployed deployment from the left sidebar to configure its distribution strategy."
                >
                  Configuring strategy for <span class="font-bold">{selectedDeployment()}</span>.
                  Each configuration defines how tokens will be distributed.
                </Show>
              </p>
            </div>
          </div>
        </div>

        {/* Strategy Configuration */}
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
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
              <p class="text-sm font-medium">Select a deployment to continue</p>
              <p class="text-xs mt-1">Choose a deployed deployment from the left sidebar</p>
            </div>
          }
        >
          {/* Configurations List */}
          <div class="border rounded-lg bg-white p-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-sm font-bold text-gray-700">Configurations</h3>
              <button
                onClick={() => {
                  setIsAddingConfiguration(true);
                  setError(null);
                }}
                disabled={isAddingConfiguration()}
                class="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
              >
                <FaSolidPlus size={12} />
                Add Configuration
              </button>
            </div>

            {/* Add Configuration Form */}
            <Show when={isAddingConfiguration()}>
              <div class="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <input
                  type="text"
                  value={newConfigurationName()}
                  onInput={(e) => setNewConfigurationName(e.currentTarget.value)}
                  placeholder="Configuration name"
                  class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg mb-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div class="flex gap-2">
                  <button
                    onClick={handleAddConfiguration}
                    class="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingConfiguration(false);
                      setNewConfigurationName('');
                      setError(null);
                    }}
                    class="px-3 py-1.5 text-xs font-medium bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </Show>

            {/* Configurations List */}
            <div class="space-y-2">
              <For each={Object.keys(configurations())}>
                {(configName) => (
                  <div
                    class={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                      selectedConfiguration() === configName
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:border-blue-300'
                    }`}
                    onClick={() => setSelectedConfiguration(configName)}
                  >
                    <div class="flex items-center justify-between mb-2">
                      <div class="flex items-center gap-2 flex-1">
                        <span class="font-medium text-sm">{configName}</span>
                        <Show
                          when={
                            isConfigurationDeployed(configName) &&
                            !isConfigurationMatched(configName)
                          }
                        >
                          <div class="px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-medium rounded flex items-center gap-1">
                            <VsWarning size={10} />
                            Modified
                          </div>
                        </Show>
                        <Show
                          when={
                            isConfigurationDeployed(configName) &&
                            isConfigurationMatched(configName)
                          }
                        >
                          <div class="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-medium rounded flex items-center gap-1">
                            <BsCheck2Circle size={10} />
                            Synced
                          </div>
                        </Show>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteConfiguration(configName);
                        }}
                        class="text-red-500 hover:text-red-700"
                      >
                        <BsTrash size={14} />
                      </button>
                    </div>
                    <div class="text-xs text-gray-600 mb-2">
                      {configurations()[configName].strategy.length} hook(s)
                    </div>
                    <Show
                      when={
                        isConfigurationDeployed(configName) && isConfigurationMatched(configName)
                      }
                      fallback={
                        <Show
                          when={
                            isConfigurationDeployed(configName) &&
                            !isConfigurationMatched(configName)
                          }
                          fallback={
                            // Not deployed
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeployConfiguration(configName);
                              }}
                              disabled={deployingConfig() === configName}
                              class="w-full px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                            >
                              {deployingConfig() === configName ? 'Deploying...' : 'Deploy'}
                            </button>
                          }
                        >
                          {/* Deployed but not matched */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeployConfiguration(configName);
                            }}
                            disabled={deployingConfig() === configName}
                            class="w-full px-3 py-1.5 text-xs font-medium bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            <VsWarning size={14} />
                            {deployingConfig() === configName ? 'Deploying...' : 'Redeploy'}
                          </button>
                        </Show>
                      }
                    >
                      {/* Deployed and matched */}
                      <div class="w-full px-3 py-1.5 text-xs font-medium bg-white text-gray-700 border border-gray-300 rounded flex items-center justify-center gap-2">
                        <BsCheck2Circle size={14} class="text-green-600" />
                        Deployed
                      </div>
                    </Show>
                  </div>
                )}
              </For>
              <Show when={Object.keys(configurations()).length === 0 && !isAddingConfiguration()}>
                <div class="text-center py-6 text-gray-400 text-xs">
                  No configurations yet. Click "Add Configuration" to create one.
                </div>
              </Show>
            </div>
          </div>

          {/* Configuration Editor */}
          <Show when={selectedConfiguration()}>
            <div class="border rounded-lg bg-white p-4">
              <h3 class="text-sm font-bold text-gray-700 mb-3">
                Strategy for "{selectedConfiguration()}"
              </h3>

              {/* Current Strategy */}
              <div class="space-y-2 mb-4">
                <For each={configurations()[selectedConfiguration()!].strategy}>
                  {(strategy, index) => (
                    <div class="p-3 border border-gray-300 rounded-lg">
                      <div class="flex items-center gap-3">
                        {/* Fallback Indicator */}
                        <div class="flex items-center gap-2 flex-1">
                          <Show
                            when={!isFallback(index())}
                            fallback={
                              <div class="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">
                                Fallback
                              </div>
                            }
                          >
                            <button
                              onClick={() => handleSetFallback(index())}
                              class="px-2 py-1 text-xs border border-gray-300 hover:bg-gray-100 rounded"
                            >
                              Set as Fallback
                            </button>
                          </Show>

                          {/* Hook Name */}
                          <span class="font-medium text-sm truncate" title={strategy.hook}>
                            {strategy.hook}
                          </span>
                        </div>

                        {/* Proportion Input */}
                        <Show
                          when={!isFallback(index())}
                          fallback={
                            <div class="text-xs text-gray-500 italic w-32 text-right">
                              N/A (fallback)
                            </div>
                          }
                        >
                          <div class="flex items-center gap-1">
                            <input
                              type="number"
                              value={(() => {
                                try {
                                  // Convert from bigint string back to percentage
                                  // Stored as decimal (e.g., 0.255 * 10^18), multiply by 100 to get 25.5%
                                  const decimal = formatEther(BigInt(strategy.proportion));
                                  return (parseFloat(decimal) * 100).toString();
                                } catch {
                                  return strategy.proportion;
                                }
                              })()}
                              onInput={(e) =>
                                handleProportionChange(index(), e.currentTarget.value)
                              }
                              min="0"
                              max="100"
                              step="0.01"
                              class="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <span class="text-xs text-gray-600">%</span>
                          </div>
                        </Show>

                        {/* Remove Button */}
                        <button
                          onClick={() => handleRemoveHook(index())}
                          class="text-red-500 hover:text-red-700"
                          title="Remove hook"
                        >
                          <BsTrash size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </For>

                <Show when={configurations()[selectedConfiguration()!].strategy.length === 0}>
                  <div class="text-center py-6 text-gray-400 text-xs">
                    No hooks added yet. Add hooks from the available hooks below.
                  </div>
                </Show>
              </div>

              {/* Available Hooks */}
              <div class="mt-4 pt-4 border-t border-gray-200">
                <h4 class="text-xs font-bold text-gray-700 mb-2">Available Hooks</h4>
                <div class="space-y-1">
                  <For each={availableHooks()}>
                    {(hook) => {
                      const alreadyAdded = configurations()[selectedConfiguration()!].strategy.some(
                        (s) => s.hook === hook.name
                      );

                      return (
                        <div class="flex items-center justify-between p-2 border border-gray-200 rounded">
                          <div class="flex-1">
                            <div class="text-sm font-medium">{hook.name}</div>
                            <div
                              class="text-xs text-gray-500 font-mono truncate"
                              title={hook.address}
                            >
                              {hook.address.slice(0, 10)}...{hook.address.slice(-8)}
                            </div>
                          </div>
                          <button
                            onClick={() => handleAddHook(hook.name)}
                            disabled={alreadyAdded}
                            class={`px-3 py-1 text-xs font-medium rounded ${
                              alreadyAdded
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                          >
                            {alreadyAdded ? 'Added' : 'Add'}
                          </button>
                        </div>
                      );
                    }}
                  </For>
                  <Show when={availableHooks().length === 0}>
                    <div class="text-center py-4 text-gray-400 text-xs">
                      No hooks deployed yet. Deploy hooks in the Hooks step first.
                    </div>
                  </Show>
                </div>
              </div>

              {/* Warning about fallback */}
              <Show when={configurations()[selectedConfiguration()!].strategy.length > 0}>
                <div class="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div class="flex items-start gap-2">
                    <svg
                      class="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clip-rule="evenodd"
                      />
                    </svg>
                    <div class="flex-1 text-xs text-yellow-800">
                      <p class="font-medium">Important:</p>
                      <ul class="mt-1 list-disc list-inside space-y-1">
                        <li>Each strategy must have exactly one fallback hook</li>
                        <li>The fallback hook will be used when no other hooks match</li>
                        <li>Proportion values are ignored for the fallback hook</li>
                        <li>Proportions should total 100% (excluding fallback)</li>
                        <li>
                          Proportions are stored as decimals with 18 decimal places (e.g., 25.5% =
                          0.255 * 10^18)
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </Show>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
}
