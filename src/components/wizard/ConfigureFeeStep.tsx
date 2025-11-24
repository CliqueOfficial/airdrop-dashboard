import {
  createMemo,
  createResource,
  createSignal,
  For,
  Show,
  Suspense,
  useContext,
} from 'solid-js';
import { AppConf, Deployment } from '../../types';
import TabView from '../TabView';
import { useConfig } from '../../hooks/useConfig';
import DistributorAbi from '../../abi/Distributor';
import { keccak256, PublicClient, toBytes } from 'viem';
import { AppConfContext } from '../../hooks/context/AppConf';
import { ClientContext, GeneralClient } from '../../hooks/context/ClientContext';
import {
  address,
  assertAccountExists,
  getAddressEncoder,
  getArrayEncoder,
  getBytesEncoder,
  getProgramDerivedAddress,
  signature,
} from '@solana/kit';
import { getBytecode } from '@wagmi/core';
import {
  fetchAllClaimRoot,
  fetchAllMaybeClaimRoot,
  fetchMaybeFeeConfig,
  MERKLE_DISTRIBUTOR_PROGRAM_ADDRESS,
} from '../../generated/merkle_distributor';
import { expectAddress, expectSome } from '../../generated/merkle_distributor/shared';

interface SetFeeRequest {
  appId: string;
  deployment: string;
  projectAdmin: string;
  batchRoot: `0x${string}`;
  feeMode:
    | {
        fixedFee: string;
      }
    | {
        singleTierFeeRate: {
          feeRate: string;
          maxFee: string;
          minFee: string;
        };
      }
    | 'default';
}

const setFee = async (baseUrl: string, apiKey: string, req: SetFeeRequest) => {
  const response = await fetch(`${baseUrl}/admin/relay/distributor/set-fee`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    throw new Error(`Failed to set fee: ${await response.text()}`);
  }

  return response.json() as Promise<{ txHash: string }>;
};

type FeeInfo =
  | { feeMode: 'Default' }
  | { feeMode: 'FixedFee'; data: string }
  | { feeMode: 'SingleTierFeeRate'; data: { feeRate: string; minFee: string; maxFee: string } };

const readFee = async (
  client: GeneralClient,
  contractAddress: string,
  root: `0x${string}`
): Promise<FeeInfo> => {
  if (client.chainId.startsWith('sol:')) {
    const [pda, _] = await getProgramDerivedAddress({
      programAddress: MERKLE_DISTRIBUTOR_PROGRAM_ADDRESS,
      seeds: [
        getBytesEncoder().encode(new Uint8Array([70, 101, 101, 67, 111, 110, 102, 105, 103])),
        getAddressEncoder().encode(expectAddress(address(contractAddress))),
        getBytesEncoder().encode(toBytes(keccak256(toBytes('default')))),
      ],
    });
    const feeConfig = await fetchMaybeFeeConfig(client.asSolanaClient()!, address(pda));
    if (!feeConfig.exists) {
      return {
        feeMode: 'Default',
      };
    } else {
      assertAccountExists(feeConfig);

      if (feeConfig.data.feeMode.__kind === 'Fixed') {
        return {
          feeMode: 'FixedFee',
          data: feeConfig.data.feeMode.fields[0].toString(),
        };
      } else if (feeConfig.data.feeMode.__kind === 'SingleTier') {
        return {
          feeMode: 'SingleTierFeeRate',
          data: {
            feeRate: feeConfig.data.feeMode.rate.toString(),
            minFee: feeConfig.data.feeMode.minFee.toString(),
            maxFee: feeConfig.data.feeMode.maxFee.toString(),
          },
        };
      } else {
        throw new Error('Invalid fee mode');
      }
    }
  } else {
    const feeModePromise = client.asEvmClient()!.readContract({
      address: contractAddress as `0x${string}`,
      abi: DistributorAbi,
      functionName: 'feeModes',
      args: [root],
    });
    const fixedFeePromise = client.asEvmClient()!.readContract({
      address: contractAddress as `0x${string}`,
      abi: DistributorAbi,
      functionName: 'fixedFees',
      args: [root],
    });
    const singleTierFeeRatePromise = client.asEvmClient()!.readContract({
      address: contractAddress as `0x${string}`,
      abi: DistributorAbi,
      functionName: 'singleTierFeeRates',
      args: [root],
    });

    const [feeMode, fixedFee, singleTierFeeRate] = await Promise.all([
      feeModePromise,
      fixedFeePromise,
      singleTierFeeRatePromise,
    ]);

    if (feeMode === 0) {
      return {
        feeMode: 'Default',
      };
    }

    if (feeMode === 1) {
      return {
        feeMode: 'FixedFee',
        data: fixedFee.toString(),
      };
    }

    if (feeMode === 2) {
      return {
        feeMode: 'SingleTierFeeRate',
        data: {
          feeRate: singleTierFeeRate[0].toString(),
          minFee: singleTierFeeRate[1].toString(),
          maxFee: singleTierFeeRate[2].toString(),
        },
      };
    }

    throw new Error('Invalid fee mode');
  }
};

export default function ConfigureFeeStep() {
  const { appConf, deployments, refetch } = useContext(AppConfContext)!;

  const tabs = () => {
    return Object.entries(deployments!()).map(([name, data]) => ({
      id: name,
      label: name,
      data: data,
    }));
  };

  return (
    <TabView tabs={tabs()}>
      {(tab) => (
        <div>
          <DeploymentConfigurationPanel
            appId={appConf.appId}
            name={tab.id}
            deployment={tab.data}
            roots={appConf.extra.root}
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
  roots: Record<string, string>;
}

function DeploymentConfigurationPanel(props: DeploymentConfigurationPanelProps) {
  const contractAddress = props.deployment.roles['contract'] as `0x${string}`;
  const clientCtx = useContext(ClientContext);
  const configurationIds = Object.keys(props.deployment.extra.configurations || {});

  const [configuredRoots] = createResource(
    () => {
      if (!contractAddress) {
        return undefined;
      }
      return {
        contractAddress: contractAddress,
      };
    },
    async ({ contractAddress }) => {
      const client = clientCtx.getClient({
        chainId: props.deployment.chainId.toString(),
        rpcUrl: props.deployment.rpcUrl,
      })!;
      if (props.deployment.chainId.startsWith('sol:')) {
        const roots = Object.values(props.roots);
        const rootPdas = await Promise.all(
          roots.map(async (root) => {
            const [pda, _] = await getProgramDerivedAddress({
              programAddress: MERKLE_DISTRIBUTOR_PROGRAM_ADDRESS,
              seeds: [
                getBytesEncoder().encode(
                  new Uint8Array([67, 108, 97, 105, 109, 82, 111, 111, 116])
                ),
                getAddressEncoder().encode(expectAddress(address(contractAddress))),
                getBytesEncoder().encode(toBytes(root)),
              ],
            });
            return address(pda);
          })
        );

        const claimRoots = await fetchAllMaybeClaimRoot(client.asSolanaClient()!, rootPdas);
        return Object.entries(props.roots)
          .map(([name, root], idx) => ({
            name: name,
            root: root,
            id: claimRoots[idx]?.exists ? 'default' : undefined,
          }))
          .filter((root) => root.id)
          .map((root) => ({
            name: root.name,
            root: root.root,
          }));
      } else {
        const configurationIdPromises = Object.entries(props.roots).map(async ([name, root]) => {
          const configurationId = await client.asEvmClient()!.readContract({
            address: contractAddress as `0x${string}`,
            abi: DistributorAbi,
            functionName: 'configurationId',
            args: [root as `0x${string}`],
          });

          const id = configurationIds.find((id) => keccak256(toBytes(id)) === configurationId);

          return {
            name,
            root,
            id,
          };
        });
        const roots = await Promise.all(configurationIdPromises);
        return roots
          .filter((root) => root.id)
          .map((root) => ({
            name: root.name,
            root: root.root,
          }));
      }
    }
  );

  const hasDefault = createMemo(() => {
    return !props.deployment.chainId.startsWith('sol:');
  });

  return (
    <Suspense>
      <Show when={hasDefault()}>
        <FeeConfigurationPanel
          contractAddress={contractAddress}
          root={'0x0000000000000000000000000000000000000000000000000000000000000000'}
          rootName="Global"
          appId={props.appId}
          deployment={props.deployment}
          deploymentName={props.name}
        />
      </Show>

      <For each={configuredRoots()}>
        {(root) => (
          <FeeConfigurationPanel
            contractAddress={contractAddress}
            root={root.root as `0x${string}`}
            rootName={root.name}
            appId={props.appId}
            deployment={props.deployment}
            deploymentName={props.name}
          />
        )}
      </For>
    </Suspense>
  );
}

interface FeeConfigurationPanelProps {
  root: `0x${string}`;
  contractAddress: `0x${string}`;
  rootName: string;
  appId: string;
  deployment: Deployment;
  deploymentName: string;
}

type FeeModeType = 'Default' | 'FixedFee' | 'SingleTierFeeRate';

function FeeConfigurationPanel(props: FeeConfigurationPanelProps) {
  const { config } = useConfig();
  const clientCtx = useContext(ClientContext);

  const [feeMode, setFeeMode] = createSignal<FeeModeType>('Default');
  const [fixedFee, setFixedFee] = createSignal<string>('');
  const [feeRate, setFeeRate] = createSignal<string>('');
  const [minFee, setMinFee] = createSignal<string>('');
  const [maxFee, setMaxFee] = createSignal<string>('');

  const [isSaving, setIsSaving] = createSignal(false);
  const [saveError, setSaveError] = createSignal<string | null>(null);
  const [saveSuccess, setSaveSuccess] = createSignal(false);

  const [feeInfo, { refetch }] = createResource(async () => {
    const client = clientCtx.getClient({
      chainId: props.deployment.chainId.toString(),
      rpcUrl: props.deployment.rpcUrl,
    })!;
    const info = await readFee(client, props.contractAddress, props.root);
    console.log({ info });
    if (info.feeMode === 'Default') {
      setFeeMode('Default');
    } else if (info.feeMode === 'FixedFee') {
      setFeeMode('FixedFee');
      setFixedFee(info.data!.toString());
    } else if (info.feeMode === 'SingleTierFeeRate') {
      setFeeMode('SingleTierFeeRate');
      setFeeRate(info.data!.feeRate);
      setMinFee(info.data!.minFee);
      setMaxFee(info.data!.maxFee);
    }
    return info;
  });

  const handleSaveConfiguration = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // Build the fee mode request based on selected mode
      let feeModeRequest: SetFeeRequest['feeMode'];

      if (feeMode() === 'FixedFee') {
        feeModeRequest = { fixedFee: fixedFee() };
      } else if (feeMode() === 'SingleTierFeeRate') {
        feeModeRequest = {
          singleTierFeeRate: {
            feeRate: feeRate(),
            maxFee: maxFee(),
            minFee: minFee(),
          },
        };
      } else {
        // Default mode - just set fixed fee to "0"
        feeModeRequest = 'default';
      }

      const request: SetFeeRequest = {
        appId: props.appId,
        deployment: props.deploymentName,
        projectAdmin: props.deployment.roles['projectAdmin'] as string,
        batchRoot: props.root,
        feeMode: feeModeRequest,
      };

      // Call set-fee API
      const response = await setFee(config().baseUrl, config().apiKey, request);
      const txHash = response.txHash;
      const client = clientCtx.getClient({
        chainId: props.deployment.chainId.toString(),
        rpcUrl: props.deployment.rpcUrl,
      })!;

      if (props.deployment.chainId.startsWith('sol:')) {
        const receipt = await client.asSolanaClient()!.getTransaction(signature(txHash)).send();
        if (!receipt || receipt.meta?.err) {
          throw new Error('Transaction failed on chain');
        } else {
          setSaveSuccess(true);
        }
      } else {
        // Wait for transaction receipt
        const receipt = await client.asEvmClient()!.waitForTransactionReceipt({
          hash: txHash as `0x${string}`,
        });

        if (receipt.status === 'success') {
          setSaveSuccess(true);
          // Hide success message after 3 seconds
          setTimeout(() => setSaveSuccess(false), 3000);
        } else {
          throw new Error('Transaction failed');
        }
      }
    } catch (error) {
      console.error('Error saving fee configuration:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save fee configuration');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Suspense>
      <div class="flex items-center justify-between mb-6">
        <div>
          <h3 class="text-lg font-semibold">Configure Fee for {props.rootName}</h3>
          <p class="text-sm text-gray-500 mt-1">Root: {props.root}</p>
        </div>
      </div>

      <div class="space-y-6">
        {/* Fee Mode Selection */}
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-3">Fee Mode</label>
          <div class="space-y-3">
            {/* Default Option */}
            <label class="flex items-start p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name={`feeMode-${props.root}`}
                value="Default"
                checked={feeMode() === 'Default'}
                onChange={(e) => setFeeMode(e.currentTarget.value as FeeModeType)}
                class="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
              />
              <div class="ml-3 flex-1">
                <div class="font-medium text-gray-900">Default</div>
                <div class="text-sm text-gray-500 mt-1">
                  Use the default fee configuration (no custom fee)
                </div>
              </div>
            </label>

            {/* Fixed Fee Option */}
            <label class="flex items-start p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name={`feeMode-${props.root}`}
                value="FixedFee"
                checked={feeMode() === 'FixedFee'}
                onChange={(e) => setFeeMode(e.currentTarget.value as FeeModeType)}
                class="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
              />
              <div class="ml-3 flex-1">
                <div class="font-medium text-gray-900">Fixed Fee</div>
                <div class="text-sm text-gray-500 mt-1">Charge a fixed amount for each claim</div>
              </div>
            </label>

            {/* Single Tier Fee Rate Option */}
            <label class="flex items-start p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name={`feeMode-${props.root}`}
                value="SingleTierFeeRate"
                checked={feeMode() === 'SingleTierFeeRate'}
                onChange={(e) => setFeeMode(e.currentTarget.value as FeeModeType)}
                class="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
              />
              <div class="ml-3 flex-1">
                <div class="font-medium text-gray-900">Single Tier Fee Rate</div>
                <div class="text-sm text-gray-500 mt-1">
                  Charge a percentage-based fee with minimum and maximum limits
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Fixed Fee Input */}
        <Show when={feeMode() === 'FixedFee'}>
          <div class="pl-4 border-l-4 border-blue-500">
            <label class="block text-sm font-medium text-gray-700 mb-2">Fixed Fee Amount</label>
            <input
              type="text"
              value={fixedFee()}
              onInput={(e) => setFixedFee(e.currentTarget.value)}
              placeholder="Enter fixed fee amount (in wei)"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p class="text-xs text-gray-500 mt-1">Amount in wei (1 ETH = 10^18 wei)</p>
          </div>
        </Show>

        {/* Single Tier Fee Rate Inputs */}
        <Show when={feeMode() === 'SingleTierFeeRate'}>
          <div class="pl-4 border-l-4 border-blue-500 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Fee Rate (Basis Points)
              </label>
              <input
                type="text"
                value={feeRate()}
                onInput={(e) => setFeeRate(e.currentTarget.value)}
                placeholder="Enter fee rate (e.g., 250 for 2.5%)"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p class="text-xs text-gray-500 mt-1">
                Fee rate in basis points (100 = 1%, 250 = 2.5%)
              </p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Minimum Fee</label>
                <input
                  type="text"
                  value={minFee()}
                  onInput={(e) => setMinFee(e.currentTarget.value)}
                  placeholder="Enter minimum fee (in wei)"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p class="text-xs text-gray-500 mt-1">Minimum fee in wei</p>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Maximum Fee</label>
                <input
                  type="text"
                  value={maxFee()}
                  onInput={(e) => setMaxFee(e.currentTarget.value)}
                  placeholder="Enter maximum fee (in wei)"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p class="text-xs text-gray-500 mt-1">Maximum fee in wei</p>
              </div>
            </div>
          </div>
        </Show>

        {/* Success/Error Messages */}
        <Show when={saveSuccess()}>
          <div class="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div class="flex items-center gap-2">
              <svg class="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clip-rule="evenodd"
                />
              </svg>
              <span class="text-sm font-medium text-green-800">
                Fee configuration saved successfully!
              </span>
            </div>
          </div>
        </Show>

        <Show when={saveError()}>
          <div class="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div class="flex items-start gap-2">
              <svg class="w-5 h-5 text-red-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clip-rule="evenodd"
                />
              </svg>
              <div class="flex-1">
                <span class="text-sm font-medium text-red-800">Error saving configuration</span>
                <p class="text-xs text-red-700 mt-1">{saveError()}</p>
              </div>
            </div>
          </div>
        </Show>

        {/* Action Buttons */}
        <div class="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            disabled={isSaving()}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveConfiguration}
            disabled={isSaving()}
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Show when={isSaving()}>
              <svg
                class="animate-spin h-4 w-4 text-white"
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
            </Show>
            {isSaving() ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </Suspense>
  );
}
