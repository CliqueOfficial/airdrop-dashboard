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
import { keccak256, toBytes, isAddress, parseUnits, formatUnits } from 'viem';
import HookPanelHeader from './HookPanelHeader';
import DatetimePicker from '../../../DatetimePicker';
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
  const [tempStartTime, setTempStartTime] = createSignal(0n);
  const [tempCliffDuration, setTempCliffDuration] = createSignal(0);
  const [tempVestingDuration, setTempVestingDuration] = createSignal(0);
  const [tempPieceDuration, setTempPieceDuration] = createSignal(0);
  const [tempStartUnlockPercentage, setTempStartUnlockPercentage] = createSignal('0');
  const [tempCliffUnlockPercentage, setTempCliffUnlockPercentage] = createSignal('0');
  const [tempLock, setTempLock] = createSignal('0x0000000000000000000000000000000000000000');
  const [tempIsFixedStart, setTempIsFixedStart] = createSignal(false);
  // Initialize temp values when streamPreset changes
  createEffect(() => {
    const preset = streamPreset();
    if (preset && !isEditing()) {
      setTempStartTime(preset.startTime);
      setTempCliffDuration(Number(preset.cliffDuration));
      setTempVestingDuration(Number(preset.vestingDuration));
      setTempPieceDuration(Number(preset.pieceDuration));
      // Convert Wei to percentage string (0-100)
      // e.g., 10^17 Wei = formatUnits(10^17, 16) = '10'
      setTempStartUnlockPercentage(formatUnits(preset.startUnlockPercentage, 16));
      setTempCliffUnlockPercentage(formatUnits(preset.cliffUnlockPercentage, 16));
      setTempLock(preset.lock);
      setTempIsFixedStart(preset.isFixedStart);
    }
  });

  const handleSave = async () => {
    if (!isAddress(tempLock())) {
      alert('Invalid lock address');
      return;
    }

    // Validate and convert percentage string (0-100) to Wei using parseUnits(v, 16)
    // e.g., 10% = parseUnits('10', 16) = 10^17 Wei
    let startUnlockWei: bigint;
    let cliffUnlockWei: bigint;

    try {
      startUnlockWei = parseUnits(tempStartUnlockPercentage() || '0', 16);
      cliffUnlockWei = parseUnits(tempCliffUnlockPercentage() || '0', 16);
    } catch (error) {
      alert('Invalid percentage values. Please enter valid numbers.');
      return;
    }

    const newPreset: StreamPreset = {
      startTime: tempStartTime(),
      cliffDuration: BigInt(tempCliffDuration()),
      vestingDuration: BigInt(tempVestingDuration()),
      pieceDuration: BigInt(tempPieceDuration()),
      startUnlockPercentage: startUnlockWei,
      cliffUnlockPercentage: cliffUnlockWei,
      lock: tempLock() as `0x${string}`,
      isFixedStart: tempIsFixedStart(),
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
      setTempStartTime(preset.startTime);
      setTempCliffDuration(Number(preset.cliffDuration));
      setTempVestingDuration(Number(preset.vestingDuration));
      setTempPieceDuration(Number(preset.pieceDuration));
      // Convert Wei to percentage string (0-100)
      // e.g., 10^17 Wei = formatUnits(10^17, 16) = '10'
      setTempStartUnlockPercentage(formatUnits(preset.startUnlockPercentage, 16));
      setTempCliffUnlockPercentage(formatUnits(preset.cliffUnlockPercentage, 16));
      setTempLock(preset.lock);
      setTempIsFixedStart(preset.isFixedStart);
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

  const formatPercentage = (value: bigint) => {
    // Convert from Wei to percentage
    // e.g., 10^17 Wei = formatUnits(10^17, 16) = '10' = 10%
    return `${Number(formatUnits(value, 16)).toFixed(2)}%`;
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
        {/* Lock Address */}
        <div class="bg-white rounded-lg p-3 border border-purple-100 mb-4">
          <div class="flex items-center gap-2 mb-1">
            <BsLock class="text-purple-500" size={16} />
            <span class="text-xs font-medium text-gray-500">Lock Address</span>
          </div>
          <Show
            when={isEditing()}
            fallback={
              <Suspense fallback={<Spin size={14} />}>
                <div class="text-sm font-mono text-gray-900 break-all">
                  {streamPreset()?.lock || '0x0000000000000000000000000000000000000000'}
                </div>
              </Suspense>
            }
          >
            <input
              type="text"
              value={tempLock()}
              onInput={(e) => setTempLock(e.currentTarget.value)}
              class="w-full px-3 py-2 border border-purple-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm font-mono"
              placeholder="0x..."
            />
          </Show>
        </div>

        {/* IsFixedStart Checkbox */}
        <div class="bg-white rounded-lg p-3 border border-purple-100 mb-4">
          <div class="flex items-center gap-2">
            <Show
              when={isEditing()}
              fallback={
                <Suspense fallback={<Spin size={14} />}>
                  <input
                    type="checkbox"
                    checked={streamPreset()?.isFixedStart}
                    disabled
                    class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <span class="text-sm font-medium text-gray-900">Fixed Start Time</span>
                </Suspense>
              }
            >
              <input
                type="checkbox"
                checked={tempIsFixedStart()}
                onInput={(e) => setTempIsFixedStart(e.currentTarget.checked)}
                class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
              />
              <span class="text-sm font-medium text-gray-900">Fixed Start Time</span>
            </Show>
          </div>
          <p class="text-xs text-gray-500 mt-2">
            If enabled, the start time is fixed. Otherwise, start time can be flexible.
          </p>
        </div>

        {/* Start Time */}
        <Suspense fallback={<Spin size={14} />}>
          <Show when={isEditing() ? tempIsFixedStart() : streamPreset()?.isFixedStart}>
            <div class="mb-4">
              <DatetimePicker
                value={tempStartTime}
                setValue={setTempStartTime}
                label="Start Time (UTC)"
                icon={BsCalendar}
                isEditing={isEditing()}
                color="purple"
              />
            </div>
          </Show>
        </Suspense>

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
              <span class="text-xs font-medium text-gray-500">Start Unlock Percentage</span>
            </div>
            <Show
              when={isEditing()}
              fallback={
                <Suspense fallback={<Spin size={14} />}>
                  <div class="text-lg font-bold text-purple-600">
                    {formatPercentage(streamPreset()?.startUnlockPercentage || BigInt(0))}
                  </div>
                </Suspense>
              }
            >
              <input
                type="text"
                value={tempStartUnlockPercentage()}
                onInput={(e) => setTempStartUnlockPercentage(e.currentTarget.value)}
                class="w-full px-3 py-2 border border-purple-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                placeholder="e.g., 10 for 10%"
              />
            </Show>
          </div>

          <div class="bg-white rounded-lg p-3 border border-purple-100">
            <div class="flex items-center gap-2 mb-1">
              <BsUnlock class="text-purple-500" size={16} />
              <span class="text-xs font-medium text-gray-500">Cliff Unlock Percentage</span>
            </div>
            <Show
              when={isEditing()}
              fallback={
                <Suspense fallback={<Spin size={14} />}>
                  <div class="text-lg font-bold text-purple-600">
                    {formatPercentage(streamPreset()?.cliffUnlockPercentage || BigInt(0))}
                  </div>
                </Suspense>
              }
            >
              <input
                type="text"
                value={tempCliffUnlockPercentage()}
                onInput={(e) => setTempCliffUnlockPercentage(e.currentTarget.value)}
                class="w-full px-3 py-2 border border-purple-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                placeholder="e.g., 20 for 20%"
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
