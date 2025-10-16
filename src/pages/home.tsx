import { Show, For, createResource } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useConfig } from '../hooks/useConfig';
import { type AppConf } from '../hooks/useAppConf';

export default function Home() {
  const { config, setCurrentAppId } = useConfig();
  const navigate = useNavigate();

  // Fetch all app configs
  const [allAppConfs] = createResource(
    () => config.baseUrl,
    async (baseUrl: string) => {
      if (!baseUrl || !config.apiKey) return [];

      const response = await fetch(`${baseUrl}/admin/app_conf`, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
        },
      });
      const json = await response.json();
      return json as AppConf[];
    }
  );

  const handleSelectApp = (appId: string) => {
    setCurrentAppId(appId);
    navigate('/new');
  };

  return (
    <section class="bg-gray-100 text-gray-700 p-8">
      <div class="mb-6">
        <h1 class="text-3xl font-bold mb-2">Applications</h1>
        <p class="text-gray-600">Select an application to view and edit its configuration</p>
      </div>

      <Show when={allAppConfs.loading}>
        <div class="flex justify-center items-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Show>

      <Show when={!allAppConfs.loading && allAppConfs()}>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <For each={allAppConfs()}>
            {(app: AppConf) => (
              <div
                onClick={() => handleSelectApp(app.appId)}
                class="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer p-6 border border-gray-200 hover:border-blue-500"
              >
                <div class="mb-4">
                  <h2 class="text-xl font-semibold text-gray-800 mb-2">{app.appId}</h2>
                  <div class="flex gap-2 flex-wrap">
                    <Show when={app.gated}>
                      <span class="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                        Gated
                      </span>
                    </Show>
                    <Show when={app.uniqueDevice}>
                      <span class="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                        Unique Device
                      </span>
                    </Show>
                  </div>
                </div>

                <div class="border-t border-gray-200 pt-4">
                  <div class="flex justify-between items-center text-sm">
                    <span class="text-gray-600">Deployments:</span>
                    <span class="font-semibold text-gray-800">
                      {Object.keys(app.deployments).length}
                    </span>
                  </div>
                  <Show when={Object.keys(app.deployments).length > 0}>
                    <div class="mt-2 flex flex-wrap gap-1">
                      <For each={Object.keys(app.deployments).slice(0, 3)}>
                        {(deploymentName) => (
                          <span class="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                            {deploymentName}
                          </span>
                        )}
                      </For>
                      <Show when={Object.keys(app.deployments).length > 3}>
                        <span class="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                          +{Object.keys(app.deployments).length - 3} more
                        </span>
                      </Show>
                    </div>
                  </Show>
                </div>

                <div class="mt-4 pt-4 border-t border-gray-200">
                  <button class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                    View Details →
                  </button>
                </div>
              </div>
            )}
          </For>

          {/* Create New App Card */}
          <div
            onClick={() => navigate('/wizard')}
            class="bg-white rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer p-6 border-2 border-blue-500 hover:border-blue-600 hover:scale-105 transform duration-200"
          >
            <div class="flex flex-col items-center justify-center h-full text-blue-600">
              <div class="mb-4">
                <svg class="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>
              <h2 class="text-2xl font-bold mb-2">Create New App</h2>
              <p class="text-blue-500 text-center text-sm">
                Use the wizard to set up a new application
              </p>
            </div>
          </div>
        </div>

        <Show when={!allAppConfs.loading && (!allAppConfs() || allAppConfs()!.length === 0)}>
          <div class="text-center py-12">
            <div class="text-gray-400 mb-4">
              <svg class="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 class="text-lg font-medium text-gray-900 mb-2">No applications found</h3>
            <p class="text-gray-500">Create your first application to get started</p>
          </div>
        </Show>
      </Show>
    </section>
  );
}
