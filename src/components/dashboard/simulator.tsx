import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  Show,
  Switch,
  useContext,
} from 'solid-js';
import { AppConfContext } from '../../hooks/context/AppConf';
import { DeploymentContext } from '../../hooks/context/Deployment';
import { ConfigurationContext } from '../../hooks/context/Configuration';
import { BsCheck, BsX } from 'solid-icons/bs';
import TransferHook from './simulator/hooks/TransferHook';
import LockHook from './simulator/hooks/LockHook';
import LinearPenaltyHook from './simulator/hooks/LinearPenaltyHook';
import { createStore, produce } from 'solid-js/store';
import { encodeAbiParameters, formatUnits, parseEther, parseUnits } from 'viem';

export default function Simulator() {
  const { appConf } = useContext(AppConfContext)!;

  const deployments = () => Object.keys(appConf.deployments);
  const [selectedDeployment, setSelectedDeployment] = createSignal(deployments()[0]);

  const deploymentCtx = () => {
    const deployment = appConf.deployments[selectedDeployment()];
    return {
      contractAddress: () => deployment.roles.contract as `0x${string}`,
      chainId: () => BigInt(deployment.chainId),
      rpcUrl: () => deployment.rpcUrl,
      appId: () => appConf.appId,
      deployment: () => selectedDeployment(),
      roles: () => deployment.roles as Record<string, `0x${string}`>,
      configurationNames: () => Object.keys(deployment.extra.configurations || {}),
    };
  };

  const deploymentSelect = () => (
    <div class="mb-6">
      <label for="deployment-select" class="block text-sm font-medium text-gray-700 mb-2">
        Select Deployment
      </label>
      <select
        id="deployment-select"
        value={selectedDeployment()}
        onChange={(e) => setSelectedDeployment(e.target.value)}
        class="block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
      >
        <For each={deployments()}>
          {(deployment) => <option value={deployment}>{deployment}</option>}
        </For>
      </select>
    </div>
  );

  return (
    <div class="max-w-6xl mx-auto p-6 space-y-6">
      <header class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900 mb-2">Airdrop Simulator</h1>
        <p class="text-gray-600">Configure and test your airdrop strategies</p>
      </header>
      {deploymentSelect()}
      <Show when={selectedDeployment()}>
        <DeploymentContext.Provider value={deploymentCtx()}>
          <DeploymentPanel />
        </DeploymentContext.Provider>
      </Show>
    </div>
  );
}

const DeploymentPanel = () => {
  const { appConf } = useContext(AppConfContext)!;
  const { deployment, configurationNames } = useContext(DeploymentContext)!;
  const [selectedConfiguration, setSelectedConfiguration] = createSignal(configurationNames()[0]);

  const configurationCtx = () => {
    return {
      configurationName: () => selectedConfiguration(),
      configuration: () =>
        appConf.deployments[deployment()].extra.configurations![selectedConfiguration()],
    };
  };

  return (
    <section class="bg-white rounded-lg shadow-md p-6 space-y-6">
      <div class="border-b border-gray-200 pb-4">
        <h2 class="text-2xl font-semibold text-gray-800">Deployment: {deployment()}</h2>
      </div>
      <div>
        <label for="configuration-select" class="block text-sm font-medium text-gray-700 mb-2">
          Select Configuration
        </label>
        <select
          id="configuration-select"
          value={selectedConfiguration()}
          onChange={(e) => setSelectedConfiguration(e.target.value)}
          class="block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        >
          <For each={configurationNames()}>
            {(configuration) => <option value={configuration}>{configuration}</option>}
          </For>
        </select>
      </div>
      <Show when={selectedConfiguration()}>
        <ConfigurationContext.Provider value={configurationCtx()}>
          <ConfigurationPanel />
        </ConfigurationContext.Provider>
      </Show>
    </section>
  );
};

const ConfigurationPanel = () => {
  const { configurationName, configuration } = useContext(ConfigurationContext)!;
  const [hookExtra, setHookExtra] = createStore<
    {
      data: `0x${string}`;
      consumed: bigint;
      allocatedAmount: bigint;
    }[]
  >([]);
  const [totalAllocated, setTotalAllocated] = createSignal(0n);

  const [extra, setExtra] = createSignal<`0x${string}`>(`0x00`);

  createEffect(() => {
    const data = configuration().strategy.map((strategy, index) => ({
      data: `0x00` as `0x${string}`,
      consumed: 0n,
      allocatedAmount: (totalAllocated() * parseUnits(strategy.proportion, 0)) / parseEther('1'),
    }));

    setHookExtra(data);
  });

  createEffect(() => {
    const typeInfo = hookExtra.map((extra) => ({ type: 'bytes' }));
    const values = hookExtra.map((extra) => extra.data);
    setExtra(encodeAbiParameters(typeInfo, values));
  });

  const handleSetHookExtra = (index: number, extra: { data: `0x${string}`; consumed: bigint }) => {
    const fallbackIdx = parseInt(configuration().fallbackIdx);

    const totalConsumed = hookExtra.reduce((acc, curr, idx) => {
      if (idx !== fallbackIdx) {
        return acc + curr.consumed;
      }
      return acc;
    }, 0n);

    setHookExtra(
      fallbackIdx,
      produce((state) => {
        if (totalAllocated() > totalConsumed) {
          state.allocatedAmount = totalAllocated() - totalConsumed;
        }
      })
    );

    setHookExtra(
      index,
      produce((state) => {
        state.consumed = extra.consumed;
        state.data = extra.data;
      })
    );
  };

  return (
    <div class="space-y-6 mt-6">
      <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
        <h3 class="text-xl font-semibold text-gray-900 mb-1">{configurationName()}</h3>
        <p class="text-sm text-gray-600">Configure allocation and strategy parameters</p>
      </div>

      <div class="bg-white rounded-lg border border-gray-200 p-5">
        <label for="allocation-input" class="block text-sm font-medium text-gray-700 mb-2">
          Total Allocation Amount
        </label>
        <div class="relative">
          <input
            id="allocation-input"
            type="text"
            value={formatUnits(totalAllocated(), 0)}
            onChange={(e) => setTotalAllocated(parseUnits(e.target.value, 0))}
            class="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-lg"
            placeholder="Enter allocation amount"
          />
          <span class="absolute right-4 top-3 text-gray-400 text-sm">tokens</span>
        </div>
      </div>

      <div class="space-y-4">
        <h4 class="text-lg font-medium text-gray-800 flex items-center gap-2">
          <span class="flex items-center justify-center w-6 h-6 bg-blue-500 text-white rounded-full text-sm">
            {configuration().strategy.length}
          </span>
          Strategy Hooks
        </h4>
        <For each={configuration().strategy}>
          {(strategy, index) => (
            <Switch>
              <Match when={strategy.hook === 'transferHook' && index() < hookExtra.length}>
                <TransferHook
                  allocatedAmount={() => hookExtra[index()].allocatedAmount}
                  setHookExtra={(extra) => handleSetHookExtra(index(), extra)}
                />
              </Match>
              <Match when={strategy.hook === 'lockHook' && index() < hookExtra.length}>
                <LockHook />
              </Match>
              <Match when={strategy.hook === 'linearPenaltyHook' && index() < hookExtra.length}>
                <LinearPenaltyHook
                  allocatedAmount={() => hookExtra[index()].allocatedAmount}
                  setHookExtra={(extra) => handleSetHookExtra(index(), extra)}
                />
              </Match>
            </Switch>
          )}
        </For>
      </div>

      <div class="bg-gray-50 rounded-lg border border-gray-200 p-5">
        <label for="encoded-extra" class="block text-sm font-medium text-gray-700 mb-2">
          Encoded Extra Data
        </label>
        <div class="relative">
          <textarea
            id="encoded-extra"
            value={extra()}
            readonly
            class="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white font-mono text-sm resize-none"
            rows={3}
          />
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(extra())}
            class="absolute right-2 top-2 px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  );
};
