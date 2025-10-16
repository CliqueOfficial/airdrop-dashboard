import { createStore, unwrap } from 'solid-js/store';
import { Configuration, Strategy } from '../hooks/useAppConf';
import { BsCheck, BsPencil, BsPlus, BsTrash, BsX } from 'solid-icons/bs';
import { Accessor, createSignal, Show } from 'solid-js';

interface DeploymentConfigurationProps {
  name: string;
  class?: string;
  configuration: Configuration;
  hooks: Accessor<{ name: string; value: string }[]>;
}

export const DeploymentConfiguration = (props: DeploymentConfigurationProps) => {
  // Main store - the source of truth
  const [strategies, setStrategies] = createStore<Strategy[]>(props.configuration.strategy);

  // Temporary editing store - initialized with unwrapped values
  const [tempStrategies, setTempStrategies] = createStore<Strategy[]>(unwrap(strategies));
  const [fallbackIdx, setFallbackIdx] = createSignal(props.configuration.fallbackIdx);

  const [isEditing, setIsEditing] = createSignal(false);

  // Confirm changes - save temp state to main store and configuration
  const handleConfirm = () => {
    setStrategies(unwrap(tempStrategies));
    props.configuration.fallbackIdx = fallbackIdx();
    setIsEditing(false);
  };

  // Cancel changes - reset temp state to main store values
  const handleCancel = () => {
    setFallbackIdx(props.configuration.fallbackIdx);
    setTempStrategies(strategies);
    setIsEditing(false);
  };

  return (
    <div class={`border border-gray-300 pb-4 ml-4 mr-4 rounded-md ${props.class}`}>
      <div class="pt-4 pl-4 flex items-center gap-2">
        <span class="text-lg font-bold">{props.name}</span>

        <Show
          when={isEditing()}
          fallback={
            <>
              <button
                class="w-6 h-6 flex items-center justify-center text-blue-500 hover:text-blue-600 rounded-md transition-colors cursor-pointer"
                onClick={() => setIsEditing(true)}
              >
                <BsPencil size={14} />
              </button>
              <button
                class="w-6 h-6 flex items-center justify-center text-red-500 hover:text-red-600 rounded-md transition-colors cursor-pointer"
                onClick={() => {}}
              >
                <BsTrash size={14} />
              </button>
            </>
          }
        >
          <button
            class="w-6 h-6 flex items-center justify-center text-green-500 hover:text-green-600 rounded-md transition-colors cursor-pointer"
            onClick={handleConfirm}
          >
            <BsCheck size={14} />
          </button>
          <button
            class="w-6 h-6 flex items-center justify-center text-red-500 hover:text-red-600 rounded-md transition-colors cursor-pointer"
            onClick={handleCancel}
          >
            <BsX size={14} />
          </button>
          <button
            class="w-6 h-6 pl-auto flex items-center justify-center text-green-500 hover:text-green-600 rounded-md transition-colors cursor-pointer"
            disabled={props.hooks().length === 0}
            onClick={() => {
              setTempStrategies([
                ...tempStrategies,
                { hook: props.hooks()[0].name, proportion: '0' },
              ]);
            }}
          >
            <BsPlus size={14} />
          </button>
        </Show>
      </div>
      <div class="mt-4 space-y-3">
        {tempStrategies.map((strategy, index) => (
          <div class="pl-4 pr-4 flex items-center gap-3">
            {/* Radio button for fallback selection */}
            <input
              type="radio"
              name={`fallback-${props.name}`}
              checked={index.toString() === fallbackIdx()}
              disabled={!isEditing()}
              class="w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
              onChange={(e) => {
                if (e.currentTarget.checked) {
                  setFallbackIdx(index.toString());
                }
              }}
            />

            {/* Dropdown */}
            <select
              value={strategy.hook}
              disabled={!isEditing()}
              class="flex-1 h-8 px-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              onChange={(e) => {
                setTempStrategies(index, 'hook', e.currentTarget.value);
              }}
            >
              {props.hooks().map((hook) => (
                <option value={hook.name}>{hook.name}</option>
              ))}
            </select>

            {/* Slider - hide when this is the fallback */}
            <Show when={index.toString() !== fallbackIdx()} fallback={<div class="flex-1"></div>}>
              <input
                type="range"
                min="0"
                max="100"
                value={Number(strategy.proportion)}
                disabled={!isEditing()}
                class="flex-1 cursor-pointer disabled:cursor-not-allowed"
                onInput={(e) => {
                  setTempStrategies(index, 'proportion', e.currentTarget.value);
                }}
              />
            </Show>

            {/* Value display or "fallback" text */}
            <span class="text-sm font-mono w-12 text-right">
              <Show when={index.toString() !== fallbackIdx()} fallback="fallback">
                {strategy.proportion.toString()}%
              </Show>
            </span>

            {/* Delete button - only show when editing */}
            <Show when={isEditing()}>
              <button
                class="w-6 h-6 flex items-center justify-center text-red-500 hover:text-red-600 rounded-md transition-colors cursor-pointer shrink-0"
                onClick={() => {
                  setTempStrategies(tempStrategies.filter((_, i) => i !== index));
                }}
              >
                <BsTrash size={14} />
              </button>
            </Show>
          </div>
        ))}
      </div>
    </div>
  );
};
