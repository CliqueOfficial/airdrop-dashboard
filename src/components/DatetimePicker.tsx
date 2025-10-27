import { Accessor, Component, Show, Suspense } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import Spin from './Spin';

interface DatetimePickerProps {
  value: Accessor<bigint>;
  setValue: (value: bigint) => void;
  label?: string;
  icon?: Component<any>;
  isEditing?: boolean;
  color?: 'purple' | 'blue' | 'green' | 'red' | 'orange';
  loading?: boolean;
}

export default function DatetimePicker(props: DatetimePickerProps) {
  const color = () => props.color || 'purple';

  const colorClasses = () => {
    const c = color();
    return {
      border: `border-${c}-100`,
      text: `text-${c}-500`,
      inputBorder: `border-${c}-300`,
      focusRing: `focus:ring-${c}-500 focus:border-${c}-500`,
    };
  };

  const formatDateTimeLocal = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toISOString().slice(0, 16);
  };

  const parseDateTimeLocal = (dateTimeStr: string) => {
    return BigInt(Math.floor(new Date(dateTimeStr).getTime() / 1000));
  };

  const formatTimestamp = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div class={`bg-white rounded-lg p-3 border ${colorClasses().border}`}>
      <Show when={props.label}>
        <div class="flex items-center gap-2 mb-1">
          <Show when={props.icon}>
            <Dynamic component={props.icon} class={colorClasses().text} size={16} />
          </Show>
          <span class="text-xs font-medium text-gray-500">{props.label}</span>
        </div>
      </Show>
      <Show
        when={props.isEditing}
        fallback={
          <Suspense fallback={<Spin size={14} />}>
            <div class="text-lg font-bold text-gray-900">{formatTimestamp(props.value())}</div>
          </Suspense>
        }
      >
        <input
          type="datetime-local"
          value={formatDateTimeLocal(props.value())}
          onInput={(e) => props.setValue(parseDateTimeLocal(e.currentTarget.value))}
          class={`w-full px-3 py-2 border ${colorClasses().inputBorder} rounded-md focus:ring-2 ${colorClasses().focusRing} text-sm`}
        />
      </Show>
    </div>
  );
}
