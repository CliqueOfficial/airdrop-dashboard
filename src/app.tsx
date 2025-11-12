import { For, Suspense, useContext, type Component } from 'solid-js';
import { A } from '@solidjs/router';
import { ConfigContext } from './hooks/context/ConfigContext';

const App: Component<{ children: Element }> = (props) => {
  const { selectedEnv, setSelectedEnv, availableEnvs } = useContext(ConfigContext)!;

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
            <A href="/rpc" class="no-underline hover:underline">
              RPC
            </A>
          </li>
          <li class="py-2 px-4">
            <A href="/util" class="no-underline hover:underline">
              Util
            </A>
          </li>
          <li class="py-2 px-4">
            <A href="/error" class="no-underline hover:underline">
              Error
            </A>
          </li>

          <li class="py-2 px-4 ml-auto">
            <span class="text-sm font-medium">Env:</span>
            <select
              class="p-1.5 bg-white text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer"
              value={selectedEnv()}
              onChange={(e) => setSelectedEnv(e.currentTarget.value)}
            >
              <For each={availableEnvs()}>{(env) => <option value={env}>{env}</option>}</For>
            </select>
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
