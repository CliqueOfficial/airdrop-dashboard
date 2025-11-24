import {
  For,
  createSignal,
  Show,
  createMemo,
  createResource,
  Accessor,
  useContext,
  createEffect,
} from 'solid-js';
import type { AppConf, Configuration, Deployment, Strategy } from '../../types';
import { SetStoreFunction, createStore, produce } from 'solid-js/store';
import TabView from '../TabView';
import { DeploymentContext } from '../../hooks/context/Deployment';
import ConfigurationPanel from './configuration/ConfigurationPanel';
import EditableListView from '../EditableListView';
import { AppConfContext } from '../../hooks/context/AppConf';
import DefaultHeader from '../editable-list-view/DefaultHeader';

export default function StrategyStep() {
  const { appConf, setAppConf, save: onSave } = useContext(AppConfContext)!;
  const [deployments, setDeployments] = createStore(appConf.deployments);

  const availableRoots = () => appConf.extra.root;

  const tabs = () =>
    Object.entries(deployments)
      .filter(([_, deploymentData]) => !deploymentData.chainId.startsWith('sol:'))
      .map(([deployment, deploymentData]) => ({
        id: deployment,
        label: deployment,
        data: deploymentData,
      }));
  return (
    <TabView tabs={tabs()}>
      {(tab) => (
        <DeploymentContext.Provider
          value={{
            contractAddress: () => deployments[tab.id].roles.contract as `0x${string}`,
            chainId: () => BigInt(deployments[tab.id].chainId),
            rpcUrl: () => deployments[tab.id].rpcUrl,
            appId: () => appConf.appId,
            deployment: () => tab.id,
            roles: () => deployments[tab.id].roles as Record<string, `0x${string}`>,
            configurationNames: () => Object.keys(deployments[tab.id].extra.configurations || {}),
          }}
        >
          <DeploymentStrategyPanel
            appId={appConf.appId}
            name={tab.id}
            deployment={deployments[tab.id]}
            setDeployment={(deployment) => setDeployments(tab.id, deployment)}
            roots={availableRoots()}
          />
        </DeploymentContext.Provider>
      )}
    </TabView>
  );
}

interface DeploymentStrategyPanelProps {
  appId: string;
  name: string;
  deployment: Deployment;
  setDeployment: (deployment: Deployment) => void;
  roots: Record<string, string>;
}

function DeploymentStrategyPanel(props: DeploymentStrategyPanelProps) {
  const [configurations, setConfigurations] = createStore<Record<string, Configuration>>(
    props.deployment.extra.configurations
  );

  const { save } = useContext(AppConfContext)!;

  return (
    <EditableListView
      title={(isEditing, setIsEditing, onConfirm, onCancel, onAdd, canAdd, canEdit) => (
        <DefaultHeader
          canEdit={() => canEdit}
          canAdd={() => canAdd}
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          handleConfirm={onConfirm}
          handleCancel={onCancel}
          handleAdd={onAdd}
        />
      )}
      items={Object.entries(configurations)}
      createView={(onItemCreated, onCancel) => (
        <ConfigurationCreateView onItemCreated={onItemCreated} onCancel={onCancel} />
      )}
      onItemsChange={(items) => {
        const configurations: Record<string, Configuration> = {};
        items.forEach(([name, configuration]) => {
          configurations[name] = configuration;
        });
        setConfigurations(configurations);
        if (save) {
          save();
        }
      }}
    >
      {([name, configuration], index, isEditing, updateItem) => (
        <Show when={configuration}>
          <ConfigurationPanel
            name={name}
            configuration={configuration}
            setConfiguration={(configuration) => {
              setConfigurations(name, configuration);
            }}
            isEditing={isEditing}
            updateItem={updateItem}
          />
        </Show>
      )}
    </EditableListView>
  );
}

interface ConfigurationCreateViewProps {
  onItemCreated: (item: [string, Configuration]) => void;
  onCancel: () => void;
}

function ConfigurationCreateView(props: ConfigurationCreateViewProps) {
  const [configurationName, setConfigurationName] = createSignal('');

  const handleConfirm = () => {
    const name = configurationName().trim();
    if (name) {
      props.onItemCreated([
        name,
        {
          strategy: [],
          fallbackIdx: '0',
          deployed: false,
        },
      ]);
      setConfigurationName('');
    }
  };

  const handleCancel = () => {
    setConfigurationName('');
    props.onCancel();
  };

  return (
    <div class="space-y-3">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Configuration Name</label>
        <input
          type="text"
          placeholder="Enter configuration name"
          value={configurationName()}
          onInput={(e) => setConfigurationName(e.currentTarget.value)}
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div class="flex gap-2 justify-end">
        <button
          class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md transition-colors text-sm"
          onClick={handleCancel}
        >
          Cancel
        </button>
        <button
          class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors text-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
          onClick={handleConfirm}
          disabled={!configurationName().trim()}
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
