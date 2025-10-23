import { Component } from 'solid-js';
import { CgSpinner } from 'solid-icons/cg';

interface SpinProps {
  size?: number;
  color?: string;
  class?: string;
}

const Spin: Component<SpinProps> = (props) => {
  return (
    <div
      class={`inline-block animate-spin ${props.class || ''}`}
      style={{
        width: `${props.size || 24}px`,
        height: `${props.size || 24}px`,
        color: props.color || 'currentColor',
      }}
    >
      <CgSpinner size={props.size || 24} />
    </div>
  );
};

export default Spin;
