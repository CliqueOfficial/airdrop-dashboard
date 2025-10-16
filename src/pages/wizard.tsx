import { createSignal, For, onMount, onCleanup, createEffect, createResource } from 'solid-js';
import BasicStep from '../components/wizard/BasicStep';
import DeploymentStep from '../components/wizard/DeploymentStep';
import RelayerStep from '../components/wizard/RelayerStep';
import UploadBatchStep from '../components/wizard/UploadBatchStep';
import { createStore } from 'solid-js/store';
import { AppConf } from '../hooks/useAppConf';
import { useConfig } from '../hooks/useConfig';
import { useNavigate } from '@solidjs/router';
import { makePersisted } from '@solid-primitives/storage';

const STEPS = [
  {
    name: 'Basic',
    title: 'Basic Information',
    description: 'Set up basic configuration',
  },
  {
    name: 'Relayer',
    title: 'Relayer Settings',
    description: 'Configure relayer options',
  },
  {
    name: 'Upload Batch',
    title: 'Upload Batch',
    description: 'Upload recipient addresses and amounts',
  },
  {
    name: 'Deployment',
    title: 'Deployment Settings',
    description: 'Configure deployment options',
  },
];

export default function Wizard() {
  const { config } = useConfig();
  const navigate = useNavigate();

  // Persisted signal to track in-progress app ID
  const [wizardInProgressAppId, setWizardInProgressAppId] = makePersisted(createSignal(''), {
    name: 'wizard-in-progress-app-id',
    storage: localStorage,
  });

  const [appConf, setAppConf] = createStore<AppConf>({
    appId: '',
    deployments: {},
    gated: false,
    uniqueDevice: false,
    extra: {
      root: {},
      tosTemplate: '',
      tosMessage: '',
    },
  });

  const [currentStep, setCurrentStep] = createSignal(0);
  const [showDebug, setShowDebug] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);
  const [saveError, setSaveError] = createSignal<string | null>(null);
  const [saveSuccess, setSaveSuccess] = createSignal(false);
  const [loadedInProgressAppId, setLoadedInProgressAppId] = createSignal<string | null>(null);

  // Auto-load in-progress app conf from remote using createResource
  const [inProgressData, { refetch }] = createResource(
    () => wizardInProgressAppId(),
    async (inProgressAppId) => {
      if (!inProgressAppId) return null;

      const response = await fetch(`${config.baseUrl}/admin/app_conf/${inProgressAppId}`, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
        },
      });

      if (response.ok) {
        const remoteAppConf = (await response.json()) as AppConf;
        console.log('Loaded in-progress app conf from remote:', remoteAppConf);

        // Process and set appConf directly
        const deployments = Object.entries(remoteAppConf.deployments || {}).map(([key, value]) => {
          if (!value.extra) value.extra = {};
          if (!('root' in value.extra)) value.extra.root = {};
          if (!('configurations' in value.extra)) value.extra.configurations = {};
          return [key, value];
        });

        setAppConf({
          appId: remoteAppConf.appId,
          deployments: Object.fromEntries(deployments),
          gated: remoteAppConf.gated || false,
          uniqueDevice: remoteAppConf.uniqueDevice || false,
          extra: {
            root: remoteAppConf.extra?.root || {},
            tosTemplate: remoteAppConf.extra?.tosTemplate || '',
            tosMessage: remoteAppConf.extra?.tosMessage || '',
          },
        });

        // Show success message
        setLoadedInProgressAppId(inProgressAppId);
        // Hide success message after 5 seconds
        setTimeout(() => setLoadedInProgressAppId(null), 5000);

        return remoteAppConf;
      } else if (response.status === 404) {
        // App was deleted or doesn't exist, clear the persisted value
        console.log('In-progress app not found, clearing persisted value');
        setWizardInProgressAppId('');
        return null;
      }

      throw new Error('Failed to load in-progress app conf');
    }
  );

  // Keyboard event handler for Ctrl+Shift+H
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === 'H') {
      e.preventDefault();
      console.log('Debug panel toggled:', !showDebug());
      setShowDebug(!showDebug());
    }
  };

  onMount(() => {
    console.log('Wizard mounted, keyboard listener attached');
    window.addEventListener('keydown', handleKeyPress);
  });

  onCleanup(() => {
    window.removeEventListener('keydown', handleKeyPress);
  });

  const isFirstStep = () => currentStep() === 0;
  const isLastStep = () => currentStep() === STEPS.length - 1;

  // Save appConf to backend
  const saveAppConf = async () => {
    if (!appConf.appId) {
      setSaveError('App ID is required');
      return false;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const payload = {
        deployments: appConf.deployments,
        gated: appConf.gated,
        uniqueDevice: appConf.uniqueDevice,
        extra: appConf.extra,
      };

      const response = await fetch(`${config.baseUrl}/admin/app_conf/${appConf.appId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to save: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('AppConf saved:', data);
      setSaveSuccess(true);
      // Hide success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
      return true;
    } catch (error) {
      console.error('Error saving appConf:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save configuration');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const nextStep = async () => {
    // Save before moving to next step
    const saved = await saveAppConf();
    if (saved && !isLastStep()) {
      // Persist app ID after first step
      if (currentStep() === 0 && appConf.appId) {
        setWizardInProgressAppId(appConf.appId);
        console.log('Saved in-progress app ID:', appConf.appId);
      }
      setCurrentStep(currentStep() + 1);
    }
  };

  const finishWizard = async () => {
    const saved = await saveAppConf();
    if (saved) {
      // Clear in-progress app ID
      setWizardInProgressAppId('');
      console.log('Cleared in-progress app ID');
      // Navigate to home or new page after successful save
      navigate('/home');
    }
  };

  const prevStep = () => {
    if (!isFirstStep()) {
      setCurrentStep(currentStep() - 1);
    }
  };

  const goToStep = (index: number) => {
    if (index >= 0 && index < STEPS.length) {
      setCurrentStep(index);
    }
  };

  return (
    <section class="bg-gray-100 min-h-screen p-8">
      <div class="max-w-4xl mx-auto">
        {/* Loading in-progress app */}
        {inProgressData.loading && (
          <div class="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div class="flex items-center gap-2 text-blue-800">
              <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span class="font-medium">Loading in-progress configuration...</span>
            </div>
          </div>
        )}

        {/* Error loading in-progress app */}
        {inProgressData.error && (
          <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div class="flex items-center gap-2 text-red-800">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clip-rule="evenodd"
                />
              </svg>
              <span class="text-sm">Failed to load in-progress configuration</span>
            </div>
          </div>
        )}

        {/* Successfully loaded in-progress app */}
        {loadedInProgressAppId() && (
          <div class="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-green-800">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clip-rule="evenodd"
                  />
                </svg>
                <span class="font-medium">
                  Restored in-progress configuration for: {loadedInProgressAppId()}
                </span>
              </div>
              <button
                onClick={() => setLoadedInProgressAppId(null)}
                class="text-green-600 hover:text-green-800 transition-colors"
                title="Dismiss"
              >
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Step Bar */}
        <div class="bg-white rounded-lg shadow-md p-6 mb-8">
          <div class="flex items-center justify-between">
            <For each={STEPS}>
              {(step, index) => (
                <>
                  <div class="flex flex-col items-center flex-1">
                    <button
                      onClick={() => goToStep(index())}
                      class={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-200 ${
                        index() === currentStep()
                          ? 'bg-blue-600 text-white scale-110'
                          : index() < currentStep()
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-gray-300 text-gray-600 hover:bg-gray-400'
                      }`}
                    >
                      {index() < currentStep() ? '✓' : index() + 1}
                    </button>
                    <div class="mt-2 text-center">
                      <div
                        class={`text-sm font-medium ${
                          index() === currentStep() ? 'text-blue-600' : 'text-gray-700'
                        }`}
                      >
                        {step.name}
                      </div>
                    </div>
                  </div>
                  {index() < STEPS.length - 1 && (
                    <div class="flex-1 h-1 mx-4 mb-8">
                      <div
                        class={`h-full rounded transition-all duration-300 ${
                          index() < currentStep() ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      />
                    </div>
                  )}
                </>
              )}
            </For>
          </div>
        </div>

        {/* Step Content */}
        <div class="bg-white rounded-lg shadow-md p-8 mb-6">
          <h2 class="text-2xl font-bold text-gray-800 mb-2">{STEPS[currentStep()].title}</h2>
          <p class="text-gray-600 mb-6">{STEPS[currentStep()].description}</p>

          {/* Content area for each step */}
          <div class="min-h-[300px] py-4">
            {currentStep() === 0 && <BasicStep appConf={appConf} setAppConf={setAppConf} />}
            {currentStep() === 1 && <RelayerStep appConf={appConf} setAppConf={setAppConf} />}
            {currentStep() === 2 && (
              <UploadBatchStep
                appConf={appConf}
                setAppConf={setAppConf}
                onSave={saveAppConf}
                onRefetch={refetch}
              />
            )}
            {currentStep() === 3 && (
              <DeploymentStep appConf={appConf} setAppConf={setAppConf} onSave={saveAppConf} />
            )}
          </div>
        </div>

        {/* Success Message */}
        {saveSuccess() && (
          <div class="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div class="flex items-center gap-2 text-green-800">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clip-rule="evenodd"
                />
              </svg>
              <span class="font-medium">Configuration saved successfully!</span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {saveError() && (
          <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div class="flex items-center gap-2 text-red-800">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clip-rule="evenodd"
                />
              </svg>
              <span class="font-medium">{saveError()}</span>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div class="flex justify-between">
          <button
            onClick={prevStep}
            disabled={isFirstStep() || isSaving()}
            class={`px-6 py-2 rounded-lg font-medium transition-all ${
              isFirstStep() || isSaving()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gray-600 text-white hover:bg-gray-700'
            }`}
          >
            Previous
          </button>
          <button
            onClick={isLastStep() ? finishWizard : nextStep}
            disabled={isSaving()}
            class={`px-6 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 min-w-[100px] ${
              isSaving()
                ? 'bg-blue-400 text-white cursor-wait'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isSaving() ? (
              <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : isLastStep() ? (
              'Finish'
            ) : (
              'Next'
            )}
          </button>
        </div>

        {/* Debug Panel - Toggle with Ctrl+Shift+H */}
        {showDebug() && (
          <div class="mt-8 bg-gray-900 rounded-lg shadow-lg p-6">
            <div class="flex justify-between items-center mb-3">
              <h3 class="text-sm font-semibold text-green-400 font-mono">Debug: appConf</h3>
              <button
                onClick={() => setShowDebug(false)}
                class="text-gray-400 hover:text-white transition-colors"
              >
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <textarea
              value={JSON.stringify(appConf, null, 2)}
              readOnly
              class="w-full h-96 px-4 py-3 bg-gray-800 text-green-300 font-mono text-xs rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              spellcheck={false}
            />
            <p class="mt-2 text-xs text-gray-500 font-mono">
              Press Ctrl+Shift+H to toggle this debug panel
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
