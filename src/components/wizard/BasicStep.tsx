import { AppConf } from '../../hooks/useAppConf';
import { SetStoreFunction } from 'solid-js/store';

interface BasicStepProps {
  appConf: AppConf;
  setAppConf: SetStoreFunction<AppConf>;
}

export default function BasicStep(props: BasicStepProps) {
  return (
    <div class="space-y-6">
      {/* App ID */}
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          App ID <span class="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={props.appConf.appId}
          onInput={(e) => props.setAppConf('appId', e.currentTarget.value)}
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
          value={props.appConf.extra.tosTemplate}
          onInput={(e) => props.setAppConf('extra', 'tosTemplate', e.currentTarget.value)}
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
          value={props.appConf.extra.tosMessage}
          onInput={(e) => props.setAppConf('extra', 'tosMessage', e.currentTarget.value)}
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
            checked={props.appConf.gated}
            onChange={(e) => props.setAppConf('gated', e.currentTarget.checked)}
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
            checked={props.appConf.uniqueDevice}
            onChange={(e) => props.setAppConf('uniqueDevice', e.currentTarget.checked)}
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
    </div>
  );
}
