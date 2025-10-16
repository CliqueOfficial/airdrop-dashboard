import { createSignal, createEffect, onCleanup, Show, For } from 'solid-js';
import {
  connect,
  disconnect,
  getAccount,
  watchAccount,
  getConnectors,
  switchChain,
  getChainId,
} from '@wagmi/core';
import { config } from '../config';

export default function WalletConnect() {
  const [account, setAccount] = createSignal(getAccount(config));
  const [isConnecting, setIsConnecting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [showConnectors, setShowConnectors] = createSignal(false);
  const [currentChainId, setCurrentChainId] = createSignal(getChainId(config));

  // 监听账户变化
  createEffect(() => {
    const unwatch = watchAccount(config, {
      onChange(account) {
        setAccount(account);
        setCurrentChainId(getChainId(config));
      },
    });

    onCleanup(() => {
      unwatch();
    });
  });

  const handleConnect = async (connectorId: string) => {
    try {
      setIsConnecting(true);
      setError(null);
      const connectors = getConnectors(config);
      const connector = connectors.find((c) => c.id === connectorId);

      if (!connector) {
        throw new Error('Connector not found');
      }

      await connect(config, { connector });
      setShowConnectors(false);
    } catch (err) {
      console.error('Failed to connect:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect(config);
      setError(null);
    } catch (err) {
      console.error('Failed to disconnect:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  };

  const handleSwitchChain = async (chainId: number) => {
    try {
      await switchChain(config, { chainId: chainId as any });
      setCurrentChainId(getChainId(config));
    } catch (err) {
      console.error('Failed to switch chain:', err);
      setError(err instanceof Error ? err.message : 'Failed to switch chain');
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getChainName = (chainId: number) => {
    const chains: Record<number, string> = {
      1: 'Ethereum',
      11155111: 'Sepolia',
      137: 'Polygon',
      42161: 'Arbitrum',
    };
    return chains[chainId] || `Chain ${chainId}`;
  };

  return (
    <div class="relative">
      <Show
        when={account().status === 'connected'}
        fallback={
          <div>
            <button
              onClick={() => setShowConnectors(!showConnectors())}
              disabled={isConnecting()}
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isConnecting() ? 'Connecting...' : 'Connect Wallet'}
            </button>

            <Show when={showConnectors()}>
              <div class="absolute top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-[200px] z-10">
                <h3 class="text-sm font-semibold mb-2 text-gray-700">Select Wallet</h3>
                <For each={getConnectors(config)}>
                  {(connector) => (
                    <button
                      onClick={() => handleConnect(connector.id)}
                      class="w-full text-left px-3 py-2 hover:bg-gray-100 rounded transition-colors text-gray-700"
                      disabled={isConnecting()}
                    >
                      {connector.name}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        }
      >
        <div class="flex items-center gap-3">
          {/* Chain Selector */}
          <select
            value={currentChainId()}
            onChange={(e) => handleSwitchChain(Number(e.currentTarget.value))}
            class="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <For each={config.chains}>
              {(chain) => <option value={chain.id}>{chain.name}</option>}
            </For>
          </select>

          {/* Account Info */}
          <div class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg flex items-center gap-2">
            <div class="w-2 h-2 bg-green-500 rounded-full"></div>
            <span class="text-sm font-medium">{formatAddress(account().address!)}</span>
          </div>

          {/* Disconnect Button */}
          <button
            onClick={handleDisconnect}
            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
          >
            Disconnect
          </button>
        </div>
      </Show>

      {/* Error Message */}
      <Show when={error()}>
        <div class="absolute top-full mt-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm max-w-md">
          {error()}
        </div>
      </Show>
    </div>
  );
}
