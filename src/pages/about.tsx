import { createMemo } from 'solid-js';
import { useConfig } from '../hooks/useConfig';
import { getContractAddress } from 'viem';
import { createStore, unwrap } from 'solid-js/store';

export default function About() {
  const { config, setBaseUrl, setApiKey } = useConfig();
  const [state, setState] = createStore({
    extra: {
      count: 0,
    },
  });

  console.log(state.extra);
  console.log(structuredClone(unwrap(state)));
  return (
    <section class="bg-gray-100 text-gray-700 p-8">
      <ul>
        <li>
          <div>
            <span>Base URL:</span>
            <input
              class="w-75px p-1 bg-white text-sm rounded-lg"
              type="text"
              value={config.baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>
        </li>
        <li>
          <div>
            <span>API KEY:</span>
            <input
              class="w-75px p-1 bg-white text-sm rounded-lg"
              type="text"
              value={config.apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
        </li>
      </ul>
      <div>
        <span>Parent State:</span>
        {JSON.stringify(state)}
      </div>
      <div>
        <Child extra={unwrap(state.extra)} setExtra={(extra) => setState('extra', extra)} />
      </div>
    </section>
  );
}

interface ChildProps {
  extra: {
    count: number;
  };
  setExtra: (extra: { count: number }) => void;
}

function Child(props: ChildProps) {
  const [extra, setExtra] = createStore(unwrap(props.extra));
  return (
    <div>
      <span>Child State:</span>
      {JSON.stringify(extra)}
      <button
        onClick={() =>
          setExtra({
            count: extra.count + 1,
          })
        }
      >
        Increment
      </button>
    </div>
  );
}
