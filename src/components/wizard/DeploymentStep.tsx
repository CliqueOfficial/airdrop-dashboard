import { createSignal, Show, For, createMemo, useContext } from 'solid-js';
import type { Deployment } from '../../types';
import EditableListView from '../EditableListView';
import { useConfig } from '../../hooks/useConfig';
import { useRelayers } from '../../hooks/useRelayers';
import { AppConfContext } from '../../hooks/context/AppConf';
import { defineChain, http } from 'viem';
import { createConfig, getPublicClient } from '@wagmi/core';
import { ImSpinner8 } from 'solid-icons/im';

interface DeploymentParams {
  deployer: string;
  signer: string;
  token: string;
  vault: string;
  projectAdmin: string;
  isWrappedToken: boolean;
  dynamicRecipient: boolean;
}

interface DeployParams {
  appId: string;
  deployment: string;
  projectAdmin: string;
  deployer: string;
  signer: string;
  token: string;
  vault: string;
  isWrappedToken: boolean;
  dynamicRecipient: boolean;
}

const deployContract = async (baseUrl: string, apiKey: string, params: DeployParams) => {
  const response = await fetch(`${baseUrl}/admin/relay/distributor/deploy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(params),
  });
  return response.json() as Promise<{
    txHash: string;
  }>;
};

type DeploymentItem = [string, Deployment];

export default function DeploymentStep() {
  const { appConf, setAppConf, onSave } = useContext(AppConfContext)!;
  const { config } = useConfig();
  const { relayers } = useRelayers(appConf.appId);
  const [error, setError] = createSignal<string | null>(null);

  // Get offline relayers only
  const offlineRelayers = () => {
    const allRelayers = relayers() || [];
    return allRelayers.filter((r) => !r.online);
  };

  // Convert deployments object to array of entries
  const deploymentItems = (): DeploymentItem[] => {
    return Object.entries(appConf.deployments);
  };

  // Handle items change
  const handleItemsChange = async (items: DeploymentItem[]) => {
    const newDeployments: Record<string, Deployment> = {};
    items.forEach(([key, deployment]) => {
      newDeployments[key] = deployment;
    });

    console.log('newDeployments', newDeployments);
    setAppConf('deployments', newDeployments);

    // Save to remote
    if (onSave) {
      const saved = await onSave();
      if (!saved) {
        setError('Failed to save deployments. Please try again.');
      } else {
        setError(null);
      }
    }
  };

  // Create view for adding new deployment
  const createDeploymentView = (
    onItemCreated: (item: DeploymentItem) => void,
    onCancel: () => void
  ) => {
    const [name, setName] = createSignal('');
    const [chainId, setChainId] = createSignal('');
    const [rpcUrl, setRpcUrl] = createSignal('');
    const [createError, setCreateError] = createSignal<string | null>(null);

    const handleCreate = () => {
      const nameValue = name().trim();
      const chainIdValue = chainId().trim();
      const rpcUrlValue = rpcUrl().trim();

      if (!nameValue) {
        setCreateError('Deployment name is required');
        return;
      }
      if (!chainIdValue) {
        setCreateError('Chain ID is required');
        return;
      }
      if (!rpcUrlValue) {
        setCreateError('RPC URL is required');
        return;
      }

      // Check if name already exists
      if (nameValue in appConf.deployments) {
        setCreateError(`Deployment "${nameValue}" already exists`);
        return;
      }

      const newDeployment: Deployment = {
        chainId: chainIdValue,
        rpcUrl: rpcUrlValue,
        roles: {},
        extra: {
          root: {},
          configurations: {},
        },
      };

      onItemCreated([nameValue, newDeployment]);
    };

    return (
      <div class="space-y-3">
        <Show when={createError()}>
          <div class="p-2 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
            <span>{createError()}</span>
          </div>
        </Show>

        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">
            Deployment Name <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name()}
            onInput={(e) => {
              setName(e.currentTarget.value);
              setCreateError(null);
            }}
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g. mainnet, testnet, polygon"
          />
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">
            Chain ID <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={chainId()}
            onInput={(e) => {
              setChainId(e.currentTarget.value);
              setCreateError(null);
            }}
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g. 1, 137, 80001"
          />
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">
            RPC URL <span class="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={rpcUrl()}
            onInput={(e) => {
              setRpcUrl(e.currentTarget.value);
              setCreateError(null);
            }}
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="https://..."
          />
        </div>

        <div class="flex gap-2 pt-2">
          <button
            onClick={handleCreate}
            class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Add
          </button>
          <button
            onClick={onCancel}
            class="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };

  return (
    <div class="space-y-4">
      {error() && (
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
      )}

      <EditableListView
        title={<span class="text-sm font-medium text-gray-700">Deployment List</span>}
        items={deploymentItems()}
        createView={createDeploymentView}
        onItemsChange={handleItemsChange}
      >
        {([name, deployment], _index, isEditing, updateItem) => {
          const [showDeployForm, setShowDeployForm] = createSignal(false);
          const [deployParams, setDeployParams] = createSignal<DeploymentParams>({
            deployer: '',
            signer: '',
            token: '',
            vault: '',
            projectAdmin: '',
            isWrappedToken: false,
            dynamicRecipient: false,
          });
          const [isDeploying, setIsDeploying] = createSignal(false);
          const [deployError, setDeployError] = createSignal<string | null>(null);
          const [deployStatus, setDeployStatus] = createSignal('');

          // Create chain config for this deployment
          const chainConfig = createMemo(() => {
            if (!deployment.chainId || !deployment.rpcUrl) return null;

            const chain = defineChain({
              id: parseInt(deployment.chainId),
              name: 'Chain ' + deployment.chainId,
              nativeCurrency: {
                name: 'Chain ' + deployment.chainId,
                symbol: 'CHAIN' + deployment.chainId,
                decimals: 18,
              },
              rpcUrls: {
                default: {
                  http: [deployment.rpcUrl],
                },
              },
            });

            const config = createConfig({
              chains: [chain],
              transports: {
                [parseInt(deployment.chainId)]: http(),
              },
            });

            return config;
          });

          const publicClient = createMemo(() => {
            const wagmiConfig = chainConfig();
            if (!wagmiConfig) return null;
            return getPublicClient(wagmiConfig);
          });

          const validateAddress = (address: string): boolean => {
            return /^0x[a-fA-F0-9]{40}$/.test(address);
          };

          const handleDeploy = async () => {
            const params = deployParams();

            // Validate required fields
            if (!params.deployer) {
              setDeployError('Please select a deployer');
              return;
            }
            if (!params.signer) {
              setDeployError('Please select a signer');
              return;
            }
            if (!params.projectAdmin) {
              setDeployError('Please select a project admin');
              return;
            }
            if (!validateAddress(params.token)) {
              setDeployError('Invalid token address');
              return;
            }
            if (!validateAddress(params.vault)) {
              setDeployError('Invalid vault address');
              return;
            }

            setIsDeploying(true);
            setDeployError(null);
            setDeployStatus('');

            try {
              // Step 1: Submit deployment transaction
              setDeployStatus('Submitting deployment transaction...');
              const deployApiParams: DeployParams = {
                appId: appConf.appId,
                deployment: name,
                projectAdmin: params.projectAdmin,
                deployer: params.deployer,
                signer: params.signer,
                token: params.token,
                vault: params.vault,
                isWrappedToken: params.isWrappedToken,
                dynamicRecipient: params.dynamicRecipient,
              };

              const result = await deployContract(config.baseUrl, config.apiKey, deployApiParams);
              const { txHash } = result;

              if (!txHash) {
                throw new Error('No transaction hash returned from deployment');
              }

              setDeployStatus(`Transaction submitted: ${txHash}`);

              // Step 2: Wait for transaction receipt
              setDeployStatus('Waiting for transaction confirmation...');
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

              // Step 3: Get contract address from receipt
              const contractAddress = receipt.contractAddress;
              if (!contractAddress) {
                throw new Error('No contract address in transaction receipt');
              }

              setDeployStatus(`Contract deployed at: ${contractAddress}`);

              // Step 4: Update deployment with roles and contract address
              const updatedDeployment: Deployment = {
                ...deployment,
                roles: {
                  ...deployment.roles,
                  deployer: params.deployer,
                  signer: params.signer,
                  projectAdmin: params.projectAdmin,
                  contract: contractAddress,
                },
              };

              updateItem([name, updatedDeployment]);

              // Step 5: Save configuration to remote
              setDeployStatus('Saving configuration...');
              if (onSave) {
                const saved = await onSave();
                if (!saved) {
                  throw new Error('Failed to save configuration');
                }
              }

              setDeployStatus('Deployment successful!');

              // Success - close form after a brief delay
              await new Promise((resolve) => setTimeout(resolve, 1500));
              setShowDeployForm(false);
            } catch (err) {
              setDeployError(err instanceof Error ? err.message : 'Deployment failed');
              setDeployStatus('');
            } finally {
              setIsDeploying(false);
            }
          };

          return (
            <div class="p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div class="space-y-3">
                {/* Basic Info */}
                <div class="space-y-2">
                  <div>
                    <label class="block text-xs font-medium text-gray-600 mb-1">Name</label>
                    <div class="text-sm font-semibold text-gray-900">{name}</div>
                  </div>

                  <div>
                    <label class="block text-xs font-medium text-gray-600 mb-1">Chain ID</label>
                    <div class="text-sm text-gray-800">{deployment.chainId}</div>
                  </div>

                  <div>
                    <label class="block text-xs font-medium text-gray-600 mb-1">RPC URL</label>
                    <div class="text-sm text-gray-800 font-mono break-all">{deployment.rpcUrl}</div>
                  </div>

                  <div>
                    <label class="block text-xs font-medium text-gray-600 mb-1">Contract</label>
                    <div class="text-sm text-gray-800 font-mono break-all">
                      {deployment.roles?.contract || (
                        <span class="text-gray-400 italic">Not deployed</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Deploy Section - only show in editing mode */}
                <Show when={isEditing && !deployment.roles?.contract}>
                  <div class="pt-2 border-t border-gray-300">
                    <Show
                      when={!showDeployForm()}
                      fallback={
                        <div class="space-y-3">
                          {/* Deploy Status */}
                          <Show when={isDeploying() && deployStatus()}>
                            <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                              <div class="flex items-center gap-2 text-blue-800 text-sm">
                                <ImSpinner8 size={16} class="animate-spin" />
                                <span>{deployStatus()}</span>
                              </div>
                            </div>
                          </Show>

                          {/* Deploy Error */}
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

                          {/* Deployer */}
                          <div>
                            <label class="block text-xs font-medium text-gray-700 mb-1">
                              Deployer <span class="text-red-500">*</span>
                            </label>
                            <Show
                              when={offlineRelayers().length > 0}
                              fallback={
                                <div class="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                                  No offline relayers available. Create one in the Relayer step
                                  first.
                                </div>
                              }
                            >
                              <select
                                value={deployParams().deployer}
                                onChange={(e) => {
                                  setDeployParams({
                                    ...deployParams(),
                                    deployer: e.currentTarget.value,
                                  });
                                  setDeployError(null);
                                }}
                                class="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                              >
                                <option value="">Select deployer...</option>
                                <For each={offlineRelayers()}>
                                  {(relayer) => (
                                    <option value={relayer.address}>
                                      {relayer.address} (Chain {relayer.chainId})
                                    </option>
                                  )}
                                </For>
                              </select>
                            </Show>
                          </div>

                          {/* Signer */}
                          <div>
                            <label class="block text-xs font-medium text-gray-700 mb-1">
                              Signer <span class="text-red-500">*</span>
                            </label>
                            <Show when={offlineRelayers().length > 0}>
                              <select
                                value={deployParams().signer}
                                onChange={(e) => {
                                  setDeployParams({
                                    ...deployParams(),
                                    signer: e.currentTarget.value,
                                  });
                                  setDeployError(null);
                                }}
                                class="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                              >
                                <option value="">Select signer...</option>
                                <For each={offlineRelayers()}>
                                  {(relayer) => (
                                    <option value={relayer.address}>
                                      {relayer.address} (Chain {relayer.chainId})
                                    </option>
                                  )}
                                </For>
                              </select>
                            </Show>
                          </div>

                          {/* Project Admin */}
                          <div>
                            <label class="block text-xs font-medium text-gray-700 mb-1">
                              Project Admin <span class="text-red-500">*</span>
                            </label>
                            <Show when={offlineRelayers().length > 0}>
                              <select
                                value={deployParams().projectAdmin}
                                onChange={(e) => {
                                  setDeployParams({
                                    ...deployParams(),
                                    projectAdmin: e.currentTarget.value,
                                  });
                                  setDeployError(null);
                                }}
                                class="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                              >
                                <option value="">Select project admin...</option>
                                <For each={offlineRelayers()}>
                                  {(relayer) => (
                                    <option value={relayer.address}>
                                      {relayer.address} (Chain {relayer.chainId})
                                    </option>
                                  )}
                                </For>
                              </select>
                            </Show>
                          </div>

                          {/* Token Address */}
                          <div>
                            <label class="block text-xs font-medium text-gray-700 mb-1">
                              Token Address <span class="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={deployParams().token}
                              onInput={(e) => {
                                setDeployParams({
                                  ...deployParams(),
                                  token: e.currentTarget.value,
                                });
                                setDeployError(null);
                              }}
                              class="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="0x..."
                            />
                          </div>

                          {/* Vault Address */}
                          <div>
                            <label class="block text-xs font-medium text-gray-700 mb-1">
                              Vault Address <span class="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={deployParams().vault}
                              onInput={(e) => {
                                setDeployParams({
                                  ...deployParams(),
                                  vault: e.currentTarget.value,
                                });
                                setDeployError(null);
                              }}
                              class="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="0x..."
                            />
                          </div>

                          {/* Boolean Options */}
                          <div class="grid grid-cols-2 gap-2">
                            <label class="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                              <input
                                type="checkbox"
                                checked={deployParams().isWrappedToken}
                                onChange={(e) => {
                                  setDeployParams({
                                    ...deployParams(),
                                    isWrappedToken: e.currentTarget.checked,
                                  });
                                }}
                                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <div class="flex-1">
                                <div class="text-xs font-medium text-gray-900">Wrapped Token</div>
                              </div>
                            </label>

                            <label class="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                              <input
                                type="checkbox"
                                checked={deployParams().dynamicRecipient}
                                onChange={(e) => {
                                  setDeployParams({
                                    ...deployParams(),
                                    dynamicRecipient: e.currentTarget.checked,
                                  });
                                }}
                                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <div class="flex-1">
                                <div class="text-xs font-medium text-gray-900">
                                  Dynamic Recipient
                                </div>
                              </div>
                            </label>
                          </div>

                          {/* Action Buttons */}
                          <div class="flex gap-2">
                            <button
                              onClick={handleDeploy}
                              disabled={isDeploying() || offlineRelayers().length === 0}
                              class={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                                isDeploying() || offlineRelayers().length === 0
                                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                  : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
                              }`}
                            >
                              <Show when={isDeploying()}>
                                <ImSpinner8 size={14} class="animate-spin" />
                              </Show>
                              {isDeploying() ? 'Deploying...' : 'Deploy Contract'}
                            </button>
                            <button
                              onClick={() => setShowDeployForm(false)}
                              disabled={isDeploying()}
                              class="px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      }
                    >
                      <button
                        onClick={() => setShowDeployForm(true)}
                        class="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg text-sm font-medium transition-all"
                      >
                        Deploy Contract
                      </button>
                    </Show>
                  </div>
                </Show>
              </div>
            </div>
          );
        }}
      </EditableListView>
    </div>
  );
}
