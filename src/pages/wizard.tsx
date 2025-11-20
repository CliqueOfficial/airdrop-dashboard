import {
  createSignal,
  For,
  onMount,
  onCleanup,
  createEffect,
  createResource,
  Show,
  Suspense,
} from 'solid-js';
import BasicStep from '../components/wizard/BasicStep';
import DeploymentStep from '../components/wizard/DeploymentStep';
import RelayerStep from '../components/wizard/RelayerStep';
import UploadBatchStep from '../components/wizard/UploadBatchStep';
import HooksStep from '../components/wizard/HooksStep';
import StrategyStep from '../components/wizard/StrategyStep';
import ApplyStrategyStep from '../components/wizard/ApplyStrategyStep';
import ConfigureFeeStep from '../components/wizard/ConfigureFeeStep';
import { createStore } from 'solid-js/store';
import { AppConf } from '../types';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { ImSpinner8 } from 'solid-icons/im';
import { BsX } from 'solid-icons/bs';
import { AppConfContext } from '../hooks/context/AppConf';
import { useAppConf } from '../hooks/useAppConf';

const STEPS = [
  {
    name: 'Basic',
    title: 'Basic Information',
    description: 'Set up basic configuration',
    validate: (appConf: AppConf) => /^[a-zA-Z0-9_-]+$/.test(appConf.appId),
  },
  {
    name: 'Relayer',
    title: 'Relayer Settings',
    description: 'Configure relayer options',
    validate: (appConf: AppConf) => true,
  },
  {
    name: 'Upload Batch',
    title: 'Upload Batch',
    description: 'Upload recipient addresses and amounts',
    validate: (appConf: AppConf) => true,
  },
  {
    name: 'Deployment',
    title: 'Deployment Settings',
    description: 'Configure deployment options',
    validate: (appConf: AppConf) =>
      Object.values(appConf.deployments).every(
        (deployment) => !!(deployment.chainId && deployment.rpcUrl)
      ),
  },
  {
    name: 'Hooks',
    title: 'Hooks Configuration',
    description: 'Configure hooks for your deployments',
    validate: (appConf: AppConf) => true,
  },
  {
    name: 'Strategy',
    title: 'Distribution Strategy',
    description: 'Configure token distribution strategy',
    validate: (appConf: AppConf) => true,
  },
  {
    name: 'Apply Strategy',
    title: 'Apply Strategy to Batch',
    description: 'Bind batch roots to configurations',
    validate: (appConf: AppConf) => true,
  },
  {
    name: 'Configure Fee',
    title: 'Configure Fee',
    description: 'Configure fee settings for your airdrop',
    validate: (appConf: AppConf) => true,
  },
];

export default function Wizard() {
  const navigate = useNavigate();

  const [searchParams, setSerachParams] = useSearchParams<{ appId?: string }>();
  const { appConf: remoteAppConf, update, refetch } = useAppConf(() => searchParams.appId ?? '');
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

  createEffect(() => {
    console.log('remoteAppConf:', remoteAppConf.state);
    if (remoteAppConf()) {
      console.log('Remote appConf:', remoteAppConf());
      setAppConf(remoteAppConf()!);
      console.log('appConf:', appConf);
    }
  });

  const [currentStep, setCurrentStep] = createSignal(0);
  const [showDebug, setShowDebug] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);
  const [saveError, setSaveError] = createSignal<string | null>(null);
  const [saveSuccess, setSaveSuccess] = createSignal(false);
  const [loadedInProgressAppId, setLoadedInProgressAppId] = createSignal<string | null>(null);

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

  const nextStep = async () => {
    // Save before moving to next step
    try {
      if (!isLastStep()) {
        // Persist app ID after first step
        if (currentStep() === 0 && appConf.appId) {
          setSerachParams({ appId: appConf.appId });
          console.log('Saved in-progress app ID:', appConf.appId);
        }
        setCurrentStep(currentStep() + 1);
      }
    } catch (error) {
      console.error('Error updating appConf:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to update appConf');
    }
  };

  const finishWizard = async () => {
    try {
      navigate('/home');
    } catch (error) {
      console.error('Error updating appConf:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to update appConf');
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

  const handOnSave = async () => {
    try {
      await update(appConf);
      return true;
    } catch (error) {
      console.error('Error updating appConf:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to update appConf');
      await new Promise((resolve) =>
        setTimeout(() => {
          setSaveError(null);
          resolve(true);
        }, 3000)
      );
      return false;
    }
  };

  return (
    <AppConfContext.Provider
      value={{
        appConf,
        setAppConf,
        save: handOnSave,
        refetch: async () => {
          await refetch();
        },
        deployments: () => appConf.deployments,
      }}
    >
      <section class="bg-gray-100 min-h-screen p-8">
        <div class="max-w-4xl mx-auto">
          {/* Step Bar */}
          <div class="bg-white rounded-lg shadow-md p-6 mb-8">
            <div class="flex items-start justify-between">
              <For each={STEPS}>
                {(step, index) => (
                  <>
                    <div class="flex flex-col items-center flex-1">
                      <button
                        onClick={() => goToStep(index())}
                        class={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-200 flex-shrink-0 ${
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
                          class={`text-xs font-medium ${
                            index() === currentStep() ? 'text-blue-600' : 'text-gray-700'
                          }`}
                        >
                          {step.name}
                        </div>
                      </div>
                    </div>
                    {index() < STEPS.length - 1 && (
                      <div class="flex-1 h-1 mx-4 mt-5">
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

            <Show when={remoteAppConf.state === 'ready'}>
              <div class="min-h-[300px] py-4">
                {currentStep() === 0 && <BasicStep />}
                {currentStep() === 1 && <RelayerStep appConf={appConf} setAppConf={setAppConf} />}
                {currentStep() === 2 && <UploadBatchStep />}
                {currentStep() === 3 && <DeploymentStep />}
                {currentStep() === 4 && <HooksStep />}
                {currentStep() === 5 && <StrategyStep />}
                {currentStep() === 6 && <ApplyStrategyStep />}
                {currentStep() === 7 && <ConfigureFeeStep />}
              </div>
            </Show>
          </div>

          <Show when={saveSuccess()}>
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
          </Show>

          <Show when={saveError()}>
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
          </Show>

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
              <Show when={!isSaving()} fallback={<ImSpinner8 size={20} class="animate-spin" />}>
                <Show when={isLastStep()} fallback={<span>Next</span>}>
                  <span>Finish</span>
                </Show>
              </Show>
            </button>
          </div>

          {/* Debug Panel - Toggle with Ctrl+Shift+H */}
          <Show when={showDebug()}>
            <div class="mt-8 bg-gray-900 rounded-lg shadow-lg p-6">
              <div class="flex justify-between items-center mb-3">
                <div>
                  <h3 class="text-sm font-semibold text-green-400 font-mono">Debug: appConf</h3>
                  <p class="text-xs text-yellow-400 font-mono mt-1">
                    Current Step: {currentStep()} / {STEPS.length - 1} ({STEPS[currentStep()].name})
                  </p>
                </div>
                <button
                  onClick={() => setShowDebug(false)}
                  class="text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  <BsX size={20} />
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
          </Show>
        </div>
      </section>
    </AppConfContext.Provider>
  );
}
