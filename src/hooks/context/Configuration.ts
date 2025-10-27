import { Accessor, createContext } from 'solid-js';
import { Configuration } from '../../types';

export interface ConfigurationContextProps {
  configurationName: Accessor<string>;
  configuration: Accessor<Configuration>;
}

export const ConfigurationContext = createContext<ConfigurationContextProps | null>(null);
