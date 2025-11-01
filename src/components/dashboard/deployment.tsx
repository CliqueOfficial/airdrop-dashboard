import { createResource, createSignal, Show, Suspense } from 'solid-js';
import { type AppConf, type Deployment } from '../../types';
import { createPublicClient } from '../../util';
import DistributorAbi from '../../abi/Distributor';
import { parseAbi, parseAbiItem, formatEther } from 'viem';
import { useConfig } from '../../hooks/useConfig';
import { useParams } from '@solidjs/router';

interface DeploymentProps {
  name: string;
  deployment: Deployment;
}

const pause = async (
  baseUrl: string,
  apiKey: string,
  appId: string,
  deployment: string,
  projectAdmin: string
) => {
  const response = await fetch(`${baseUrl}/admin/relay/distributor/pause`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      appId,
      deployment,
      projectAdmin,
    }),
  });
  if (!response.ok) {
    throw new Error('Failed to pause distributor');
  }
  return response.json() as Promise<{
    txHash: string;
  }>;
};

const unpause = async (
  baseUrl: string,
  apiKey: string,
  appId: string,
  deployment: string,
  projectAdmin: string
) => {
  const response = await fetch(`${baseUrl}/admin/relay/distributor/unpause`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      appId,
      deployment,
      projectAdmin,
    }),
  });
  if (!response.ok) {
    throw new Error('Failed to unpause distributor');
  }
  return response.json() as Promise<{
    txHash: string;
  }>;
};

export default function Deployment(props: DeploymentProps) {
  const client = createPublicClient(props.deployment.chainId, props.deployment.rpcUrl)!;
  const contractAddress = props.deployment.roles.contract as `0x${string}`;
  const projectAdmin = props.deployment.roles.projectAdmin as `0x${string}`;

  const { appId } = useParams();
  const { config } = useConfig();
  const baseUrl = () => config.baseUrl;
  const apiKey = () => config.apiKey;

  const [tokenAddr, { refetch: refetchTokenAddr }] = createResource([], async () => {
    const tokenAddr = await client.readContract({
      address: contractAddress,
      abi: DistributorAbi,
      functionName: 'token',
    });
    return tokenAddr;
  });

  const [vault, { refetch: refetchVault }] = createResource([], async () => {
    const vault = await client.readContract({
      address: contractAddress,
      abi: DistributorAbi,
      functionName: 'vault',
    });
    return vault;
  });

  const [signer, { refetch: refetchSigner }] = createResource([], async () => {
    const signer = await client.readContract({
      address: contractAddress,
      abi: DistributorAbi,
      functionName: 'signer',
    });
    return signer;
  });

  const [active, { refetch: refetchActive }] = createResource([], async () => {
    const active = await client.readContract({
      address: contractAddress,
      abi: DistributorAbi,
      functionName: 'active',
    });
    return active;
  });

  const [allowance, { refetch: refetchAllowance }] = createResource(
    () => ({ tokenAddr: tokenAddr(), vault: vault() }),
    async ({ tokenAddr, vault }) => {
      if (!tokenAddr || !vault) return 0n;
      const allowance = await client.readContract({
        address: tokenAddr as `0x${string}`,
        abi: parseAbi([
          'function allowance(address owner, address spender) view returns (uint256)' as const,
        ]),
        functionName: 'allowance',
        args: [vault as `0x${string}`, contractAddress],
      });
      return allowance;
    }
  );

  const [balance, { refetch: refetchBalance }] = createResource(
    () => ({ tokenAddr: tokenAddr(), vault: vault() }),
    async ({ tokenAddr, vault }) => {
      if (!tokenAddr || !vault) return 0n;
      const balance = await client.readContract({
        address: tokenAddr as `0x${string}`,
        abi: parseAbi(['function balanceOf(address owner) view returns (uint256)' as const]),
        functionName: 'balanceOf',
        args: [vault as `0x${string}`],
      });
      return balance;
    }
  );

  // Helper function to truncate address
  const truncateAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Helper to copy to clipboard
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

  // Toggle active state
  const [isToggling, setIsToggling] = createSignal(false);
  const handleToggleActive = async (checked: boolean) => {
    const currentBaseUrl = baseUrl();
    const currentApiKey = apiKey();

    if (!currentBaseUrl || !currentApiKey || !appId) {
      console.error('Missing configuration: baseUrl, apiKey, or appId');
      return;
    }

    setIsToggling(true);
    try {
      if (checked) {
        await unpause(currentBaseUrl, currentApiKey, appId, props.name, projectAdmin);
      } else {
        await pause(currentBaseUrl, currentApiKey, appId, props.name, projectAdmin);
      }
      // Refetch active state after toggle
      await refetchActive();
    } catch (error) {
      console.error('Failed to toggle contract status:', error);
      // Revert the UI state on error
      await refetchActive();
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div class="space-y-6 mb-8">
      {/* Copy Success Toast */}
      <Show when={copied()}>
        <div class="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in">
          ✓ Copied to clipboard!
        </div>
      </Show>

      {/* Deployment Header */}
      <div class="border-b pb-4">
        <div class="flex items-center gap-3 mb-2">
          <h3 class="text-2xl font-bold text-gray-900">{props.name}</h3>
          <span class="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
            Chain {props.deployment.chainId}
          </span>
        </div>
        <p class="text-sm text-gray-500 mt-1">
          Contract: <span class="font-mono">{truncateAddress(contractAddress)}</span>
          <button
            onClick={() => copyToClipboard(contractAddress)}
            class="ml-2 text-blue-600 hover:text-blue-800 text-xs"
          >
            Copy
          </button>
        </p>
      </div>

      <Suspense fallback={<LoadingSpinner />}>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Status Card */}
          <InfoCard title="Contract Status">
            <div class="space-y-4">
              <div class="flex items-center gap-3">
                <div class={`w-3 h-3 rounded-full ${active() ? 'bg-green-500' : 'bg-red-500'}`} />
                <span class="text-lg font-semibold">{active() ? 'Active' : 'Inactive'}</span>
              </div>
              <div class="flex items-center justify-between pt-2 border-t border-gray-100">
                <span class="text-sm text-gray-600">Toggle Status</span>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={active()}
                    onChange={(e) => handleToggleActive(e.currentTarget.checked)}
                    disabled={active.loading || isToggling()}
                    class="sr-only peer"
                  />
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
                </label>
              </div>
              <Show when={isToggling()}>
                <div class="text-xs text-gray-500 flex items-center gap-2">
                  <svg
                    class="animate-spin h-3 w-3"
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
                  Updating...
                </div>
              </Show>
            </div>
          </InfoCard>

          {/* Token Address Card */}
          <InfoCard title="Token Address">
            <Show when={tokenAddr()} fallback={<LoadingText />}>
              <div class="space-y-2">
                <div class="font-mono text-sm break-all">{tokenAddr()}</div>
                <button
                  onClick={() => copyToClipboard(tokenAddr() as string)}
                  class="text-xs text-blue-600 hover:text-blue-800"
                >
                  Copy Address
                </button>
              </div>
            </Show>
          </InfoCard>

          {/* Signer Card */}
          <InfoCard title="Signer">
            <Show when={signer()} fallback={<LoadingText />}>
              <div class="space-y-2">
                <div class="font-mono text-sm break-all">{signer()}</div>
                <button
                  onClick={() => copyToClipboard(signer() as string)}
                  class="text-xs text-blue-600 hover:text-blue-800"
                >
                  Copy Address
                </button>
              </div>
            </Show>
          </InfoCard>

          {/* Vault Card */}
          <InfoCard title="Vault">
            <Show when={vault()} fallback={<LoadingText />}>
              <div class="space-y-2">
                <div class="font-mono text-sm break-all">{vault()}</div>
                <button
                  onClick={() => copyToClipboard(vault() as string)}
                  class="text-xs text-blue-600 hover:text-blue-800"
                >
                  Copy Address
                </button>
              </div>
            </Show>
          </InfoCard>

          {/* Balance Card */}
          <InfoCard title="Vault Balance">
            <Show when={balance() !== undefined} fallback={<LoadingText />}>
              <div class="space-y-1">
                <div class="text-2xl font-bold text-gray-900">
                  {balance() ? formatEther(balance() as bigint) : '0'}
                </div>
                <div class="text-xs text-gray-500">{balance()?.toString() || '0'} wei</div>
              </div>
            </Show>
          </InfoCard>

          {/* Allowance Card */}
          <InfoCard title="Vault Allowance">
            <Show when={allowance() !== undefined} fallback={<LoadingText />}>
              <div class="space-y-1">
                <div class="text-2xl font-bold text-gray-900">
                  {allowance() ? formatEther(allowance() as bigint) : '0'}
                </div>
                <div class="text-xs text-gray-500">{allowance()?.toString() || '0'} wei</div>
              </div>
            </Show>
          </InfoCard>
        </div>

        {/* Roles Section */}
        <div class="mt-6">
          <h4 class="text-lg font-semibold text-gray-900 mb-4">Roles</h4>
          <div class="bg-gray-50 rounded-lg p-4 space-y-3">
            {Object.entries(props.deployment.roles).map(([role, address]) => (
              <div class="flex items-center justify-between py-2 border-b border-gray-200 last:border-b-0">
                <span class="text-sm font-medium text-gray-700 capitalize">
                  {role.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <div class="flex items-center gap-2">
                  <span class="font-mono text-sm text-gray-600">
                    {truncateAddress(address as string)}
                  </span>
                  <button
                    onClick={() => copyToClipboard(address as string)}
                    class="text-blue-600 hover:text-blue-800 text-xs"
                  >
                    Copy
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RPC URL Section */}
        <div class="mt-6">
          <h4 class="text-lg font-semibold text-gray-900 mb-4">Network Configuration</h4>
          <div class="bg-gray-50 rounded-lg p-4">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <span class="text-sm font-medium text-gray-700 block mb-2">RPC URL</span>
                <span class="font-mono text-sm text-gray-600 break-all">
                  {props.deployment.rpcUrl}
                </span>
              </div>
              <button
                onClick={() => copyToClipboard(props.deployment.rpcUrl)}
                class="ml-4 text-blue-600 hover:text-blue-800 text-xs whitespace-nowrap"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      </Suspense>
    </div>
  );
}

// Info Card Component
function InfoCard(props: { title: string; children: any }) {
  return (
    <div class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      <h5 class="text-sm font-medium text-gray-500 mb-3">{props.title}</h5>
      <div>{props.children}</div>
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

// Loading Text Component
function LoadingText() {
  return (
    <div class="flex items-center gap-2">
      <svg
        class="animate-spin h-4 w-4 text-gray-400"
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
      <span class="text-sm text-gray-400">Loading...</span>
    </div>
  );
}
