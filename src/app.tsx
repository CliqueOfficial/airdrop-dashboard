import { For, Suspense, useContext, type Component } from 'solid-js';
import { A } from '@solidjs/router';
import { ConfigContext } from './hooks/context/ConfigContext';
import icon from './favicon.ico';

const App: Component<{ children: Element }> = (props) => {
  const { selectedEnv, setSelectedEnv, availableEnvs } = useContext(ConfigContext)!;

  return (
    <>
      <nav class="bg-white border-b border-gray-200 shadow-sm">
        <div class="max-w-7xl mx-auto px-6">
          <div class="flex items-center justify-between h-16">
            {/* Brand/Logo Section */}
            <div class="flex items-center gap-8">
              <div class="flex items-center gap-3">
                <div class="relative">
                  <img src={icon} alt="icon" class="w-9 h-9" />
                </div>
                <span class="text-gray-900 font-bold text-xl tracking-tight">
                  Airdrop Dashboard
                </span>
              </div>

              {/* Navigation Links */}
              <ul class="flex items-center gap-1">
                <li>
                  <A
                    href="/"
                    class="px-4 py-2 rounded-lg text-gray-600 font-medium hover:bg-gray-100 hover:text-gray-900 transition-all duration-200 no-underline"
                    activeClass="bg-gray-100 text-gray-900 shadow-sm"
                  >
                    Home
                  </A>
                </li>
                <li>
                  <A
                    href="/about"
                    class="px-4 py-2 rounded-lg text-gray-600 font-medium hover:bg-gray-100 hover:text-gray-900 transition-all duration-200 no-underline"
                    activeClass="bg-gray-100 text-gray-900 shadow-sm"
                  >
                    Settings
                  </A>
                </li>
                <li>
                  <A
                    href="/rpc"
                    class="px-4 py-2 rounded-lg text-gray-600 font-medium hover:bg-gray-100 hover:text-gray-900 transition-all duration-200 no-underline"
                    activeClass="bg-gray-100 text-gray-900 shadow-sm"
                  >
                    RPC
                  </A>
                </li>
                <li>
                  <A
                    href="/util"
                    class="px-4 py-2 rounded-lg text-gray-600 font-medium hover:bg-gray-100 hover:text-gray-900 transition-all duration-200 no-underline"
                    activeClass="bg-gray-100 text-gray-900 shadow-sm"
                  >
                    Util
                  </A>
                </li>
              </ul>
            </div>

            {/* Environment Selector */}
            <div class="flex items-center gap-3">
              <span class="text-sm font-medium text-gray-600">Environment:</span>
              <div class="relative">
                <select
                  class="pl-3 pr-8 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-lg hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer transition-colors appearance-none"
                  value={selectedEnv()}
                  onChange={(e) => setSelectedEnv(e.currentTarget.value)}
                >
                  <For each={availableEnvs()}>{(env) => <option value={env}>{env}</option>}</For>
                </select>
                <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                  <svg
                    class="h-4 w-4 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main class="min-h-screen bg-gray-50">
        <Suspense>{props.children}</Suspense>
      </main>
    </>
  );
};

export default App;
