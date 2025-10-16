import { createMemo } from 'solid-js';
import { useConfig } from '../hooks/useConfig';
import { getContractAddress } from 'viem';

export default function About() {
  const { config, setBaseUrl, setApiKey } = useConfig();
  return (
    <section class="bg-gray-100 text-gray-700 p-8">
      <ul>
        <li>
          <div>
            <span>Base URL:</span>
            <input
              class="w-75px p-1 bg-white text-sm rounded-lg"
              type="text"
              value={config.baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>
        </li>
        <li>
          <div>
            <span>API KEY:</span>
            <input
              class="w-75px p-1 bg-white text-sm rounded-lg"
              type="text"
              value={config.apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
        </li>
        <li>
          {getContractAddress({
            from: '0xd6c97B99E53E282A79684a7F3c7dcA72bFa68EfC' as `0x${string}`,
            nonce: 1n,
          })}
        </li>
      </ul>
    </section>
  );
}
