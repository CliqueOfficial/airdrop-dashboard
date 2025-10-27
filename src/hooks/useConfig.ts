import { useContext } from 'solid-js';
import { ConfigContext } from '../context/ConfigContext';
import { createStore } from 'solid-js/store';
import { makePersisted, storageSync } from '@solid-primitives/storage';

export const useConfig = () => {
  const { baseEnv } = useContext(ConfigContext)!;
  const [config, setConfig] = makePersisted(
    createStore({
      apiKey: '',
      baseUrl: '',
    }),
    {
      name: `dashboard-${baseEnv()}-config`,
      storage: localStorage,
    }
  );

  const setBaseUrl = (baseUrl: string) => {
    setConfig('baseUrl', baseUrl);
  };

  const setApiKey = (apiKey: string) => {
    setConfig('apiKey', apiKey);
  };

  return { config, setBaseUrl, setApiKey };
};
