import {
  Accessor,
  createMemo,
  createResource,
  createSignal,
  Show,
  Suspense,
  useContext,
} from 'solid-js';
import { type AppConf, type Deployment } from '../../types';
import DistributorAbi from '../../abi/Distributor';
import { parseAbi, parseAbiItem, formatEther, maxUint256, formatUnits } from 'viem';
import { useConfig } from '../../hooks/useConfig';
import { useParams } from '@solidjs/router';
import { ClientContext } from '../../hooks/context/ClientContext';
import {
  fetchMaybeToken,
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
  fetchMaybeMint,
} from '@solana-program/token';
import {
  fetchMaybeMint as fetchMaybeMint2022,
  fetchMaybeToken as fetchMaybeToken2022,
  TOKEN_2022_PROGRAM_ADDRESS,
} from '@solana-program/token-2022';
import {
  address,
  assertAccountExists,
  fetchEncodedAccount,
  isSome,
  unwrapOption,
} from '@solana/kit';
import {
  fetchMerkleDistributor,
  getMerkleDistributorCodec,
  MERKLE_DISTRIBUTOR_PROGRAM_ADDRESS,
} from '../../generated/merkle_distributor';

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
  const clinetCtx = useContext(ClientContext);
  const client = createMemo(() => {
    return clinetCtx.getClient({
      chainId: props.deployment.chainId.toString(),
      rpcUrl: props.deployment.rpcUrl,
    });
  });
  const contractAddress = props.deployment.roles.contract;
  const projectAdmin = props.deployment.roles.projectAdmin as `0x${string}`;

  const { appId } = useParams();
  const { config } = useConfig();
  const baseUrl = () => config().baseUrl;
  const apiKey = () => config().apiKey;

  const [tokenAddr, { refetch: refetchTokenAddr }] = createResource(
    () => client(),
    async (client) => {
      if (client.chainId.startsWith('sol:')) {
        const distributorAccount = await fetchMerkleDistributor(
          client.asSolanaClient()!,
          address(contractAddress)
        );
        return distributorAccount.data.mint;
      } else {
        const tokenAddr = await client.asEvmClient()!.readContract({
          address: contractAddress as `0x${string}`,
          abi: DistributorAbi,
          functionName: 'token',
        });
        return tokenAddr;
      }
    }
  );

  const [tokenProgram] = createResource(
    () => {
      if (!client() || !tokenAddr()) return undefined;
      return {
        client: client()!,
        tokenAddr: tokenAddr()!,
      };
    },
    async ({ client, tokenAddr }) => {
      if (client.chainId.startsWith('sol:')) {
        const a = await fetchMaybeMint(client.asSolanaClient()!, address(tokenAddr));
        if (a.exists) {
          return a.programAddress;
        }
        return undefined;
      } else {
        return undefined;
      }
    }
  );

  const [tokenDecimals] = createResource(
    () => {
      if (!client() || !tokenAddr()) return undefined;
      return {
        client: client()!,
        tokenAddr: tokenAddr()!,
      };
    },
    async ({ client, tokenAddr }) => {
      if (client.chainId.startsWith('sol:')) {
        return 9;
      } else {
        const decimals = await client.asEvmClient()!.readContract({
          address: tokenAddr as `0x${string}`,
          abi: parseAbi(['function decimals() view returns (uint8)' as const]),
          functionName: 'decimals',
        });
        return decimals;
      }
    }
  );

  const [vault, { refetch: refetchVault }] = createResource(
    () => client(),
    async (client) => {
      if (client.chainId.startsWith('sol:')) {
        const distributorAccount = await fetchMerkleDistributor(
          client.asSolanaClient()!,
          address(contractAddress)
        );
        return distributorAccount.data.vault;
      } else {
        const vault = await client.asEvmClient()!.readContract({
          address: contractAddress as `0x${string}`,
          abi: DistributorAbi,
          functionName: 'vault',
        });
        return vault;
      }
    }
  );

  const [signer, { refetch: refetchSigner }] = createResource(
    () => client(),
    async (client) => {
      if (client.chainId.startsWith('sol:')) {
        return props.deployment.roles['signer'];
      } else {
        const signer = await client.asEvmClient()!.readContract({
          address: contractAddress as `0x${string}`,
          abi: DistributorAbi,
          functionName: 'signer',
        });
        return signer;
      }
    }
  );

  const [active, { refetch: refetchActive }] = createResource(
    () => client(),
    async (client) => {
      if (client.chainId.startsWith('sol:')) {
        const accountData = await fetchEncodedAccount(
          client.asSolanaClient()!,
          address(contractAddress)
        );
        if (!accountData.exists) {
          return false;
        }
        const codec = getMerkleDistributorCodec();
        const distributorData = codec.decode(accountData.data);
        return distributorData.active;
      } else {
        const active = await client.asEvmClient()!.readContract({
          address: contractAddress as `0x${string}`,
          abi: DistributorAbi,
          functionName: 'active',
        });
        return active;
      }
    }
  );

  const [allowance, { refetch: refetchAllowance }] = createResource(
    () => {
      if (!client() || !tokenAddr() || !vault()) return undefined;
      if (props.deployment.chainId.startsWith('sol:') && !tokenProgram()) {
        return undefined;
      }
      return {
        client: client()!,
        tokenAddr: tokenAddr() as `0x${string}`,
        vault: vault() as `0x${string}`,
        tokenProgram: tokenProgram(),
      };
    },
    async ({ client, tokenAddr, vault, tokenProgram }) => {
      if (client.chainId.startsWith('sol:')) {
        const vaultAta = await findAssociatedTokenPda({
          mint: address(tokenAddr),
          owner: address(vault),
          tokenProgram: tokenProgram!,
        });

        if (tokenProgram === TOKEN_PROGRAM_ADDRESS) {
          const tokenAccount = await fetchMaybeToken(client.asSolanaClient()!, vaultAta[0]);
          if (!tokenAccount.exists) {
            return 0n;
          }
          assertAccountExists(tokenAccount);
          if (
            isSome(tokenAccount.data.delegate) &&
            unwrapOption(tokenAccount.data.delegate) === address(contractAddress)
          ) {
            return tokenAccount.data.delegatedAmount;
          }
          return 0n;
        } else if (tokenProgram === TOKEN_2022_PROGRAM_ADDRESS) {
          const tokenAccount = await fetchMaybeToken2022(client.asSolanaClient()!, vaultAta[0]);
          if (!tokenAccount.exists) {
            return 0n;
          }
          assertAccountExists(tokenAccount);
          if (
            isSome(tokenAccount.data.delegate) &&
            unwrapOption(tokenAccount.data.delegate) === address(contractAddress)
          ) {
            return tokenAccount.data.delegatedAmount;
          }
          return 0n;
        }
      } else {
        const allowance = await client.asEvmClient()!.readContract({
          address: tokenAddr as `0x${string}`,
          abi: parseAbi([
            'function allowance(address owner, address spender) view returns (uint256)' as const,
          ]),
          functionName: 'allowance',
          args: [vault as `0x${string}`, contractAddress as `0x${string}`],
        });
        return allowance;
      }
    }
  );

  const [balance, { refetch: refetchBalance }] = createResource(
    () => {
      if (!client() || !tokenAddr() || !vault()) return undefined;
      if (props.deployment.chainId.startsWith('sol:') && !tokenProgram()) {
        return undefined;
      }
      return {
        client: client()!,
        tokenAddr: tokenAddr()!,
        vault: vault()!,
        tokenProgram: tokenProgram(),
      };
    },
    async ({ client, tokenAddr, vault, tokenProgram }) => {
      if (client.chainId.startsWith('sol:')) {
        const vaultAta = await findAssociatedTokenPda({
          mint: address(tokenAddr),
          owner: address(vault),
          tokenProgram: tokenProgram!,
        });

        if (tokenProgram === TOKEN_PROGRAM_ADDRESS) {
          const tokenAccount = await fetchMaybeToken(client.asSolanaClient()!, vaultAta[0]);
          if (!tokenAccount.exists) {
            return 0n;
          }
          assertAccountExists(tokenAccount);
          return tokenAccount.data.amount;
        } else if (tokenProgram === TOKEN_2022_PROGRAM_ADDRESS) {
          const tokenAccount = await fetchMaybeToken2022(client.asSolanaClient()!, vaultAta[0]);
          if (!tokenAccount.exists) {
            return 0n;
          }
          assertAccountExists(tokenAccount);
          return tokenAccount.data.amount;
        }
        return 0n;
      } else {
        const balance = await client.asEvmClient()!.readContract({
          address: tokenAddr as `0x${string}`,
          abi: parseAbi(['function balanceOf(address owner) view returns (uint256)' as const]),
          functionName: 'balanceOf',
          args: [vault as `0x${string}`],
        });
        return balance;
      }
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

  const formatAllowance = (allowance: bigint | undefined, decimals: number) => {
    if (!allowance) {
      return '0';
    }
    if (allowance === maxUint256) {
      return 'Unlimited';
    }
    return formatUnits(allowance, decimals);
  };

  const formatAllowanceWei = (allowance: bigint | undefined) => {
    if (!allowance) {
      return '0';
    }
    if (allowance === maxUint256) {
      return 'Unlimited';
    }
    return allowance.toString();
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
            <Suspense fallback={<LoadingText />}>
              <div class="space-y-1">
                <div class="text-2xl font-bold text-gray-900">
                  {balance() ? formatUnits(balance() as bigint, tokenDecimals()!) : '0'}
                </div>
                <div class="text-xs text-gray-500">{balance()?.toString() || '0'} wei</div>
              </div>
            </Suspense>
          </InfoCard>

          {/* Allowance Card */}
          <InfoCard title="Vault Allowance">
            <Suspense fallback={<LoadingText />}>
              <div class="space-y-1">
                <div class="text-2xl font-bold text-gray-900">
                  {formatAllowance(allowance(), tokenDecimals()!)}
                </div>
                <div class="text-xs text-gray-500">{formatAllowanceWei(allowance())} wei</div>
              </div>
            </Suspense>
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
