import { useParams, useNavigate } from '@solidjs/router';
import { createSignal } from 'solid-js';
import { makePersisted } from '@solid-primitives/storage';
import { useConfig } from '../hooks/useConfig';
import { TbEdit } from 'solid-icons/tb';

type TabType = 'deployments' | 'relay' | 'batch';

export default function Dashboard() {
  const { config } = useConfig();
  const { appId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = createSignal<TabType>('deployments');
  
  // Persisted signal to track in-progress app ID (same as wizard)
  const [wizardInProgressAppId, setWizardInProgressAppId] = makePersisted(createSignal(''), {
    name: 'wizard-in-progress-app-id',
    storage: localStorage,
  });

  const handleEdit = () => {
    // Set the wizard in-progress app ID to current appId
    setWizardInProgressAppId(appId || '');
    // Navigate to wizard
    navigate('/wizard');
  };

  const tabs = [
    { id: 'deployments' as TabType, label: 'Deployments Overview' },
    { id: 'relay' as TabType, label: 'Relay Overview' },
    { id: 'batch' as TabType, label: 'Batch Overview' },
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
        <div class="bg-white rounded-lg shadow p-6">
          {activeTab() === 'deployments' && (
            <div>
              <h2 class="text-xl font-semibold text-gray-900 mb-4">Deployments Overview</h2>
              <p class="text-gray-500">Content coming soon...</p>
            </div>
          )}

          {activeTab() === 'relay' && (
            <div>
              <h2 class="text-xl font-semibold text-gray-900 mb-4">Relay Overview</h2>
              <p class="text-gray-500">Content coming soon...</p>
            </div>
          )}

          {activeTab() === 'batch' && (
            <div>
              <h2 class="text-xl font-semibold text-gray-900 mb-4">Batch Overview</h2>
              <p class="text-gray-500">Content coming soon...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
