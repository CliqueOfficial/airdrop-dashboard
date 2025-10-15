import { Accessor, createEffect, createResource, createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import { Input } from '../components/Input';
import { InputButton } from '../components/InputButton';
import { makePersisted, storageSync } from '@solid-primitives/storage';
import { useCachedDeployments, useConfig } from '../hooks/useConfig';

export default function Home() {
  const { config, setCurrentAppId } = useConfig();
  const { deployments: cached, setDeployments: setCachedDeployments } = useCachedDeployments();
  const fetchDeployments = async (appId: string) => {
    const data = await fetch(`${config.baseUrl}/admin/app_conf/${appId}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      },
    })
    const json = await data.json();
    console.log(json);
    return json;
  }

  createEffect(() => {

  })


  const createAppConf = async () => {
    const payload = {
      deployments: cached,
      gated: false,
      uniqueDevice: false,
      extra: {},
    }

    const response = await fetch(`${config.baseUrl}/admin/app_conf/${config.currentAppId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log(data);
  }


  return (
    <section class="bg-gray-100 text-gray-700 p-8">
      <h1 class="text-2xl font-bold">Application</h1>
      <Input
        label="App ID"
        value={() => config.currentAppId}
        onChange={setCurrentAppId}
      />

    </section>
  );
}
