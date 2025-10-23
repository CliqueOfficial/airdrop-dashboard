import { Accessor, createEffect, createMemo, createSignal, For, Show, useContext } from 'solid-js';
import { Configuration, Strategy } from '../../../types';
import TransferHookPanel from './hook/TransferHookPanel';
import LockHookPanel from './hook/LockHookPanelProps';
import { DeploymentContext } from '../../../hooks/context/Deployment';
import { useConfiguration } from '../../../hooks/useConfiguration';
import EditableListView from '../../EditableListView';
import { createStore, unwrap } from 'solid-js/store';
import { parseEther } from 'viem';

interface ConfigurationPanelProps {
  name: Accessor<string>;
  configuration: Accessor<Configuration>;
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
    configurationName: () => name(),
    hookReverseMap: hookReverseMap,
    chainId: () => BigInt(context.chainId()),
    rpcUrl: context.rpcUrl,
    appId: context.appId,
    deployment: context.deployment,
    projectAdmin: () => context.roles()['projectAdmin'],
  });

  createEffect(() => {
    console.log('name', name());
    console.log('configuration', configuration());
    console.log('availableHooks', availableHooks());
  });

  const [fallbackIdx, setFallbackIdx] = createSignal(configuration()?.fallbackIdx || '0');

  return (
    <EditableListView
      title={name()}
      items={configuration()?.strategy || []}
      canAdd={availableHooks().length > 0}
      createView={(onItemCreated, onCancel) => (
        <StrategyCreateView
          availableHooks={() => availableHooks().map((hook) => hook.name)}
          onItemCreated={onItemCreated}
          onCancel={onCancel}
        />
      )}
      onItemsChange={(items) => {
        setConfiguration({
          strategy: items,
          fallbackIdx: fallbackIdx(),
          deployed: false,
        });
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
          <div class="flex items-center gap-4 p-3 bg-gray-50 rounded-md">
            <div class="flex-1">
              <span class="font-medium text-gray-700">{item.hook}</span>
            </div>
            <div class="text-sm text-gray-600">
              Proportion: <span class="font-semibold">{item.proportion}</span>
            </div>
            <Show when={fallbackIdx() === index.toString()}>
              <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Fallback</span>
            </Show>
          </div>
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
