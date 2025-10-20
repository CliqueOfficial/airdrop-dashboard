import { useRelayers } from '../../hooks/useRelayers';
import { For, Show, Suspense, createSignal } from 'solid-js';
import { Relayer } from '../../types';

interface RelayersProps {
  appId: string;
}

export default function Relayers(props: RelayersProps) {
  const { appId } = props;
  const { relayers, refetch: refetchRelayers } = useRelayers(appId);

  const [copied, setCopied] = createSignal(false);

  // Helper to truncate address
  const truncateAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Helper to copy to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Group relayers by chain ID
  const relayersByChain = () => {
    const relayersList = relayers();
    if (!relayersList) return {};

    return relayersList.reduce(
      (acc, relayer) => {
        if (!acc[relayer.chainId]) {
          acc[relayer.chainId] = [];
        }
        acc[relayer.chainId].push(relayer);
        return acc;
      },
      {} as Record<string, Relayer[]>
    );
  };

  return (
    <div class="space-y-6">
      {/* Copy Success Toast */}
      <Show when={copied()}>
        <div class="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in">
          ✓ Copied to clipboard!
        </div>
      </Show>

      <div class="flex items-center justify-between mb-4">
        <h2 class="text-2xl font-bold text-gray-900">Relayers</h2>
        <button
          onClick={() => refetchRelayers()}
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
      <div class="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
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
              <span class="font-semibold">Online</span> relayers act as paymasters to support
              gasless transactions for users.
              <span class="font-semibold">Offline</span> relayers are not available to users and
              will not process transactions.
            </p>
          </div>
        </div>
      </div>

      <Suspense fallback={<LoadingSpinner />}>
        <Show when={relayers()} fallback={<EmptyState />}>
          <Show when={relayers()!.length > 0} fallback={<EmptyState />}>
            {/* Summary Cards */}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <SummaryCard title="Total Relayers" value={relayers()!.length.toString()} icon="📊" />
              <SummaryCard
                title="Online Relayers"
                value={relayers()!
                  .filter((r) => r.online)
                  .length.toString()}
                icon="✅"
                color="green"
              />
              <SummaryCard
                title="Offline Relayers"
                value={relayers()!
                  .filter((r) => !r.online)
                  .length.toString()}
                icon="⏸️"
                color="gray"
              />
            </div>

            {/* Relayers grouped by chain */}
            <For each={Object.entries(relayersByChain())}>
              {([chainId, chainRelayers]) => (
                <div class="mb-6">
                  <div class="flex items-center gap-2 mb-4">
                    <h3 class="text-lg font-semibold text-gray-900">Chain {chainId}</h3>
                    <span class="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                      {chainRelayers.length} relayer{chainRelayers.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div class="space-y-3">
                    <For each={chainRelayers}>
                      {(relayer) => (
                        <RelayerCard
                          relayer={relayer}
                          onCopy={copyToClipboard}
                          truncateAddress={truncateAddress}
                        />
                      )}
                    </For>
                  </div>
                </div>
              )}
            </For>
          </Show>
        </Show>
      </Suspense>
    </div>
  );
}

// Relayer Card Component
function RelayerCard(props: {
  relayer: Relayer;
  onCopy: (text: string) => void;
  truncateAddress: (addr: string) => string;
}) {
  return (
    <div class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2">
          <div
            class={`w-3 h-3 rounded-full ${props.relayer.online ? 'bg-green-500' : 'bg-gray-400'}`}
          />
          <span
            class={`text-sm font-medium ${props.relayer.online ? 'text-green-700' : 'text-gray-600'}`}
          >
            {props.relayer.online ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      <div class="space-y-3">
        {/* Address */}
        <div>
          <label class="text-xs font-medium text-gray-500 block mb-1">Address</label>
          <div class="flex items-center justify-between">
            <span class="font-mono text-sm text-gray-900">
              {props.truncateAddress(props.relayer.address)}
            </span>
            <button
              onClick={() => props.onCopy(props.relayer.address)}
              class="text-blue-600 hover:text-blue-800 text-xs"
            >
              Copy
            </button>
          </div>
        </div>

        {/* Full Address (expandable) */}
        <div>
          <label class="text-xs font-medium text-gray-500 block mb-1">Full Address</label>
          <div class="font-mono text-xs text-gray-600 break-all bg-gray-50 p-2 rounded">
            {props.relayer.address}
          </div>
        </div>

        {/* Nonce */}
        <div>
          <label class="text-xs font-medium text-gray-500 block mb-1">Nonce</label>
          <span class="text-sm text-gray-900 font-medium">{props.relayer.nonce}</span>
        </div>
      </div>
    </div>
  );
}

// Summary Card Component
function SummaryCard(props: {
  title: string;
  value: string;
  icon: string;
  color?: 'green' | 'red' | 'blue' | 'gray';
}) {
  const bgColor = () => {
    switch (props.color) {
      case 'green':
        return 'bg-green-50 border-green-200';
      case 'red':
        return 'bg-red-50 border-red-200';
      case 'gray':
        return 'bg-gray-50 border-gray-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  const textColor = () => {
    switch (props.color) {
      case 'green':
        return 'text-green-900';
      case 'red':
        return 'text-red-900';
      case 'gray':
        return 'text-gray-900';
      default:
        return 'text-blue-900';
    }
  };

  return (
    <div class={`${bgColor()} border rounded-lg p-4`}>
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-gray-600">{props.title}</p>
          <p class={`text-2xl font-bold ${textColor()} mt-1`}>{props.value}</p>
        </div>
        <div class="text-3xl">{props.icon}</div>
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
          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
        />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900">No relayers</h3>
      <p class="mt-1 text-sm text-gray-500">No relayers have been configured for this app yet.</p>
    </div>
  );
}
