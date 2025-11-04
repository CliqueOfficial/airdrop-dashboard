import { Accessor, createSignal, Match, Switch, useContext } from 'solid-js';
import EditableListView from '../components/EditableListView';
import { ConfigContext } from '../hooks/context/ConfigContext';
import DefaultHeader from '../components/editable-list-view/DefaultHeader';
import { EnvConfig } from '../types';
import { reconcile } from 'solid-js/store';

export default function About() {
  const { values, setConfig } = useContext(ConfigContext);

  const envs = Object.entries(values);

  const Title = (
    isEditing: Accessor<boolean>,
    setIsEditing: (editing: boolean) => void,
    onConfirm: () => void,
    onCancel: () => void,
    onAdd: () => void,
    canAdd: boolean,
    canEdit: boolean
  ) => (
    <DefaultHeader
      canEdit={() => canEdit}
      canAdd={() => canAdd}
      isEditing={isEditing}
      setIsEditing={setIsEditing}
      handleConfirm={onConfirm}
      handleCancel={onCancel}
      handleAdd={onAdd}
    />
  );

  const handleItemsChanged = (items: [string, EnvConfig][]) => {
    setConfig(reconcile(Object.fromEntries(items)));
  };

  return (
    <EditableListView
      title={Title}
      items={envs}
      onItemsChange={handleItemsChanged}
      createView={(onItemCreated, onCancel) => (
        <EnvCreateView onItemCreated={onItemCreated} onCancel={onCancel} />
      )}
    >
      {([name, config], index, isEditing, updateItem) => (
        <EditableEnvCard
          name={name}
          config={config}
          index={index}
          isEditing={isEditing}
          updateItem={updateItem}
        />
      )}
    </EditableListView>
  );
}

interface EditableEnvCardProps {
  name: string;
  config: EnvConfig;
  index: number;
  isEditing: boolean;
  updateItem: (updates: [string, EnvConfig]) => void;
}

function EditableEnvCard(props: EditableEnvCardProps) {
  const handleValueChange = (key: keyof EnvConfig, value: string) => {
    props.updateItem([props.name, { ...props.config, [key]: value }]);
  };

  return (
    <Switch>
      <Match when={props.isEditing}>
        <div class="bg-white border border-blue-200 rounded-lg p-6 shadow-sm">
          <div class="space-y-4">
            {/* Environment Name */}
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Environment Name
              </label>
              <div class="px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
                <span class="font-mono text-gray-900">{props.name}</span>
              </div>
            </div>

            {/* Base URL */}
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Base URL
              </label>
              <input
                type="text"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="https://api.example.com"
                value={props.config.baseUrl}
                onChange={(e) => handleValueChange('baseUrl', e.target.value)}
              />
            </div>

            {/* API Key */}
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                API Key
              </label>
              <input
                type="password"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono"
                placeholder="Enter API key"
                value={props.config.apiKey}
                onChange={(e) => handleValueChange('apiKey', e.target.value)}
              />
            </div>
          </div>
        </div>
      </Match>
      <Match when={!props.isEditing}>
        <div class="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div class="space-y-4">
            {/* Environment Name */}
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-green-500"></div>
              <h3 class="text-lg font-semibold text-gray-900">{props.name}</h3>
            </div>

            {/* Base URL */}
            <div class="space-y-1">
              <span class="text-xs font-medium text-gray-500 uppercase">Base URL</span>
              <div class="px-3 py-2 bg-gray-50 rounded border border-gray-200">
                <span class="text-sm font-mono text-gray-700 break-all">
                  {props.config.baseUrl || <span class="text-gray-400 italic">Not set</span>}
                </span>
              </div>
            </div>

            {/* API Key */}
            <div class="space-y-1">
              <span class="text-xs font-medium text-gray-500 uppercase">API Key</span>
              <div class="px-3 py-2 bg-gray-50 rounded border border-gray-200">
                <span class="text-sm font-mono text-gray-700">
                  {props.config.apiKey ? '••••••••••••••••' : <span class="text-gray-400 italic">Not set</span>}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Match>
    </Switch>
  );
}

interface EnvCreateViewProps {
  onItemCreated: (item: [string, EnvConfig]) => void;
  onCancel: () => void;
}

function EnvCreateView(props: EnvCreateViewProps) {
  const [name, setName] = createSignal('');
  const [baseUrl, setBaseUrl] = createSignal('');
  const [apiKey, setApiKey] = createSignal('');

  const handleConfirm = () => {
    if (!name().trim()) {
      alert('Please enter an environment name');
      return;
    }
    props.onItemCreated([name(), { baseUrl: baseUrl(), apiKey: apiKey() }]);
    // Reset form
    setName('');
    setBaseUrl('');
    setApiKey('');
  };

  const handleCancel = () => {
    setName('');
    setBaseUrl('');
    setApiKey('');
    props.onCancel();
  };

  const isValid = () => name().trim().length > 0;

  return (
    <div class="bg-white border border-blue-300 rounded-lg p-6 shadow-md">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Add New Environment</h3>

      <div class="space-y-4">
        {/* Environment Name */}
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Environment Name <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            placeholder="e.g., production, staging, dev"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
          />
        </div>

        {/* Base URL */}
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Base URL
          </label>
          <input
            type="text"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            placeholder="https://api.example.com"
            value={baseUrl()}
            onInput={(e) => setBaseUrl(e.currentTarget.value)}
          />
        </div>

        {/* API Key */}
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            API Key
          </label>
          <input
            type="password"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono"
            placeholder="Enter API key"
            value={apiKey()}
            onInput={(e) => setApiKey(e.currentTarget.value)}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div class="flex items-center gap-3 mt-6 pt-4 border-t border-gray-200">
        <button
          onClick={handleConfirm}
          disabled={!isValid()}
          class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
        >
          Add Environment
        </button>
        <button
          onClick={handleCancel}
          class="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
