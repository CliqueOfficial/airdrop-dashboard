import { Accessor } from 'solid-js';

interface InputProps {
  key?: string;
  label: string;
  value: Accessor<string>;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  class?: string;
}

export const Input = (props: InputProps) => {
  return (
    <div class={`relative mt-6 ${props.class}`}>
      <input
        id={props.key}
        type="text"
        placeholder=" "
        value={props.value()}
        onInput={(e) => props.onChange?.(e.target.value)}
        readOnly={props.readOnly}
        class={`
          peer 
          block 
          w-full 
          rounded-md 
          border 
          border-gray-300 
          bg-transparent 
          px-3 
          pt-2 
          pb-2
          text-sm 
          text-gray-900 
          placeholder-transparent 
          focus:border-blue-500 
          focus:outline-none
          ${props.readOnly ? 'bg-gray-50 cursor-not-allowed' : ''}
        `}
      />
      <label
        for={props.key}
        class="absolute left-3 top-0 text-gray-500 text-sm transition-all duration-200 -translate-y-2.5 bg-gray-100 px-1
           peer-placeholder-shown:top-4 peer-placeholder-shown:text-gray-400 peer-placeholder-shown:text-base
           peer-focus:top-0 peer-focus:text-sm peer-focus:text-blue-500"
      >
        {props.label}
      </label>
    </div>
  );
};
