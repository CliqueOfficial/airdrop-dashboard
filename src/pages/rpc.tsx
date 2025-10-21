import { createSignal, createResource, For, Show, Suspense } from 'solid-js';
import { useConfig } from '../hooks/useConfig';

interface SetRpcParams {
  chainId: string;
  rpcUrl: string;
}

interface RpcConfig {
  chainId: string;
  rpcUrl: string;
}

const setRpc = async (baseUrl: string, apiKey: string, params: SetRpcParams) => {
  const response = await fetch(`${baseUrl}/admin/rpc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    throw new Error(`Failed to set RPC: ${response.statusText}`);
  }
  return response.json() as Promise<{
    message: string;
  }>;
};

const getRpc = async (baseUrl: string, apiKey: string, chainId: number) => {
  const response = await fetch(`${baseUrl}/admin/rpc/${chainId}`, {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
    },
  });
  if (!response.ok) {
    return null;
  }
  return response.json() as Promise<{
    rpcUrl: string;
  } | null>;
};

const listRpc = async (baseUrl: string, apiKey: string) => {
  const response = await fetch(`${baseUrl}/admin/rpc`, {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
    },
  });
  if (!response.ok) {
    return [];
  }
  return response.json() as Promise<RpcConfig[]>;
};

const clearProvider = async (baseUrl: string, apiKey: string) => {
  const response = await fetch(`${baseUrl}/admin/rpc`, {
    method: 'DELETE',
    headers: {
      'x-api-key': apiKey,
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to clear provider: ${response.statusText}`);
  }
  return response.json() as Promise<{
    message: string;
  }>;
};

export default function RpcPage() {
  const { config } = useConfig();

  // State for form inputs
  const [chainId, setChainId] = createSignal('');
  const [rpcUrl, setRpcUrl] = createSignal('');
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [successMessage, setSuccessMessage] = createSignal('');
  const [errorMessage, setErrorMessage] = createSignal('');
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);

  // Resource to fetch RPC list
  const [rpcList, { refetch }] = createResource(
    () => ({ baseUrl: config.baseUrl, apiKey: config.apiKey }),
    async ({ baseUrl, apiKey }) => {
      if (!baseUrl || !apiKey) return [];
      return listRpc(baseUrl, apiKey);
    }
  );

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    const chain = chainId().trim();
    const url = rpcUrl().trim();

    if (!chain || !url) {
      setErrorMessage('Please fill in all fields');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await setRpc(config.baseUrl, config.apiKey, {
        chainId: chain,
        rpcUrl: url,
      });

      setSuccessMessage('RPC configuration saved successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);

      // Clear form
      setChainId('');
      setRpcUrl('');

      // Refetch the list
      refetch();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save RPC configuration');
      setTimeout(() => setErrorMessage(''), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearAll = async () => {
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await clearProvider(config.baseUrl, config.apiKey);
      setSuccessMessage('All RPC configurations cleared successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      setShowDeleteConfirm(false);
      refetch();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to clear RPC configurations'
      );
      setTimeout(() => setErrorMessage(''), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const truncateUrl = (url: string) => {
    if (url.length <= 50) return url;
    return `${url.slice(0, 25)}...${url.slice(-22)}`;
  };

  return (
    <div class="max-w-6xl mx-auto p-6 space-y-8">
      {/* Success Toast */}
      <Show when={successMessage()}>
        <div class="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in flex items-center gap-2">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clip-rule="evenodd"
            />
          </svg>
          {successMessage()}
        </div>
      </Show>

      {/* Error Toast */}
      <Show when={errorMessage()}>
        <div class="fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in flex items-center gap-2">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clip-rule="evenodd"
            />
          </svg>
          {errorMessage()}
        </div>
      </Show>

      {/* Delete Confirmation Modal */}
      <Show when={showDeleteConfirm()}>
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">Clear All RPC Configurations</h3>
            <p class="text-gray-600 mb-6">
              Are you sure you want to clear all RPC configurations? This action cannot be undone.
            </p>
            <div class="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                disabled={isSubmitting()}
                class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400 rounded-lg transition-colors"
              >
                {isSubmitting() ? 'Clearing...' : 'Clear All'}
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">RPC Configuration</h1>
          <p class="mt-2 text-gray-600">Manage RPC endpoints for different chains</p>
        </div>
        <button
          onClick={() => refetch()}
          class="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>

      {/* Info Hint */}
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
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
            <p class="text-sm text-blue-900">
              Configure RPC endpoints for different blockchain networks. Each chain requires its own
              RPC URL to enable transaction processing and blockchain interaction.
            </p>
          </div>
        </div>
      </div>

      {/* Add RPC Form */}
      <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        <h2 class="text-xl font-semibold text-gray-900 mb-4">Add RPC Configuration</h2>
        <form onSubmit={handleSubmit} class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="chainId" class="block text-sm font-medium text-gray-700 mb-2">
                Chain ID
              </label>
              <input
                id="chainId"
                type="text"
                value={chainId()}
                onInput={(e) => setChainId(e.currentTarget.value)}
                placeholder="e.g., 1, 137, 8453"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label for="rpcUrl" class="block text-sm font-medium text-gray-700 mb-2">
                RPC URL
              </label>
              <input
                id="rpcUrl"
                type="text"
                value={rpcUrl()}
                onInput={(e) => setRpcUrl(e.currentTarget.value)}
                placeholder="e.g., https://eth-mainnet.g.alchemy.com/v2/..."
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div class="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting()}
              class="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex items-center gap-2"
            >
              <Show when={isSubmitting()}>
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
              {isSubmitting() ? 'Saving...' : 'Add RPC'}
            </button>
          </div>
        </form>
      </div>

      {/* RPC List */}
      <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-semibold text-gray-900">Configured RPCs</h2>
          <Show when={rpcList() && rpcList()!.length > 0}>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              class="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Clear All
            </button>
          </Show>
        </div>

        <Suspense fallback={<LoadingSpinner />}>
          <Show when={rpcList()} fallback={<LoadingSpinner />}>
            <Show when={rpcList()!.length > 0} fallback={<EmptyState />}>
              <div class="space-y-3">
                <For each={rpcList()}>
                  {(rpc) => <RpcCard rpc={rpc} truncateUrl={truncateUrl} />}
                </For>
              </div>
            </Show>
          </Show>
        </Suspense>
      </div>
    </div>
  );
}

// RPC Card Component
function RpcCard(props: { rpc: RpcConfig; truncateUrl: (url: string) => string }) {
  const [copied, setCopied] = createSignal(false);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1 space-y-3">
          {/* Chain ID */}
          <div>
            <label class="text-xs font-medium text-gray-500 block mb-1">Chain ID</label>
            <span class="text-lg font-semibold text-gray-900">{props.rpc.chainId}</span>
          </div>

          {/* RPC URL */}
          <div>
            <label class="text-xs font-medium text-gray-500 block mb-1">RPC URL</label>
            <div class="flex items-center gap-2">
              <span class="font-mono text-sm text-gray-700 break-all">
                {props.truncateUrl(props.rpc.rpcUrl)}
              </span>
              <button
                onClick={() => copyToClipboard(props.rpc.rpcUrl)}
                class="text-blue-600 hover:text-blue-800 text-xs font-medium whitespace-nowrap"
              >
                {copied() ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Full URL (expandable) */}
          <details class="group">
            <summary class="text-xs font-medium text-blue-600 cursor-pointer hover:text-blue-800">
              Show full URL
            </summary>
            <div class="mt-2 font-mono text-xs text-gray-600 break-all bg-white p-3 rounded border border-gray-200">
              {props.rpc.rpcUrl}
            </div>
          </details>
        </div>

        {/* Chain Icon */}
        <div class="flex-shrink-0">
          <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
            {props.rpc.chainId.slice(0, 2)}
          </div>
        </div>
      </div>
    </div>
  );
}

// Loading Spinner Component
function LoadingSpinner() {
  return (
    <div class="flex items-center justify-center py-12">
      <svg
        class="animate-spin h-8 w-8 text-blue-600"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
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
    </div>
  );
}

// Empty State Component
function EmptyState() {
  return (
    <div class="text-center py-12">
      <svg
        class="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
        />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900">No RPC configurations</h3>
      <p class="mt-1 text-sm text-gray-500">Get started by adding an RPC endpoint above.</p>
    </div>
  );
}
