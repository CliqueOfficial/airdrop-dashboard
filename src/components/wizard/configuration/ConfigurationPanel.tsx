import {
  Accessor,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  Match,
  Show,
  Suspense,
  Switch,
  useContext,
} from 'solid-js';
import { Configuration, Strategy } from '../../../types';
import TransferHookPanel from './hook/TransferHookPanel';
import LockHookPanel from './hook/LockHookPanel';
import { DeploymentContext } from '../../../hooks/context/Deployment';
import { useConfiguration } from '../../../hooks/useConfiguration';
import EditableListView from '../../EditableListView';
import { parseEther } from 'viem';
import { TiWarningOutline } from 'solid-icons/ti';
import { AiTwotoneCheckCircle } from 'solid-icons/ai';
import Spin from '../../Spin';

interface ConfigurationPanelProps {
  name: string;
  configuration: Configuration;
  setConfiguration: (configuration: Configuration) => void;
}

export default function ConfigurationPanel({
  name,
  configuration,
  setConfiguration,
}: ConfigurationPanelProps) {
  const context = useContext(DeploymentContext)!;

  const availableHooks = createMemo(() =>
    Object.entries(context.roles())
      .filter(([name, _]) => name.endsWith('Hook'))
      .map(([name, address]) => ({ name, address: address as `0x${string}` }))
  );
  const hookReverseMap = createMemo(() =>
    Object.fromEntries(availableHooks().map((hook) => [hook.address, hook.name]))
  );

  const { data, update, refetch } = useConfiguration({
    contractAddress: () => context.roles()['contract'],
    configurationName: () => name,
    hookReverseMap: hookReverseMap,
    chainId: () => BigInt(context.chainId()),
    rpcUrl: context.rpcUrl,
    appId: context.appId,
    deployment: context.deployment,
    projectAdmin: () => context.roles()['projectAdmin'],
  });

  const isSynced = (data: Configuration | undefined) => {
    if (!data) return false;
    const fallbackIdxSynced = data.fallbackIdx === configuration.fallbackIdx;
    const strategiesLengthSynced = data.strategy.length === configuration.strategy.length;
    const strategiesSynced = data.strategy.every((strategy, index) => {
      const localStrategy = configuration.strategy[index];
      const hookSynced = strategy.hook === localStrategy?.hook;
      const parsedProportion = (parseEther(localStrategy?.proportion || '0') / 100n).toString();
      const proportionSynced = strategy.proportion === parsedProportion;
      return hookSynced && proportionSynced;
    });
    return fallbackIdxSynced && strategiesLengthSynced && strategiesSynced;
  };

  const [fallbackIdx, setFallbackIdx] = createSignal(configuration.fallbackIdx || '0');
  const [isDeploying, setIsDeploying] = createSignal(false);

  const handleDeploy = async () => {
    setIsDeploying(true);
    try {
      await update({
        strategy: configuration.strategy || [],
        fallbackIdx: fallbackIdx(),
        deployed: true,
      });
      await refetch();
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <EditableListView
      title={
        <div class="flex items-center justify-between w-full">
          <div class="flex items-center gap-2">
            <Suspense fallback={<Spin size={14} />}>
              <Show
                when={!!isSynced(data())}
                fallback={
                  <span
                    class="text-amber-600 cursor-help flex items-center"
                    title="Configuration is not synced - deployment required"
                  >
                    <TiWarningOutline size={14} />
                  </span>
                }
              >
                <span
                  class="text-green-600 cursor-help flex items-center"
                  title="Configuration is synced with on-chain state"
                >
                  <AiTwotoneCheckCircle size={14} />
                </span>
              </Show>
            </Suspense>
            <span class="text-lg font-semibold text-gray-900">{name}</span>
          </div>
          {/*TODO: disable when editing. Allow `title` to pass a function (isEditing: boolean) => JSX.Element */}
          <Suspense>
            <Show when={!isSynced(data())}>
              <button
                onClick={handleDeploy}
                disabled={isDeploying()}
                class="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Show when={isDeploying()}>
                  <Spin size={14} />
                </Show>
                {isDeploying() ? 'Deploying...' : 'Deploy'}
              </button>
            </Show>
          </Suspense>
        </div>
      }
      items={configuration.strategy || []}
      canAdd={availableHooks().length > 0}
      createView={(onItemCreated, onCancel) => (
        <StrategyCreateView
          availableHooks={() => availableHooks().map((hook) => hook.name)}
          onItemCreated={onItemCreated}
          onCancel={onCancel}
        />
      )}
      onItemsChange={(items) => {
        console.log('=== onItemsChange called ===');
        console.log('items:', items);
        const newConfig = {
          strategy: items,
          fallbackIdx: fallbackIdx(),
          deployed: false,
        };
        console.log('calling setConfiguration with:', newConfig);
        setConfiguration(newConfig);
      }}
    >
      {(item, index, isEditing, updateItem) => (
        <Show
          when={!isEditing}
          fallback={
            <div class="flex flex-col gap-4 p-4 bg-white border border-gray-200 rounded-md">
              {/* Radio button select for fallback Idx */}
              <div class="flex items-center gap-2">
                <input
                  type="radio"
                  id={`fallback-${index}`}
                  name="fallback"
                  checked={fallbackIdx() === index.toString()}
                  onChange={() => setFallbackIdx(index.toString())}
                  class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500"
                />
                <label for={`fallback-${index}`} class="text-sm font-medium text-gray-700">
                  Set as fallback hook
                </label>
              </div>

              {/* Dropdown select for hook */}
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium text-gray-700">Hook</label>
                <select
                  value={item.hook}
                  onChange={(e) => updateItem({ hook: e.currentTarget.value })}
                  class="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <For each={availableHooks()}>
                    {(hook) => <option value={hook.name}>{hook.name}</option>}
                  </For>
                </select>
              </div>

              {/* Slider for proportion */}
              <div class="flex flex-col gap-2">
                <div class="flex justify-between items-center">
                  <label class="text-sm font-medium text-gray-700">Proportion</label>
                  <span class="text-sm text-gray-600 font-semibold">{item.proportion}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={item.proportion}
                  onInput={(e) => updateItem({ proportion: e.currentTarget.value })}
                  class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div class="flex justify-between text-xs text-gray-500">
                  <span>0</span>
                  <span>100</span>
                </div>
              </div>
            </div>
          }
        >
          <Switch>
            <Match when={item.hook === 'transferHook'}>
              <TransferHookPanel
                proportion={item.proportion}
                isFallback={fallbackIdx() === index.toString()}
              />
            </Match>
            <Match when={item.hook === 'lockHook'}>
              <LockHookPanel
                proportion={item.proportion}
                strategy={name}
                isFallback={fallbackIdx() === index.toString()}
                isFixedStart={false}
              />
            </Match>
          </Switch>
        </Show>
      )}
    </EditableListView>
  );
}

interface StrategyCreateViewProps {
  onItemCreated: (item: Strategy) => void;
  onCancel: () => void;
  availableHooks: Accessor<string[]>;
}

function StrategyCreateView(props: StrategyCreateViewProps) {
  const [hookName, setHookName] = createSignal(props.availableHooks()[0]);
  const [proportion, setProportion] = createSignal('0');

  const handleConfirm = () => {
    props.onItemCreated({
      hook: hookName(),
      proportion: proportion(),
    });
    setProportion('0');
  };

  const handleCancel = () => {
    setProportion('0');
    props.onCancel();
  };

  return (
    <div class="space-y-4">
      {/* Hook Selection */}
      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium text-gray-700">Hook</label>
        <select
          value={hookName()}
          onChange={(e) => setHookName(e.currentTarget.value)}
          class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <For each={props.availableHooks()}>{(name) => <option value={name}>{name}</option>}</For>
        </select>
      </div>

      {/* Proportion Slider */}
      <div class="flex flex-col gap-2">
        <div class="flex justify-between items-center">
          <label class="text-sm font-medium text-gray-700">Proportion</label>
          <span class="text-sm text-gray-600 font-semibold">{proportion()}</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={proportion()}
          onInput={(e) => setProportion(e.currentTarget.value)}
          class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <div class="flex justify-between text-xs text-gray-500">
          <span>0</span>
          <span>100</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div class="flex gap-2 justify-end pt-2">
        <button
          class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md transition-colors text-sm"
          onClick={handleCancel}
        >
          Cancel
        </button>
        <button
          class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors text-sm"
          onClick={handleConfirm}
        >
          Add Hook
        </button>
      </div>
    </div>
  );
}
