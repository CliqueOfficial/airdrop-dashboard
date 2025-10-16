import { createResource } from 'solid-js';
import { useConfig } from '../hooks/useConfig';
import { Input } from '../components/Input';

export const Dashboard = () => {
  const { config, setCurrentAppId } = useConfig();
  const [appConfs] = createResource(
    () => config.baseUrl,
    async (baseUrl: string) => {
      const data = await fetch(`${baseUrl}/admin/app_conf`, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
        },
      });
      const json = await data.json();
      return json;
    }
  );

  const deployements = (appId: string) =>
    appConfs.loading ? {} : appConfs().find((appConf: any) => appConf.appId === appId)?.deployments;
  const appIds = () => (appConfs.loading ? [] : appConfs().map((appConf: any) => appConf.appId));

  return (
    <section class="bg-gray-100 text-gray-700 p-8">
      <div>
        <h1 class="text-2xl font-bold inline">Dashboard</h1>
        <select
          id="app-select"
          class="inline ml-4 border-b border-gray-300  p-1"
          value={config.currentAppId}
          onChange={(e) => setCurrentAppId(e.target.value)}
        >
          {appIds().map((appId: string) => (
            <option value={appId}>{appId}</option>
          ))}
        </select>
      </div>

      <div>
        <h2 class="text-lg font-bold mt-4 mb-4">Deployments Configuration</h2>
        {Object.entries(deployements(config.currentAppId)).map(([key, deployment]: any, index) => (
          <div class="border border-gray-300 pb-4 ml-4 mr-4 rounded-md">
            <h3 class="text-lg font-bold pt-4 pl-4">{key}</h3>
            <div class="ml-4 mr-4">
              <Input
                key={`deployment-${key}-chainId`}
                label="Chain ID"
                value={() => deployment.chainId}
              />
              <Input
                key={`deployment-${key}-rpcUrl`}
                label="Rpc Url"
                value={() => deployment.rpcUrl}
              />
              <h4>Roles</h4>
              <Input
                key={`deployment-${key}-contract`}
                label="Contract"
                value={() => deployment.roles?.['contract'] ?? ''}
              />
            </div>
          </div>
        ))}
      </div>
      {/* <button
                class='w-full p-1 text-sm rounded-lg ml-2 mt-4 bg-green-500 text-white'
                onClick={async () => {
                    await createAppConf();
                }}
            >
                Create
            </button> */}

      <h2 class="text-lg font-bold">Batch Configration</h2>
    </section>
  );
};
