import { createSignal, createResource, For, Show } from 'solid-js';
import { useConfig } from '../../hooks/useConfig';
import { AppConf } from '../../hooks/useAppConf';
import { SetStoreFunction } from 'solid-js/store';

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

const generateRelayer = async (
  appId: string,
  chainId: number,
  online: boolean,
  baseUrl: string,
  apiKey: string
) => {
  const response = await fetch(`${baseUrl}/admin/relayer/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      appId,
      chainId,
      online,
    }),
  });
  return response.json() as Promise<{
    address: string;
    chainId: string;
    nonce: string;
    online: boolean;
  }>;
};

interface RelayerStepProps {
  appConf: AppConf;
  setAppConf: SetStoreFunction<AppConf>;
}

export default function RelayerStep(props: RelayerStepProps) {
  const { config } = useConfig();
  const [chainId, setChainId] = createSignal('');
  const [online, setOnline] = createSignal(true);
  const [isCreating, setIsCreating] = createSignal(false);
  const [createError, setCreateError] = createSignal<string | null>(null);
  const [createSuccess, setCreateSuccess] = createSignal(false);

  const [relayers, { refetch }] = createResource(
    () => ({ appId: props.appConf.appId, baseUrl: config.baseUrl, apiKey: config.apiKey }),
    async ({ appId, baseUrl, apiKey }) => {
      if (!appId) {
        console.log('No appId provided');
        return [];
      }
      console.log('Fetching relayers for appId:', appId);
      try {
        const result = await listRelayer(appId, baseUrl, apiKey);
        console.log('Relayers fetched:', result);
        return result;
      } catch (error) {
        console.error('Error fetching relayers:', error);
        throw error;
      }
    }
  );

  const handleCreateRelayer = async () => {
    if (!chainId()) {
      setCreateError('Chain ID is required');
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    setCreateSuccess(false);

    try {
      const chainIdNum = parseInt(chainId());
      if (isNaN(chainIdNum)) {
        throw new Error('Chain ID must be a number');
      }

      await generateRelayer(
        props.appConf.appId,
        chainIdNum,
        online(),
        config.baseUrl,
        config.apiKey
      );

      setCreateSuccess(true);
      setChainId('');
      setOnline(true);

      // Refresh the relayer list
      await refetch();

      // Hide success message after 3 seconds
      setTimeout(() => setCreateSuccess(false), 3000);
    } catch (error) {
      console.error('Error creating relayer:', error);
      setCreateError(error instanceof Error ? error.message : 'Failed to create relayer');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div class="space-y-6">
      {/* Success Message */}
      <Show when={createSuccess()}>
        <div class="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div class="flex items-center gap-2 text-green-800">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clip-rule="evenodd"
              />
            </svg>
            <span class="font-medium">Relayer created successfully!</span>
          </div>
        </div>
      </Show>

      {/* Error Message */}
      <Show when={createError()}>
        <div class="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div class="flex items-center gap-2 text-red-800">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clip-rule="evenodd"
              />
            </svg>
            <span class="font-medium">{createError()}</span>
          </div>
        </div>
      </Show>

      {/* Existing Relayers Summary */}
      <Show when={!relayers.loading && relayers() && relayers()!.length > 0}>
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-blue-800">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fill-rule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clip-rule="evenodd"
                />
              </svg>
              <span class="font-medium">
                {relayers()!.length} relayer{relayers()!.length > 1 ? 's' : ''} already configured
              </span>
            </div>
          </div>
        </div>
      </Show>

      {/* Create Form */}
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Chain ID *</label>
          <input
            type="number"
            value={chainId()}
            onInput={(e) => setChainId(e.currentTarget.value)}
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g. 1 for Ethereum, 137 for Polygon"
            disabled={isCreating()}
          />
        </div>

        <div class="flex items-center gap-3">
          <input
            type="checkbox"
            id="online"
            checked={online()}
            onChange={(e) => setOnline(e.currentTarget.checked)}
            class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            disabled={isCreating()}
          />
          <label for="online" class="text-sm font-medium text-gray-700">
            Set relayer as online
          </label>
        </div>

        <button
          onClick={handleCreateRelayer}
          disabled={isCreating() || !chainId()}
          class={`w-full px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
            isCreating() || !chainId()
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          <Show when={isCreating()}>
            <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
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
          {isCreating() ? 'Creating...' : 'Add Relayer'}
        </button>
      </div>

      {/* Relayers List */}
      <Show when={!relayers.loading && relayers() && relayers()!.length > 0}>
        <div class="border-t pt-6">
          <h4 class="text-sm font-medium text-gray-700 mb-3">Configured Relayers</h4>
          <div class="space-y-2">
            <For each={relayers()}>
              {(relayer) => (
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div class="flex items-center gap-3">
                    <span
                      class={`w-2 h-2 rounded-full ${relayer.online ? 'bg-green-500' : 'bg-gray-400'}`}
                    ></span>
                    <div>
                      <p class="text-sm font-mono text-gray-900">{relayer.address}</p>
                      <p class="text-xs text-gray-500">Chain {relayer.chain_id}</p>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}
