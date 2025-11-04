import { useContext } from 'solid-js';
import { ConfigContext } from './context/ConfigContext';
import { createStore } from 'solid-js/store';
import { makePersisted, storageSync } from '@solid-primitives/storage';

export const useConfig = () => {
  const { values, current, selectedEnv, setSelectedEnv, setConfig } = useContext(ConfigContext)!;

  return { config: current(), setSelectedEnv, selectedEnv, values, setConfig };
};
