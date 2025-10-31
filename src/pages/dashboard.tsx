import { useParams, useNavigate } from '@solidjs/router';
import { createSignal, For, Show, Switch, Match, Suspense } from 'solid-js';
import { makePersisted } from '@solid-primitives/storage';
import { useConfig } from '../hooks/useConfig';
import { TbEdit } from 'solid-icons/tb';
import { useAppConf } from '../hooks/useAppConf';
import Deployment from '../components/dashboard/deployment';
import Relayers from '../components/dashboard/relayer';
import Simulator from '../components/dashboard/simulator';
import { AppConfContext } from '../hooks/context/AppConf';

type TabType = 'deployments' | 'relay' | 'batch' | 'simulator';

export default function Dashboard() {
  const { config } = useConfig();
  const { appId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = createSignal<TabType>('deployments');

  const { appConf, deployments, refetch } = useAppConf(() => appId);

  const handleEdit = () => {
    // Navigate to wizard
    navigate(`/wizard?appId=${appId}`);
  };

  const tabs = [
    { id: 'deployments' as TabType, label: 'Deployments Overview' },
    { id: 'relay' as TabType, label: 'Relay Overview' },
    { id: 'batch' as TabType, label: 'Batch Overview' },
    { id: 'simulator' as TabType, label: 'Simulator' },
  ];

  return (
    <div class="min-h-screen bg-gray-50 p-6">
      <div class="max-w-7xl mx-auto">
        <div class="flex items-center gap-3 mb-6">
          <h1 class="text-3xl font-bold text-gray-900">{appId || 'Dashboard'}</h1>
          <button
            onClick={handleEdit}
            class="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit in Wizard"
          >
            <TbEdit size={24} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div class="border-b border-gray-200 mb-6">
          <nav class="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                onClick={() => setActiveTab(tab.id)}
                class={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${
                    activeTab() === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <Suspense>
          <Show when={appConf()}>
            <AppConfContext.Provider
              value={{
                appConf: appConf()!,
                setAppConf: () => {},
                save: () => Promise.resolve(true),
              }}
            >
              <div class="bg-white rounded-lg shadow p-6">
                <Switch>
                  <Match when={activeTab() === 'deployments'}>
                    <For each={Object.entries(deployments())}>
                      {([name, deployment]) => <Deployment name={name} deployment={deployment} />}
                    </For>
                  </Match>

                  <Match when={activeTab() === 'relay'}>
                    <Relayers appId={appId || ''} />
                  </Match>

                  <Match when={activeTab() === 'batch'}>
                    <div>
                      <h2 class="text-xl font-semibold text-gray-900 mb-4">Batch Overview</h2>
                      <p class="text-gray-500">Content coming soon...</p>
                    </div>
                  </Match>

                  <Match when={activeTab() === 'simulator'}>
                    <Simulator />
                  </Match>
                </Switch>
              </div>
            </AppConfContext.Provider>
          </Show>
        </Suspense>
      </div>
    </div>
  );
}
