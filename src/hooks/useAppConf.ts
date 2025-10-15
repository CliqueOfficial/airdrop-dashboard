import { createResource } from "solid-js";
import { useConfig } from "./useConfig";

export interface AppConf {
    appId: string;
    deployments: Record<string, Deployment>;
    gated: boolean;
    uniqueDevice: boolean;
    extra: Record<string, any>;
}

export interface Deployment {
    chainId: string;
    rpcUrl: string;
    roles: Record<string, string>;
    extra: Record<string, any>;
}

export const useAppConf = () => {
    const { config } = useConfig();

    const [data, { refetch}] = createResource(() => config.baseUrl, async (baseUrl: string) => {
        const data = await fetch(`${baseUrl}/admin/app_conf`, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': config.apiKey,
            },
        })
        const json = await data.json();
        return json as AppConf[];
    })

    return {
        loading: () => data.loading,
        isCreaing: () => data()?.find((appConf) => appConf.appId === config.currentAppId) !== undefined,
        appConf: () => data()?.find((appConf) => appConf.appId === config.currentAppId),
        refetch: refetch,
    }
}