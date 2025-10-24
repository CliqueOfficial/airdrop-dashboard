import { createContext } from 'solid-js';
import { AppConf } from '../../types';
import { SetStoreFunction } from 'solid-js/store';

export interface AppConfContextProps {
  appConf: AppConf;
  setAppConf: SetStoreFunction<AppConf>;
  onSave?: () => Promise<boolean>;
}

export const AppConfContext = createContext<AppConfContextProps | null>(null);
