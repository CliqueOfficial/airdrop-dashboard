import { Accessor, createSignal } from 'solid-js';

interface InputButtonProps {
  onClick: (value: string) => void;
}

export const InputButton = (props: InputButtonProps) => {
  const [value, setValue] = createSignal('');
  return (
    <div>
      <input
        class="w-75px p-1 bg-white text-sm rounded-lg"
        type="text"
        value={value()}
        onChange={(e) => setValue(e.target.value)}
      />
      <button
        class="w-75px p-1 text-sm rounded-lg ml-2 bg-blue-500 text-white"
        onClick={() => props.onClick(value())}
      >
        Add more
      </button>
    </div>
  );
};
