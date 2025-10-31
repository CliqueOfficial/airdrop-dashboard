import { Accessor, createEffect, createSignal, useContext } from 'solid-js';
import { AppConf } from '../../types';
import { createStore, produce, reconcile, SetStoreFunction, unwrap } from 'solid-js/store';
import { useSearchParams } from '@solidjs/router';
import { AppConfContext } from '../../hooks/context/AppConf';

export default function BasicStep() {
  const [searchParams, setSerachParams] = useSearchParams<{ appId?: string }>();
  const { appConf, setAppConf, save } = useContext(AppConfContext)!;

  createEffect(() => {
    if (!!appConf.appId) {
      save?.();
    }
  });

  return (
    <div class="space-y-6">
      {/* App ID */}
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          App ID <span class="text-red-500">*</span>
        </label>
        <input
          type="text"
          disabled={!!searchParams.appId}
          value={appConf.appId}
          onChange={(e) => setAppConf('appId', e.currentTarget.value)}
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter app ID"
          required
        />
        <p class="mt-1 text-xs text-gray-500">Unique identifier for your application</p>
      </div>

      {/* ToS Template */}
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Terms of Service Template
        </label>
        <textarea
          value={appConf.extra.tosTemplate}
          onChange={(e) => setAppConf('extra', 'tosTemplate', e.currentTarget.value)}
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter ToS template"
          rows="4"
        />
        <p class="mt-1 text-xs text-gray-500">Template for terms of service</p>
      </div>

      {/* ToS Message */}
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Terms of Service Message</label>
        <textarea
          value={appConf.extra.tosMessage}
          onChange={(e) => setAppConf('extra', 'tosMessage', e.currentTarget.value)}
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter ToS message"
          rows="3"
        />
        <p class="mt-1 text-xs text-gray-500">Message to display with terms of service</p>
      </div>

      {/* Gated */}
      <div class="flex items-start">
        <div class="flex items-center h-5">
          <input
            id="gated"
            type="checkbox"
            checked={appConf.gated}
            onChange={(e) => setAppConf('gated', e.currentTarget.checked)}
            class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
        </div>
        <div class="ml-3">
          <label for="gated" class="text-sm font-medium text-gray-700">
            Gated Access
          </label>
          <p class="text-xs text-gray-500">Enable gated access for this application</p>
        </div>
      </div>

      {/* Unique Device */}
      <div class="flex items-start">
        <div class="flex items-center h-5">
          <input
            id="uniqueDevice"
            type="checkbox"
            checked={appConf.uniqueDevice}
            onChange={(e) => setAppConf('uniqueDevice', e.currentTarget.checked)}
            class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
        </div>
        <div class="ml-3">
          <label for="uniqueDevice" class="text-sm font-medium text-gray-700">
            Unique Device
          </label>
          <p class="text-xs text-gray-500">Require unique device for this application</p>
        </div>
      </div>
      <div>
        <label for="partialClaimUrl" class="text-sm font-medium text-gray-700">
          Partial Claim URL
        </label>
        <input
          type="url"
          value={appConf.extra.partialClaim?.url ?? ''}
          onChange={(e) => setAppConf('extra', 'partialClaim', { url: e.currentTarget.value })}
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter partial claim URL"
        />
      </div>
      <div>
        <label for="partialClaimResponseMapping" class="text-sm font-medium text-gray-700">
          Partial Claim Response Mapping
        </label>
        <input
          type="text"
          value={appConf.extra.partialClaim?.responseMapping ?? ''}
          onChange={(e) =>
            setAppConf('extra', 'partialClaim', { responseMapping: e.currentTarget.value })
          }
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter partial claim response mapping"
        />
        <p class="mt-1 text-xs text-gray-500">Response mapping for partial claim</p>
      </div>
    </div>
  );
}
