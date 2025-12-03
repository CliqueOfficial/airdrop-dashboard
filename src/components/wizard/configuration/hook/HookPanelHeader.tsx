import { Show } from 'solid-js';
import { For } from 'solid-js';
import { formatUnits } from 'viem';

interface Badge {
  label: string;
  color: 'yellow' | 'blue' | 'green' | 'purple';
}

interface HookPanelHeaderProps {
  icon: any; // SolidJS icon component
  title: string;
  description: string;
  proportion?: string;
  isFallback: boolean;
  badges?: Badge[];
  color: 'green' | 'purple';
  hasBorder?: boolean;
}

export default function HookPanelHeader(props: HookPanelHeaderProps) {
  const colorClasses = {
    green: {
      bg: 'bg-green-500',
      text: 'text-green-600',
    },
    purple: {
      bg: 'bg-purple-500',
      text: 'text-purple-600',
    },
  };

  const badgeColorClasses = {
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
    green: 'bg-green-100 text-green-800 border-green-200',
    purple: 'bg-purple-100 text-purple-800 border-purple-200',
  };

  const theme = colorClasses[props.color];

  return (
    <div
      class={`flex items-center justify-between p-4 ${props.hasBorder ? `border-b border-${props.color}-200` : ''}`}
    >
      <div class="flex items-center gap-3">
        <div
          class={`w-10 h-10 flex items-center justify-center rounded-lg ${theme.bg} text-white shadow-md`}
        >
          {props.icon({ size: 24 })}
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h3 class="font-semibold text-gray-900">{props.title}</h3>

            {/* Fallback Badge */}
            <Show when={props.isFallback}>
              <span
                class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeColorClasses.yellow}`}
              >
                Fallback
              </span>
            </Show>

            {/* Custom Badges */}
            <For each={props.badges || []}>
              {(badge) => (
                <span
                  class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeColorClasses[badge.color]}`}
                >
                  {badge.label}
                </span>
              )}
            </For>
          </div>
          <p class="text-sm text-gray-600 mt-0.5">{props.description}</p>
        </div>
      </div>

      {/* Proportion Display */}
      <Show when={!props.isFallback && props.proportion}>
        <div class="text-right">
          <div class="flex items-baseline gap-1">
            <span class={`text-3xl font-bold ${theme.text}`}>
              {formatUnits(BigInt(props.proportion || '0'), 16)}
            </span>
            <span class="text-lg text-gray-500">%</span>
          </div>
          <p class="text-xs text-gray-500 mt-1">Distribution</p>
        </div>
      </Show>
    </div>
  );
}
