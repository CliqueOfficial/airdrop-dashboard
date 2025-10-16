import { useConfig } from '../hooks/useConfig';

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
      </ul>
    </section>
  );
}
