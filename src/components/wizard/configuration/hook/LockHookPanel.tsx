import { createMemo, Suspense, createEffect, Show, useContext, createSignal } from 'solid-js';
import {
  BsLock,
  BsCalendar,
  BsLightning,
  BsClock,
  BsArrowRepeat,
  BsUnlock,
  BsPencil,
  BsCheck,
  BsX,
} from 'solid-icons/bs';
import { DeploymentContext } from '../../../../hooks/context/Deployment';
import { useStreamPreset, type StreamPreset } from '../../../../hooks/useStreamPreset';
import { keccak256, toBytes } from 'viem';
import HookPanelHeader from './HookPanelHeader';
import Spin from '../../../Spin';

interface LockHookPanelProps {
  proportion: string;
  strategy: string;
  isFallback: boolean;
  isFixedStart: boolean;
}

export default function LockHookPanel(props: LockHookPanelProps) {
  const context = useContext(DeploymentContext)!;

  const {
    data: streamPreset,
    update,
    refetch,
  } = useStreamPreset({
    contractAddress: () => context.roles()['lockHook'],
    distributorAddress: () => context.roles()['contract'],
    configurationId: () => keccak256(toBytes(props.strategy)),
    chainId: () => BigInt(context.chainId()),
    rpcUrl: context.rpcUrl,
    appId: context.appId,
    deployment: context.deployment,
    deployer: () => context.roles()['deployer'],
  });

  // Edit mode state
  const [isEditing, setIsEditing] = createSignal(false);
  const [isDeploying, setIsDeploying] = createSignal(false);

  // Temporary editing state
  const [tempStartTime, setTempStartTime] = createSignal(0);
  const [tempCliffDuration, setTempCliffDuration] = createSignal(0);
  const [tempVestingDuration, setTempVestingDuration] = createSignal(0);
  const [tempPieceDuration, setTempPieceDuration] = createSignal(0);
  const [tempStartUnlockPercentage, setTempStartUnlockPercentage] = createSignal(0);
  const [tempCliffUnlockPercentage, setTempCliffUnlockPercentage] = createSignal(0);

  // Initialize temp values when streamPreset changes
  createEffect(() => {
    const preset = streamPreset();
    if (preset && !isEditing()) {
      setTempStartTime(Number(preset.startTime));
      setTempCliffDuration(Number(preset.cliffDuration));
      setTempVestingDuration(Number(preset.vestingDuration));
      setTempPieceDuration(Number(preset.pieceDuration));
      setTempStartUnlockPercentage(Number(preset.startUnlockPercentage));
      setTempCliffUnlockPercentage(Number(preset.cliffUnlockPercentage));
    }
  });

  const handleSave = async () => {
    const newPreset: StreamPreset = {
      startTime: BigInt(tempStartTime()),
      cliffDuration: BigInt(tempCliffDuration()),
      vestingDuration: BigInt(tempVestingDuration()),
      pieceDuration: BigInt(tempPieceDuration()),
      startUnlockPercentage: BigInt(tempStartUnlockPercentage()),
      cliffUnlockPercentage: BigInt(tempCliffUnlockPercentage()),
    };

    setIsDeploying(true);
    try {
      await update(newPreset);
      await refetch();
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to deploy stream preset:', error);
      alert(`Failed to deploy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleCancel = () => {
    const preset = streamPreset();
    if (preset) {
      setTempStartTime(Number(preset.startTime));
      setTempCliffDuration(Number(preset.cliffDuration));
      setTempVestingDuration(Number(preset.vestingDuration));
      setTempPieceDuration(Number(preset.pieceDuration));
      setTempStartUnlockPercentage(Number(preset.startUnlockPercentage));
      setTempCliffUnlockPercentage(Number(preset.cliffUnlockPercentage));
    }
    setIsEditing(false);
  };

  const formatDuration = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h`;
    return `${seconds}s`;
  };

  const formatPercentage = (value: number) => {
    return `${(value / 1e16).toFixed(2)}%`;
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateTimeLocal = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toISOString().slice(0, 16);
  };

  const parseDateTimeLocal = (dateTimeStr: string) => {
    return Math.floor(new Date(dateTimeStr).getTime() / 1000);
  };

  const badges = createMemo(() =>
    props.isFixedStart ? [{ label: 'Fixed Start', color: 'blue' as const }] : []
  );

  return (
    <div class="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200 overflow-hidden">
      {/* Header */}
      <HookPanelHeader
        icon={BsLock}
        title="Lock Hook"
        description="Lock tokens with vesting schedule"
        proportion={props.proportion}
        isFallback={props.isFallback}
        badges={badges()}
        color="purple"
        hasBorder={true}
      />

      {/* Vesting Configuration Details */}
      <div class="p-4 bg-white bg-opacity-50">
        {/* Start Time */}
        <div class="bg-white rounded-lg p-3 border border-purple-100 mb-4">
          <div class="flex items-center gap-2 mb-1">
            <BsCalendar class="text-purple-500" size={16} />
            <span class="text-xs font-medium text-gray-500">Start Time</span>
          </div>
          <Show
            when={isEditing()}
            fallback={
              <Suspense fallback={<Spin size={14} />}>
                <div class="text-lg font-bold text-gray-900">
                  {formatTimestamp(Number(streamPreset()?.startTime))}
                </div>
              </Suspense>
            }
          >
            <input
              type="datetime-local"
              value={formatDateTimeLocal(tempStartTime())}
              onInput={(e) => setTempStartTime(parseDateTimeLocal(e.currentTarget.value))}
              class="w-full px-3 py-2 border border-purple-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
            />
          </Show>
        </div>

        {/* Duration Grid */}
        <div class="grid grid-cols-3 gap-4">
          {/* Cliff Duration */}
          <div class="bg-white rounded-lg p-3 border border-purple-100">
            <div class="flex items-center gap-2 mb-1">
              <BsLightning class="text-purple-500" size={16} />
              <span class="text-xs font-medium text-gray-500">Cliff Duration (seconds)</span>
            </div>
            <Show
              when={isEditing()}
              fallback={
                <Suspense fallback={<Spin size={14} />}>
                  <div class="text-lg font-bold text-gray-900">
                    {formatDuration(Number(streamPreset()?.cliffDuration))}
                  </div>
                </Suspense>
              }
            >
              <input
                type="number"
                value={tempCliffDuration()}
                onInput={(e) => setTempCliffDuration(Number(e.currentTarget.value))}
                min="0"
                class="w-full px-3 py-2 border border-purple-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
              />
            </Show>
          </div>

          {/* Vesting Duration */}
          <div class="bg-white rounded-lg p-3 border border-purple-100">
            <div class="flex items-center gap-2 mb-1">
              <BsClock class="text-purple-500" size={16} />
              <span class="text-xs font-medium text-gray-500">Vesting Duration (seconds)</span>
            </div>
            <Show
              when={isEditing()}
              fallback={
                <Suspense fallback={<Spin size={14} />}>
                  <div class="text-lg font-bold text-gray-900">
                    {formatDuration(Number(streamPreset()?.vestingDuration))}
                  </div>
                </Suspense>
              }
            >
              <input
                type="number"
                value={tempVestingDuration()}
                onInput={(e) => setTempVestingDuration(Number(e.currentTarget.value))}
                min="0"
                class="w-full px-3 py-2 border border-purple-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
              />
            </Show>
          </div>

          {/* Piece Duration */}
          <div class="bg-white rounded-lg p-3 border border-purple-100">
            <div class="flex items-center gap-2 mb-1">
              <BsArrowRepeat class="text-purple-500" size={16} />
              <span class="text-xs font-medium text-gray-500">Piece Duration (seconds)</span>
            </div>
            <Show
              when={isEditing()}
              fallback={
                <Suspense fallback={<Spin size={14} />}>
                  <div class="text-lg font-bold text-gray-900">
                    {formatDuration(Number(streamPreset()?.pieceDuration))}
                  </div>
                </Suspense>
              }
            >
              <input
                type="number"
                value={tempPieceDuration()}
                onInput={(e) => setTempPieceDuration(Number(e.currentTarget.value))}
                min="0"
                class="w-full px-3 py-2 border border-purple-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
              />
            </Show>
          </div>
        </div>

        {/* Unlock Percentages */}
        <div class="grid grid-cols-2 gap-4 mt-4">
          <div class="bg-white rounded-lg p-3 border border-purple-100">
            <div class="flex items-center gap-2 mb-1">
              <BsUnlock class="text-purple-500" size={16} />
              <span class="text-xs font-medium text-gray-500">Start Unlock (Wei, 1e18 = 100%)</span>
            </div>
            <Show
              when={isEditing()}
              fallback={
                <Suspense fallback={<Spin size={14} />}>
                  <div class="text-lg font-bold text-purple-600">
                    {formatPercentage(Number(streamPreset()?.startUnlockPercentage))}
                  </div>
                </Suspense>
              }
            >
              <input
                type="number"
                value={tempStartUnlockPercentage()}
                onInput={(e) => setTempStartUnlockPercentage(Number(e.currentTarget.value))}
                min="0"
                max="1000000000000000000"
                class="w-full px-3 py-2 border border-purple-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                placeholder="e.g., 100000000000000000 for 10%"
              />
            </Show>
          </div>

          <div class="bg-white rounded-lg p-3 border border-purple-100">
            <div class="flex items-center gap-2 mb-1">
              <BsUnlock class="text-purple-500" size={16} />
              <span class="text-xs font-medium text-gray-500">Cliff Unlock (Wei, 1e18 = 100%)</span>
            </div>
            <Show
              when={isEditing()}
              fallback={
                <Suspense fallback={<Spin size={14} />}>
                  <div class="text-lg font-bold text-purple-600">
                    {formatPercentage(Number(streamPreset()?.cliffUnlockPercentage))}
                  </div>
                </Suspense>
              }
            >
              <input
                type="number"
                value={tempCliffUnlockPercentage()}
                onInput={(e) => setTempCliffUnlockPercentage(Number(e.currentTarget.value))}
                min="0"
                max="1000000000000000000"
                class="w-full px-3 py-2 border border-purple-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                placeholder="e.g., 200000000000000000 for 20%"
              />
            </Show>
          </div>
        </div>

        {/* Configure Button at Bottom */}
        <Show
          when={!isEditing()}
          fallback={
            <div class="flex gap-2 mt-4">
              <button
                class="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 rounded-md transition-colors shadow-sm flex items-center justify-center gap-2"
                onClick={handleSave}
                disabled={isDeploying()}
                title="Save and deploy changes"
              >
                <Show
                  when={isDeploying()}
                  fallback={
                    <>
                      <BsCheck size={18} />
                      Save & Deploy
                    </>
                  }
                >
                  <Spin size={14} />
                  Deploying...
                </Show>
              </button>
              <button
                class="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-md transition-colors shadow-sm flex items-center justify-center gap-2"
                onClick={handleCancel}
                title="Cancel changes"
              >
                <BsX size={18} />
                Cancel
              </button>
            </div>
          }
        >
          <button
            class="w-full mt-4 px-4 py-2.5 text-sm font-medium text-purple-600 bg-white hover:bg-purple-50 border border-purple-300 rounded-md transition-colors shadow-sm flex items-center justify-center gap-2"
            onClick={() => setIsEditing(true)}
            title="Configure stream preset"
          >
            <BsPencil size={14} />
            Configure
          </button>
        </Show>
      </div>
    </div>
  );
}
