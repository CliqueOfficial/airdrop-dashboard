import { useContext } from "solid-js";
import { ConfigContext } from "../context/ConfigContext";
import { createStore } from "solid-js/store";
import { makePersisted, storageSync } from "@solid-primitives/storage";

export const useConfig = () => {
    const { baseEnv } = useContext(ConfigContext)!;
    const [config, setConfig] = makePersisted(createStore({
        apiKey: '',
        baseUrl: '',
        currentAppId: '',
    }), {
        name: `dashboard-${baseEnv()}-config`,
        storage: localStorage,
    });

    const setBaseUrl = (baseUrl: string) => {
        setConfig('baseUrl', baseUrl);
    }

    const setApiKey = (apiKey: string) => {
        setConfig('apiKey', apiKey);
    }

    const setCurrentAppId = (currentAppId: string) => {
        setConfig('currentAppId', currentAppId);
    }

    return { config, setBaseUrl, setApiKey, setCurrentAppId };
}


interface Deployment {
    chainId: string;
    rpcUrl: string;
    roles: Record<string, string>;
    extra: Record<string, any>;
}


export const useCachedDeployments = () => {
    const [deployments, setDeployments] = makePersisted(createStore<Record<string, Deployment>>({}), { sync: storageSync, name: 'dashboard-deployments-cache'  });
    return { deployments, setDeployments };
}