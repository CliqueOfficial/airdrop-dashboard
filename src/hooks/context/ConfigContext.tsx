import { makePersisted } from '@solid-primitives/storage';
import { Accessor, createContext, createSignal, JSX } from 'solid-js';
import { createStore, SetStoreFunction } from 'solid-js/store';
import { EnvConfig } from '../../types';

interface ConfigContextProps {
  values: Record<string, EnvConfig>;
  setConfig: SetStoreFunction<Record<string, EnvConfig>>;
  current: Accessor<EnvConfig>;
  selectedEnv: Accessor<string>;
  setSelectedEnv: (env: string) => void;
  availableEnvs: Accessor<string[]>;
}

export const ConfigContext = createContext<ConfigContextProps>({
  values: {
    local: {
      apiKey: '',
      baseUrl: '',
    },
  },
  setConfig: () => {},
  selectedEnv: () => 'local',
  current: () => ({ apiKey: '', baseUrl: '' }),
  setSelectedEnv: (env: string) => {},
  availableEnvs: () => [],
});

const createConfig = (): ConfigContextProps => {
  const [config, setConfig] = makePersisted(
    createStore<Record<string, EnvConfig>>({
      local: {
        apiKey: '',
        baseUrl: '',
      },
    }),
    {
      name: 'dashboard-env-config',
      storage: localStorage,
    }
  );

  const [selectedEnv, setSelectedEnv] = makePersisted(createSignal('local'), {
    name: 'dashboard-selected-env',
    storage: localStorage,
  });

  const availableEnvs = () => Object.keys(config);

  return {
    values: config,
    setConfig,
    current: () => config[selectedEnv()],
    selectedEnv: selectedEnv,
    setSelectedEnv: setSelectedEnv,
    availableEnvs: availableEnvs,
  };
};

export const ConfigProvider = (props: { children: JSX.Element }) => {
  const config = createConfig();
  return <ConfigContext.Provider value={config}>{props.children}</ConfigContext.Provider>;
};
