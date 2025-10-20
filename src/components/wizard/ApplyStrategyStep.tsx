import { For, createSignal, Show, createMemo, createResource, Accessor, Suspense } from 'solid-js';
import type { AppConf, Deployment } from '../../types';
import { SetStoreFunction, produce } from 'solid-js/store';
import { BsCheck2Circle, BsTrash } from 'solid-icons/bs';
import { VsWarning } from 'solid-icons/vs';
import { FiSettings } from 'solid-icons/fi';
import { FaSolidPlus } from 'solid-icons/fa';
import { defineChain, http, keccak256, toBytes } from 'viem';
import { createConfig, getPublicClient } from '@wagmi/core';
import { useConfig } from '../../hooks/useConfig';
import DistributorAbi from '../../abi/Distributor.abi';
import { createPublicClient } from '../../util';
import TabView from '../TabView';

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
  configuration: `0x${string}`
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
      configuration,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to set claim root');
  }

  return response.json() as Promise<{ txHash: string }>;
};

export default function ApplyStrategyStep(props: ApplyStrategyStepProps) {
  const deployments = () => props.appConf.deployments;
  const availableRoots = () => props.appConf.extra.root;

  const tabs = () => {
    return Object.keys(deployments()).map((name) => ({
      id: name,
      label: name,
    }));
  };

  return (
    <TabView tabs={tabs()}>
      {(tab) => (
        <div>
          <DeploymentConfigurationPanel
            appId={props.appConf.appId}
            name={tab.id}
            deployment={deployments()[tab.id]}
            roots={availableRoots}
          />
        </div>
      )}
    </TabView>
  );
}

interface DeploymentConfigurationPanelProps {
  appId: string;
  name: string;
  deployment: Deployment;
  roots: Accessor<Record<string, string>>;
}

function DeploymentConfigurationPanel(props: DeploymentConfigurationPanelProps) {
  const { config } = useConfig();
  const contractAddress = createMemo(() => props.deployment.roles.contract);
  const client = createMemo(() =>
    createPublicClient(props.deployment.chainId, props.deployment.rpcUrl)
  );
  const availableConfigurationId = createMemo(() =>
    Object.keys(props.deployment.extra.configurations || {})
  );

  const [selectedRoot, setSelectedRoot] = createSignal<string>('');
  const [selectedConfiguration, setSelectedConfiguration] = createSignal<string>('');
  const [isApplying, setIsApplying] = createSignal(false);
  const [applyError, setApplyError] = createSignal<string | null>(null);
  const [removingRoot, setRemovingRoot] = createSignal<string | null>(null);

  const [configuredRoots, { refetch }] = createResource(
    () => ({
      client: client(),
      contractAddress: contractAddress(),
      roots: props.roots(),
      availableConfigurationId: availableConfigurationId(),
    }),
    async ({ client, contractAddress, roots, availableConfigurationId }) => {
      const configurationIdPromises = Object.entries(roots).map(async ([name, root]) => {
        if (!client || !contractAddress) return {};
        const configurationId = await client.readContract({
          address: contractAddress as `0x${string}`,
          abi: DistributorAbi,
          functionName: 'configurationId',
          args: [root as `0x${string}`],
        });

        const id = availableConfigurationId.find(
          (id) => keccak256(toBytes(id)) === configurationId
        );

        return {
          name,
          id,
        };
      });
      return Promise.all(configurationIdPromises);
    }
  );

  const handleSetClaimRoot = async (root: `0x${string}`, configuration: `0x${string}`) => {
    // Call API to set claim root via relay
    const { txHash } = await setClaimRoot(
      config.baseUrl,
      config.apiKey,
      props.appId,
      props.name,
      props.deployment.roles.projectAdmin,
      root,
      configuration
    );

    // Wait for transaction receipt
    const currentClient = client();
    if (!currentClient) {
      throw new Error('Client not initialized');
    }

    const receipt = await currentClient.waitForTransactionReceipt({
      hash: txHash as `0x${string}`,
      timeout: 60_000, // 60 seconds timeout
    });

    if (receipt.status !== 'success') {
      throw new Error('Transaction failed');
    }

    // Refetch the configured roots after successful transaction
    refetch();

    return receipt;
  };

  const handleRemoveRoot = async (rootName: string) => {
    const rootHash = props.roots()[rootName] as `0x${string}`;
    if (!rootHash) {
      throw new Error('Root hash not found');
    }

    // Set claim root to zero bytes32 to remove it
    const ZERO_BYTES32 =
      '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;
    await handleSetClaimRoot(rootHash, ZERO_BYTES32);
  };

  return (
    <div class="space-y-4">
      <Suspense
        fallback={
          <div class="flex items-center justify-center py-12">
            <div class="text-gray-400 text-sm">Loading configurations...</div>
          </div>
        }
      >
        <Show
          when={configuredRoots() && configuredRoots()!.filter((r) => r.id).length > 0}
          fallback={
            <div class="text-center py-12 px-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <FiSettings class="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p class="text-gray-500 text-sm font-medium">No configurations applied yet</p>
              <p class="text-gray-400 text-xs mt-1">Apply a strategy to get started</p>
            </div>
          }
        >
          <div class="grid gap-4">
            <For each={configuredRoots()}>
              {(root) => (
                <Show when={root.id}>
                  <div class="group relative bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                    {/* Status indicator */}
                    <div class="absolute left-0 top-0 bottom-0 w-1 bg-green-500" />

                    <div class="p-5 pl-6">
                      <div class="flex items-start justify-between gap-4">
                        {/* Content */}
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2 mb-2">
                            <BsCheck2Circle class="w-5 h-5 text-green-500 flex-shrink-0" />
                            <h4 class="text-base font-semibold text-gray-900 truncate">
                              {root.name}
                            </h4>
                          </div>

                          <div class="space-y-1">
                            <div class="flex items-center gap-2">
                              <span class="text-xs font-medium text-gray-500">
                                Configuration ID:
                              </span>
                              <code class="text-xs font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded">
                                {root.id}
                              </code>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div class="flex-shrink-0">
                          <button
                            class="
                              inline-flex items-center gap-2 px-3 py-2
                              text-sm font-medium text-red-700
                              bg-red-50 hover:bg-red-100
                              border border-red-200 hover:border-red-300
                              rounded-md
                              transition-all duration-200
                              focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2
                              opacity-60 group-hover:opacity-100
                              disabled:opacity-40 disabled:cursor-not-allowed
                            "
                            disabled={removingRoot() === root.name || isApplying()}
                            onClick={async () => {
                              const rootName = root.name;
                              if (!rootName) return;

                              if (
                                !confirm(
                                  `Are you sure you want to remove the configuration for "${rootName}"? This will set its claim root to zero.`
                                )
                              ) {
                                return;
                              }

                              setRemovingRoot(rootName);
                              try {
                                await handleRemoveRoot(rootName);
                              } catch (error) {
                                alert(
                                  error instanceof Error
                                    ? error.message
                                    : 'Failed to remove configuration'
                                );
                              } finally {
                                setRemovingRoot(null);
                              }
                            }}
                          >
                            <Show
                              when={removingRoot() === root.name}
                              fallback={<BsTrash class="w-4 h-4" />}
                            >
                              <div class="w-4 h-4 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
                            </Show>
                            <span>{removingRoot() === root.name ? 'Removing...' : 'Remove'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Show>
              )}
            </For>
          </div>
        </Show>
      </Suspense>

      <div class="mt-6 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
        <div class="flex items-center gap-2 mb-4">
          <div class="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-lg">
            <FaSolidPlus class="w-4 h-4 text-white" />
          </div>
          <h3 class="text-lg font-semibold text-gray-900">Apply New Configuration</h3>
        </div>

        <div class="space-y-4">
          {/* Root Selection */}
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Select Root</label>
            <select
              class="
                w-full px-4 py-2.5 
                bg-white border border-gray-300 rounded-lg
                text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                transition-all duration-200
              "
              value={selectedRoot()}
              onChange={(e) => setSelectedRoot(e.currentTarget.value)}
            >
              <option value="">Choose a root...</option>
              <For each={Object.entries(props.roots())}>
                {([name, hash]) => <option value={name}>{name}</option>}
              </For>
            </select>
          </div>

          {/* Configuration Selection */}
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Select Configuration</label>
            <select
              class="
                w-full px-4 py-2.5 
                bg-white border border-gray-300 rounded-lg
                text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                transition-all duration-200
                disabled:bg-gray-100 disabled:cursor-not-allowed
              "
              value={selectedConfiguration()}
              onChange={(e) => setSelectedConfiguration(e.currentTarget.value)}
              disabled={availableConfigurationId().length === 0}
            >
              <option value="">Choose a configuration...</option>
              <For each={availableConfigurationId()}>
                {(configId) => <option value={configId}>{configId}</option>}
              </For>
            </select>
            <Show when={availableConfigurationId().length === 0}>
              <p class="mt-2 text-xs text-amber-600 flex items-center gap-1">
                <VsWarning class="w-3 h-3" />
                No configurations available for this deployment
              </p>
            </Show>
          </div>

          {/* Error Message */}
          <Show when={applyError()}>
            <div class="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p class="text-sm text-red-700 flex items-center gap-2">
                <VsWarning class="w-4 h-4 flex-shrink-0" />
                {applyError()}
              </p>
            </div>
          </Show>

          {/* Apply Button */}
          <div class="flex gap-3 pt-2">
            <button
              class="
                flex-1 inline-flex items-center justify-center gap-2
                px-4 py-2.5
                bg-blue-600 hover:bg-blue-700
                text-white font-medium text-sm
                rounded-lg
                transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                disabled:bg-gray-300 disabled:cursor-not-allowed
              "
              disabled={!selectedRoot() || !selectedConfiguration() || isApplying()}
              onClick={async () => {
                setApplyError(null);
                setIsApplying(true);
                try {
                  const rootName = selectedRoot();
                  const configName = selectedConfiguration();

                  // Get root hash
                  const rootHash = props.roots()[rootName] as `0x${string}`;
                  if (!rootHash) {
                    throw new Error('Root hash not found');
                  }

                  // Get configuration hash
                  const configHash = keccak256(toBytes(configName));

                  // Apply the configuration
                  await handleSetClaimRoot(rootHash, configHash);

                  // Success - reset form
                  setSelectedRoot('');
                  setSelectedConfiguration('');
                } catch (error) {
                  setApplyError(
                    error instanceof Error ? error.message : 'Failed to apply configuration'
                  );
                } finally {
                  setIsApplying(false);
                }
              }}
            >
              <Show when={isApplying()} fallback={<FaSolidPlus class="w-4 h-4" />}>
                <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </Show>
              <span>{isApplying() ? 'Applying...' : 'Apply Configuration'}</span>
            </button>

            <button
              class="
                px-4 py-2.5
                bg-white hover:bg-gray-50
                text-gray-700 font-medium text-sm
                border border-gray-300
                rounded-lg
                transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed
              "
              disabled={isApplying()}
              onClick={() => {
                setSelectedRoot('');
                setSelectedConfiguration('');
                setApplyError(null);
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
