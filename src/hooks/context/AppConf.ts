import { Accessor, createContext } from 'solid-js';
import { AppConf, Deployment } from '../../types';
import { SetStoreFunction } from 'solid-js/store';

export interface AppConfContextProps {
  appConf: AppConf;
  setAppConf: SetStoreFunction<AppConf>;
  save?: () => Promise<boolean>;
  refetch?: () => Promise<void>;
  deployments?: Accessor<Record<string, Deployment>>;
}

export const AppConfContext = createContext<AppConfContextProps | null>(null);
