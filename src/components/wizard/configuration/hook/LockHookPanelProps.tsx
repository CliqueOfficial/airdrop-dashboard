import { createMemo, Suspense } from 'solid-js';
import { Show } from 'solid-js';
import { BsLock, BsCalendar, BsLightning, BsClock, BsArrowRepeat, BsUnlock } from 'solid-icons/bs';
import { useContext } from 'solid-js';
import { DeploymentContext } from '../../../../hooks/context/Deployment';
import { createSignal } from 'solid-js';
import { useStreamPreset } from '../../../../hooks/useStreamPreset';
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

  const [proportion, setProportion] = createSignal(props.proportion);
  const { data: streamPreset } = useStreamPreset({
    contractAddress: () => context.roles()['lockHook'],
    distributorAddress: () => context.roles()['contract'],
    configurationId: () => keccak256(toBytes(props.strategy)),
    chainId: () => BigInt(context.chainId()),
    rpcUrl: context.rpcUrl,
    appId: context.appId,
    deployment: context.deployment,
    deployer: () => context.roles()['deployer'],
  });

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
        proportion={proportion()}
        isFallback={props.isFallback}
        badges={badges()}
        color="purple"
        hasBorder={true}
      />

      {/* Vesting Configuration Details */}
      <div class="p-4 bg-white bg-opacity-50">
        <div class="bg-white rounded-lg p-3 border border-purple-100 mb-4">
          <div class="flex items-center gap-2 mb-1">
            <BsCalendar class="text-purple-500" size={16} />
            <span class="text-xs font-medium text-gray-500">Start Time</span>
          </div>
          <Suspense fallback={<Spin size={14} />}>
            <div class="text-lg font-bold text-gray-900">
              {formatTimestamp(Number(streamPreset()?.startTime))}
            </div>
          </Suspense>
        </div>

        {/* Duration Grid */}
        <div class="grid grid-cols-3 gap-4">
          {/* Cliff Duration */}
          <div class="bg-white rounded-lg p-3 border border-purple-100">
            <div class="flex items-center gap-2 mb-1">
              <BsLightning class="text-purple-500" size={16} />
              <span class="text-xs font-medium text-gray-500">Cliff Duration</span>
            </div>
            <Suspense fallback={<Spin size={14} />}>
              <div class="text-lg font-bold text-gray-900">
                {formatDuration(Number(streamPreset()?.cliffDuration))}
              </div>
            </Suspense>
          </div>

          {/* Vesting Duration */}
          <div class="bg-white rounded-lg p-3 border border-purple-100">
            <div class="flex items-center gap-2 mb-1">
              <BsClock class="text-purple-500" size={16} />
              <span class="text-xs font-medium text-gray-500">Vesting Duration</span>
            </div>
            <Suspense fallback={<Spin size={14} />}>
              <div class="text-lg font-bold text-gray-900">
                {formatDuration(Number(streamPreset()?.vestingDuration))}
              </div>
            </Suspense>
          </div>

          {/* Piece Duration */}
          <div class="bg-white rounded-lg p-3 border border-purple-100">
            <div class="flex items-center gap-2 mb-1">
              <BsArrowRepeat class="text-purple-500" size={16} />
              <span class="text-xs font-medium text-gray-500">Piece Duration</span>
            </div>
            <Suspense fallback={<Spin size={14} />}>
              <div class="text-lg font-bold text-gray-900">
                {formatDuration(Number(streamPreset()?.pieceDuration))}
              </div>
            </Suspense>
          </div>
        </div>

        {/* Unlock Percentages */}
        <div class="grid grid-cols-2 gap-4 mt-4">
          <div class="bg-white rounded-lg p-3 border border-purple-100">
            <div class="flex items-center gap-2 mb-1">
              <BsUnlock class="text-purple-500" size={16} />
              <span class="text-xs font-medium text-gray-500">Start Unlock</span>
            </div>
            <Suspense fallback={<Spin size={14} />}>
              <div class="text-lg font-bold text-purple-600">
                {formatPercentage(Number(streamPreset()?.startUnlockPercentage))}
              </div>
            </Suspense>
          </div>

          <div class="bg-white rounded-lg p-3 border border-purple-100">
            <div class="flex items-center gap-2 mb-1">
              <BsUnlock class="text-purple-500" size={16} />
              <span class="text-xs font-medium text-gray-500">Cliff Unlock</span>
            </div>
            <Suspense fallback={<Spin size={14} />}>
              <div class="text-lg font-bold text-purple-600">
                {formatPercentage(Number(streamPreset()?.cliffUnlockPercentage))}
              </div>
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
