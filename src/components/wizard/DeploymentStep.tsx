import { createSignal, For, Show, createResource, createMemo } from 'solid-js';
import { AppConf, Deployment } from '../../hooks/useAppConf';
import { SetStoreFunction } from 'solid-js/store';
import { useConfig } from '../../hooks/useConfig';
import { BsCheck2Circle } from 'solid-icons/bs';
import { VsWarning } from 'solid-icons/vs';
import { defineChain, http } from 'viem';
import { createConfig, getPublicClient } from '@wagmi/core';
import { FaSolidSpinner } from 'solid-icons/fa';

interface Relayer {
  address: string;
  chain_id: string;
  nonce: string;
  online: boolean;
}

const listRelayer = async (appId: string, baseUrl: string, apiKey: string) => {
  const response = await fetch(`${baseUrl}/admin/relayer/${appId}`, {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
  });
  return response.json() as Promise<Relayer[]>;
};

interface DeploymentStepProps {
  appConf: AppConf;
  setAppConf: SetStoreFunction<AppConf>;
  onSave?: () => Promise<boolean>;
}

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

export default function DeploymentStep(props: DeploymentStepProps) {
  const { config } = useConfig();
  const [selectedDeployment, setSelectedDeployment] = createSignal<string | null>(null);
  const [isAdding, setIsAdding] = createSignal(false);
  const [deploymentKey, setDeploymentKey] = createSignal('');
  const [chainId, setChainId] = createSignal('');
  const [rpcUrl, setRpcUrl] = createSignal('');
  const [error, setError] = createSignal<string | null>(null);
  const [isSaving, setIsSaving] = createSignal(false);
  const [showDeploySection, setShowDeploySection] = createSignal(false);
  const [deployParams, setDeployParams] = createSignal<DeploymentParams>({
    deployer: '',
    signer: '',
    token: '',
    vault: '',
    projectAdmin: '',
    isWrappedToken: false,
    dynamicRecipient: false,
  });
  const [deployError, setDeployError] = createSignal<string | null>(null);
  const [isDeploying, setIsDeploying] = createSignal(false);
  const [deployStatus, setDeployStatus] = createSignal<string>('');

  // Create chain config and public client for selected deployment
  const chainConfig = createMemo(() => {
    const deployment = selectedDeployment()
      ? props.appConf.deployments[selectedDeployment()!]
      : null;
    if (!deployment) return null;

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
    const config = chainConfig();
    if (!config) return null;
    return getPublicClient(config);
  });

  // Fetch relayers
  const [relayers] = createResource(
    () => ({ appId: props.appConf.appId, baseUrl: config.baseUrl, apiKey: config.apiKey }),
    async ({ appId, baseUrl, apiKey }) => {
      if (!appId) return [];
      try {
        return await listRelayer(appId, baseUrl, apiKey);
      } catch (error) {
        console.error('Error fetching relayers:', error);
        return [];
      }
    }
  );

  // Get offline relayers only
  const offlineRelayers = () => {
    const allRelayers = relayers() || [];
    return allRelayers.filter((r) => !r.online);
  };

  const hasOfflineRelayers = () => offlineRelayers().length > 0;

  const existingKeys = () => Object.keys(props.appConf.deployments);
  const hasDeployments = () => existingKeys().length > 0;

  const handleStartAdding = () => {
    setIsAdding(true);
    setSelectedDeployment(null);
    setDeploymentKey('');
    setChainId('');
    setRpcUrl('');
    setError(null);
  };

  const handleCancelAdding = () => {
    setIsAdding(false);
    setDeploymentKey('');
    setChainId('');
    setRpcUrl('');
    setError(null);
  };

  const handleAddDeployment = async () => {
    const key = deploymentKey().trim();

    // Validation
    if (!key) {
      setError('Deployment name is required');
      return;
    }

    if (!chainId()) {
      setError('Chain ID is required');
      return;
    }

    if (!rpcUrl()) {
      setError('RPC URL is required');
      return;
    }

    // Check for key conflict
    if (key in props.appConf.deployments) {
      setError(`Deployment "${key}" already exists. Please use a different name.`);
      return;
    }

    // Create new deployment
    const newDeployment: Deployment = {
      chainId: chainId(),
      rpcUrl: rpcUrl(),
      roles: {},
      extra: {
        root: {},
        configurations: {},
      },
    };

    // Add to deployments
    props.setAppConf('deployments', key, newDeployment);

    // Save to remote immediately after adding
    if (props.onSave) {
      setIsSaving(true);
      setError(null);
      const saved = await props.onSave();
      setIsSaving(false);

      if (!saved) {
        setError('Failed to save deployment. Please try again.');
        return;
      }
    }

    // Select the newly added deployment
    setSelectedDeployment(key);
    setIsAdding(false);
    setError(null);
  };

  const handleSelectDeployment = (key: string) => {
    setSelectedDeployment(key);
    setIsAdding(false);
    setError(null);
  };

  const handleDeleteDeployment = async (key: string) => {
    if (confirm(`Are you sure you want to delete deployment "${key}"?`)) {
      // Remove deployment
      const newDeployments = { ...props.appConf.deployments };
      delete newDeployments[key];
      props.setAppConf('deployments', newDeployments);

      // Clear selection if deleted deployment was selected
      if (selectedDeployment() === key) {
        setSelectedDeployment(null);
      }

      // Save to remote immediately after deleting
      if (props.onSave) {
        setIsSaving(true);
        await props.onSave();
        setIsSaving(false);
      }
    }
  };

  const validateAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  const handleToggleDeploySection = () => {
    if (!showDeploySection()) {
      // Reset form when opening
      setDeployParams({
        deployer: '',
        signer: '',
        token: '',
        vault: '',
        projectAdmin: '',
        isWrappedToken: false,
        dynamicRecipient: false,
      });
      setDeployError(null);
    }
    setShowDeploySection(!showDeploySection());
  };

  const handleDeployContract = async () => {
    const params = deployParams();
    const deployment = selectedDeployment();

    if (!deployment) {
      setDeployError('No deployment selected');
      return;
    }

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
      // Step 1: Save roles to deployment
      setDeployStatus('Saving roles to configuration...');
      props.setAppConf('deployments', deployment, 'roles', 'deployer', params.deployer);
      props.setAppConf('deployments', deployment, 'roles', 'signer', params.signer);
      props.setAppConf('deployments', deployment, 'roles', 'projectAdmin', params.projectAdmin);

      // Step 2: Call deploy contract API
      setDeployStatus('Submitting deployment transaction...');
      const deployApiParams: DeployParams = {
        appId: props.appConf.appId,
        deployment: deployment,
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

      // Step 3: Wait for transaction receipt
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

      // Step 4: Get contract address from receipt
      const contractAddress = receipt.contractAddress;
      if (!contractAddress) {
        throw new Error('No contract address in transaction receipt');
      }

      setDeployStatus(`Contract deployed at: ${contractAddress}`);

      // Step 5: Save contract address to roles
      setDeployStatus('Saving contract address...');
      props.setAppConf('deployments', deployment, 'roles', 'contract', contractAddress);

      // Step 6: Save configuration to remote
      setDeployStatus('Saving configuration...');
      if (props.onSave) {
        const saved = await props.onSave();
        if (!saved) {
          throw new Error('Failed to save configuration');
        }
      }

      setDeployStatus('Deployment successful!');

      // Success - close section after a brief delay
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setShowDeploySection(false);
    } catch (err) {
      setDeployError(err instanceof Error ? err.message : 'Deployment failed');
      setDeployStatus('');
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div class="space-y-4">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-medium text-gray-700">Deployments</h3>
          <p class="text-xs text-gray-500 mt-1">
            {hasDeployments()
              ? `${existingKeys().length} deployment${existingKeys().length > 1 ? 's' : ''} configured`
              : 'No deployments yet'}
          </p>
        </div>
        <button
          onClick={handleStartAdding}
          disabled={isAdding()}
          class={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            isAdding()
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          + Add Deployment
        </button>
      </div>

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

      {/* Deployments List */}
      <div class="border rounded-lg divide-y">
        {/* Add New Form */}
        <Show when={isAdding()}>
          <div class="p-4 bg-blue-50">
            <div class="space-y-3">
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">
                  Deployment Name <span class="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={deploymentKey()}
                  onInput={(e) => {
                    setDeploymentKey(e.currentTarget.value);
                    setError(null);
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
                    setError(null);
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
                    setError(null);
                  }}
                  class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://..."
                />
              </div>

              <div class="flex gap-2 pt-2">
                <button
                  onClick={handleAddDeployment}
                  disabled={!deploymentKey().trim() || !chainId() || !rpcUrl() || isSaving()}
                  class={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    !deploymentKey().trim() || !chainId() || !rpcUrl() || isSaving()
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <Show when={isSaving()}>
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
                  </Show>
                  {isSaving() ? 'Saving...' : 'Add'}
                </button>
                <button
                  onClick={handleCancelAdding}
                  disabled={isSaving()}
                  class="px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </Show>

        {/* Existing Deployments */}
        <Show
          when={hasDeployments()}
          fallback={
            <Show when={!isAdding()}>
              <div class="p-8 text-center text-gray-500">
                <p class="text-sm">No deployments configured yet</p>
                <p class="text-xs mt-1">Click "Add Deployment" to get started</p>
              </div>
            </Show>
          }
        >
          <For each={existingKeys()}>
            {(key) => {
              const deployment = props.appConf.deployments[key];
              const isSelected = selectedDeployment() === key;

              return (
                <div
                  class={`p-4 cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleSelectDeployment(key)}
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <div class="flex items-center gap-2.5">
                        {/* Deployment Status Icon */}
                        <Show
                          when={deployment.roles?.contract}
                          fallback={
                            <div class="relative group">
                              <VsWarning size={16} class="text-yellow-500" />
                              <div class="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10 shadow-lg">
                                Contract not deployed yet
                              </div>
                            </div>
                          }
                        >
                          <div class="relative group">
                            <BsCheck2Circle size={16} class="text-green-500" />
                            <div class="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10 shadow-lg">
                              Contract deployed
                            </div>
                          </div>
                        </Show>
                        <h4 class="font-medium text-gray-900">{key}</h4>
                        <Show when={isSelected}>
                          <span class="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                            Selected
                          </span>
                        </Show>
                      </div>
                      <div class="mt-1 space-y-0.5">
                        <p class="text-xs text-gray-600">
                          <span class="font-medium">Chain ID:</span> {deployment.chainId}
                        </p>
                        <p class="text-xs text-gray-600 break-all">
                          <span class="font-medium">RPC:</span> {deployment.rpcUrl}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDeployment(key);
                      }}
                      class="ml-2 p-1 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete deployment"
                    >
                      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            }}
          </For>
        </Show>
      </div>

      {/* Selected Deployment Details */}
      <Show when={selectedDeployment()}>
        <div class="mt-4 space-y-4">
          {/* Contract Status Card */}
          <div class="p-4 border rounded-lg bg-gray-50">
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-sm font-medium text-gray-700">
                Configuration for "{selectedDeployment()}"
              </h4>
              <Show when={!props.appConf.deployments[selectedDeployment()!]?.roles?.contract}>
                <button
                  onClick={handleToggleDeploySection}
                  class={`px-4 py-2 text-sm font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2 ${
                    showDeploySection()
                      ? 'bg-gray-500 hover:bg-gray-600 text-white'
                      : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
                  }`}
                >
                  <Show when={!showDeploySection()}>
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    Deploy Contract
                  </Show>
                  <Show when={showDeploySection()}>
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                    Cancel
                  </Show>
                </button>
              </Show>
            </div>

            {/* Contract Status */}
            <Show
              when={props.appConf.deployments[selectedDeployment()!]?.roles?.contract}
              fallback={
                <div class="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div class="flex items-start gap-2">
                    <svg
                      class="w-5 h-5 text-yellow-600 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clip-rule="evenodd"
                      />
                    </svg>
                    <div>
                      <p class="text-sm font-medium text-yellow-800">Contract Not Deployed</p>
                      <p class="text-xs text-yellow-700 mt-1">
                        Click the "Deploy Contract" button to configure and deploy the smart
                        contract.
                      </p>
                    </div>
                  </div>
                </div>
              }
            >
              <div class="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div class="flex items-start gap-2">
                  <svg
                    class="w-5 h-5 text-green-600 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  <div class="flex-1">
                    <p class="text-sm font-medium text-green-800">Contract Deployed</p>
                    <p class="text-xs text-green-700 mt-1 font-mono break-all">
                      {props.appConf.deployments[selectedDeployment()!]?.roles?.contract}
                    </p>
                  </div>
                </div>
              </div>
            </Show>
          </div>

          {/* Deployment Configuration Section */}
          <Show
            when={
              showDeploySection() &&
              !props.appConf.deployments[selectedDeployment()!]?.roles?.contract
            }
          >
            <div class="border rounded-lg bg-white shadow-sm">
              <div class="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-b">
                <h4 class="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <svg
                    class="w-5 h-5 text-purple-600"
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
                  Contract Deployment Configuration
                </h4>
                <p class="text-xs text-gray-600 mt-1">
                  Configure the parameters for deploying your smart contract
                </p>
              </div>

              <div class="p-4 space-y-4">
                {/* Deployment Status */}
                <Show when={isDeploying() && deployStatus()}>
                  <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div class="flex items-center gap-2 text-blue-800 text-sm">
                      <FaSolidSpinner size={16} class="animate-spin" />
                      <span>{deployStatus()}</span>
                    </div>
                  </div>
                </Show>

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

                {/* No Offline Relayers Warning */}
                <Show when={!relayers.loading && !hasOfflineRelayers()}>
                  <div class="p-4 bg-amber-50 border border-amber-300 rounded-lg">
                    <div class="flex items-start gap-3">
                      <svg
                        class="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          clip-rule="evenodd"
                        />
                      </svg>
                      <div class="flex-1">
                        <p class="text-sm font-semibold text-amber-900">
                          No Offline Relayers Available
                        </p>
                        <p class="text-xs text-amber-800 mt-1">
                          You need to create at least one offline relayer before deploying a
                          contract. Go to the Relayer step and create relayers with "Set relayer as
                          online" unchecked.
                        </p>
                      </div>
                    </div>
                  </div>
                </Show>

                {/* Address Inputs */}
                <div class="grid grid-cols-1 gap-4">
                  <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1">
                      Deployer <span class="text-red-500">*</span>
                    </label>
                    <Show
                      when={hasOfflineRelayers()}
                      fallback={
                        <div class="w-full px-3 py-2 text-sm bg-gray-100 border border-gray-300 rounded-lg text-gray-500 cursor-not-allowed">
                          No offline relayers available
                        </div>
                      }
                    >
                      <select
                        value={deployParams().deployer}
                        onChange={(e) => {
                          setDeployParams({ ...deployParams(), deployer: e.currentTarget.value });
                          setDeployError(null);
                        }}
                        class="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                      >
                        <option value="">Select deployer...</option>
                        <For each={offlineRelayers()}>
                          {(relayer) => (
                            <option value={relayer.address}>
                              {relayer.address} (Chain {relayer.chain_id})
                            </option>
                          )}
                        </For>
                      </select>
                    </Show>
                  </div>

                  <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1">
                      Signer <span class="text-red-500">*</span>
                    </label>
                    <Show
                      when={hasOfflineRelayers()}
                      fallback={
                        <div class="w-full px-3 py-2 text-sm bg-gray-100 border border-gray-300 rounded-lg text-gray-500 cursor-not-allowed">
                          No offline relayers available
                        </div>
                      }
                    >
                      <select
                        value={deployParams().signer}
                        onChange={(e) => {
                          setDeployParams({ ...deployParams(), signer: e.currentTarget.value });
                          setDeployError(null);
                        }}
                        class="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                      >
                        <option value="">Select signer...</option>
                        <For each={offlineRelayers()}>
                          {(relayer) => (
                            <option value={relayer.address}>
                              {relayer.address} (Chain {relayer.chain_id})
                            </option>
                          )}
                        </For>
                      </select>
                    </Show>
                  </div>

                  <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1">
                      Token Address <span class="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={deployParams().token}
                      onInput={(e) => {
                        setDeployParams({ ...deployParams(), token: e.currentTarget.value });
                        setDeployError(null);
                      }}
                      class="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="0x..."
                    />
                  </div>

                  <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1">
                      Vault Address <span class="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={deployParams().vault}
                      onInput={(e) => {
                        setDeployParams({ ...deployParams(), vault: e.currentTarget.value });
                        setDeployError(null);
                      }}
                      class="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="0x..."
                    />
                  </div>

                  <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1">
                      Project Admin <span class="text-red-500">*</span>
                    </label>
                    <Show
                      when={hasOfflineRelayers()}
                      fallback={
                        <div class="w-full px-3 py-2 text-sm bg-gray-100 border border-gray-300 rounded-lg text-gray-500 cursor-not-allowed">
                          No offline relayers available
                        </div>
                      }
                    >
                      <select
                        value={deployParams().projectAdmin}
                        onChange={(e) => {
                          setDeployParams({
                            ...deployParams(),
                            projectAdmin: e.currentTarget.value,
                          });
                          setDeployError(null);
                        }}
                        class="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                      >
                        <option value="">Select project admin...</option>
                        <For each={offlineRelayers()}>
                          {(relayer) => (
                            <option value={relayer.address}>
                              {relayer.address} (Chain {relayer.chain_id})
                            </option>
                          )}
                        </For>
                      </select>
                    </Show>
                  </div>
                </div>

                {/* Boolean Options */}
                <div class="grid grid-cols-2 gap-4 pt-2">
                  <label class="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={deployParams().isWrappedToken}
                      onChange={(e) => {
                        setDeployParams({
                          ...deployParams(),
                          isWrappedToken: e.currentTarget.checked,
                        });
                      }}
                      class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <div class="flex-1">
                      <div class="text-sm font-medium text-gray-900">Wrapped Token</div>
                      <div class="text-xs text-gray-500">Is this a wrapped token?</div>
                    </div>
                  </label>

                  <label class="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={deployParams().dynamicRecipient}
                      onChange={(e) => {
                        setDeployParams({
                          ...deployParams(),
                          dynamicRecipient: e.currentTarget.checked,
                        });
                      }}
                      class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <div class="flex-1">
                      <div class="text-sm font-medium text-gray-900">Dynamic Recipient</div>
                      <div class="text-xs text-gray-500">Enable dynamic recipients?</div>
                    </div>
                  </label>
                </div>

                {/* Action Buttons */}
                <div class="flex gap-3 pt-2 border-t">
                  <button
                    onClick={handleDeployContract}
                    disabled={isDeploying() || !hasOfflineRelayers()}
                    class={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      isDeploying() || !hasOfflineRelayers()
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-md hover:shadow-lg'
                    }`}
                  >
                    <Show when={isDeploying()}>
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
                    </Show>
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    {isDeploying() ? 'Deploying...' : 'Deploy Contract'}
                  </button>
                  <button
                    onClick={handleToggleDeploySection}
                    disabled={isDeploying()}
                    class="px-4 py-2.5 rounded-lg text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
