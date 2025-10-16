import { makePersisted } from '@solid-primitives/storage';
import { Accessor, createContext, createSignal, JSX } from 'solid-js';
import { createStore } from 'solid-js/store';

export const ConfigContext = createContext({
  baseEnv: () => 'local' as string,
  setBaseEnv: (value: string) => {},
});

const createConfig = () => {
  const [baseEnv, setBaseEnv] = makePersisted(createSignal('local'), {
    name: 'dashboard-config',
    storage: localStorage,
  });
  return { baseEnv, setBaseEnv };
};

export const ConfigProvider = (props: { children: JSX.Element }) => {
  const config = createConfig();
  return <ConfigContext.Provider value={config}>{props.children}</ConfigContext.Provider>;
};
