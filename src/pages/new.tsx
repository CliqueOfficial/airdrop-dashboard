import { createSignal, Show } from 'solid-js';
import { Input } from '../components/Input';
import { useCurrentAppConf } from '../hooks/useAppConf';
import { useConfig } from '../hooks/useConfig';

import { DeploymentCard } from '../components/DeploymentCard';
import { BatchUploadForm } from '../components/BatchUploadForm';

export default function New() {
  const { config } = useConfig();
  const {
    loading,
    appConf,
    appRoot,
    setDeployment,
    setGated,
    setUniqueDevice,
    setTosTemplate,
    setTosMessage,
  } = useCurrentAppConf();
  const [showBatchUpload, setShowBatchUpload] = createSignal(false);

  const createAppConf = async () => {
    const payload = {
      deployments: appConf.deployments,
      gated: appConf.gated,
      uniqueDevice: appConf.uniqueDevice,
      extra: appConf.extra,
    };

    const response = await fetch(`${config.baseUrl}/admin/app_conf/${appConf.appId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log(data);
  };
  return (
    <Show when={!loading()}>
      <section class="bg-gray-100 text-gray-700 p-8">
        <h1 class="text-2xl font-bold">Project</h1>
        <h2 class="text-lg font-bold pt-4 pb-4">Basic</h2>
        <Input label="App ID" value={() => appConf.appId} />

        <h2 class="text-lg font-bold pt-4 pb-4">Others</h2>
        <div class="flex items-center gap-4 mb-4">
          <label class="flex items-center gap-2">
            <input
              type="checkbox"
              checked={appConf.gated}
              onChange={(e) => setGated(e.target.checked)}
              class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <span class="text-sm font-medium">Gated</span>
          </label>
          <label class="flex items-center gap-2">
            <input
              type="checkbox"
              checked={appConf.uniqueDevice}
              onChange={(e) => setUniqueDevice(e.target.checked)}
              class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <span class="text-sm font-medium">Unique Device</span>
          </label>
        </div>

        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">TOS Template</label>
          <textarea
            value={appConf.extra.tosTemplate || ''}
            onChange={(e) => setTosTemplate(e.target.value)}
            placeholder="Enter TOS template content..."
            class="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 resize-vertical min-h-[100px]"
          />
        </div>

        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">TOS Message</label>
          <textarea
            value={appConf.extra.tosMessage || ''}
            onChange={(e) => setTosMessage(e.target.value)}
            placeholder="Enter TOS message content..."
            class="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 resize-vertical min-h-[100px]"
          />
        </div>

        <h2 class="text-lg font-bold pt-4 pb-4">Deployments</h2>
        {Object.entries(appConf.deployments).map(([key, deployment]) => (
          <DeploymentCard name={key} deployment={deployment} roots={appRoot} />
        ))}

        <div class="mt-8 flex justify-end">
          <button
            onClick={createAppConf}
            class="px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            Update
          </button>
        </div>

        <h1 class="text-2xl font-bold">Batch Configuration</h1>

        {/* Display root data */}
        <div class="mt-6">
          <h3 class="text-lg font-semibold mb-4">Root Configuration</h3>
          {appRoot() ? (
            <div class="bg-white p-4 rounded-lg border border-gray-300">
              <div class="space-y-2">
                {Object.entries(appRoot()).map(([key, value]) => (
                  <div class="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                    <span class="font-medium text-gray-700">{key}:</span>
                    <span class="text-gray-600">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div class="bg-gray-50 p-4 rounded-lg border border-gray-300 text-gray-500">
              No root configuration available
            </div>
          )}
        </div>

        {/* Upload Batch Button */}
        <div class="mt-6">
          <button
            onClick={() => setShowBatchUpload(!showBatchUpload())}
            class="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {showBatchUpload() ? 'Hide Upload Form' : 'Upload Batch'}
          </button>
        </div>

        {/* Batch Upload Form */}
        {showBatchUpload() && (
          <div class="mt-6">
            <BatchUploadForm />
          </div>
        )}
      </section>
    </Show>
  );
}
