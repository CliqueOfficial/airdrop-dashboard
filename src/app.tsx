import { Suspense, useContext, type Component } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import { ConfigContext } from './context/ConfigContext';

const App: Component<{ children: Element }> = (props) => {
  const { baseEnv, setBaseEnv } = useContext(ConfigContext)!;

  return (
    <>
      <nav class="bg-gray-200 text-gray-900 px-4">
        <ul class="flex items-center">
          <li class="py-2 px-4">
            <A href="/" class="no-underline hover:underline">
              Home
            </A>
          </li>
          <li class="py-2 px-4">
            <A href="/about" class="no-underline hover:underline">
              About
            </A>
          </li>
          <li class="py-2 px-4">
            <A href="/error" class="no-underline hover:underline">
              Error
            </A>
          </li>

          <li class="test-sm flex items-center space-x-1 ml-auto">
            <span>Env:</span>
            <input
              class="w-75px p-1 bg-white text-sm rounded-lg"
              type="text"
              value={baseEnv()}
              onFocusOut={(e) => setBaseEnv(e.target.value as string)}
            />
          </li>
        </ul>
      </nav>

      <main>
        <Suspense>{props.children}</Suspense>
      </main>
    </>
  );
};

export default App;
