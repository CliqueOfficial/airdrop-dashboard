import { formatUnits, toBytes, keccak256 } from 'viem';
import HookPanelHeader from './HookPanelHeader';
import { BsFire, BsCalendar, BsPencil, BsCheck, BsX } from 'solid-icons/bs';
import { useLinearPenaltyConf } from '../../../../hooks/useLinearPenaltyConf';
import { DeploymentContext } from '../../../../hooks/context/Deployment';
import { createEffect, createSignal, Show, useContext } from 'solid-js';
import DatetimePicker from '../../../DatetimePicker';
import Spin from '../../../Spin';

interface LinearPenaltyPanelProps {
  proportion: string;
  isFallback: boolean;
  strategy: string;
}

export default function LinearPenaltyPanel(props: LinearPenaltyPanelProps) {
  const context = useContext(DeploymentContext)!;
  const {
    data: linearPenaltyConf,
    update,
    refetch,
  } = useLinearPenaltyConf({
    contractAddress: () => context.roles()['linearPenaltyHook'],
    configurationId: () => keccak256(toBytes(props.strategy)),
    chainId: () => BigInt(context.chainId()),
    rpcUrl: context.rpcUrl,
    appId: context.appId,
    deployment: context.deployment,
    projectAdmin: () => context.roles()['projectAdmin'],
  });

  // Edit mode state
  const [isEditing, setIsEditing] = createSignal(false);
  const [isDeploying, setIsDeploying] = createSignal(false);

  // Temporary editing state
  const [tempBeginTime, setTempBeginTime] = createSignal(0n);
  const [tempEndTime, setTempEndTime] = createSignal(0n);

  // Initialize temp values when linearPenaltyConf changes
  createEffect(() => {
    const conf = linearPenaltyConf();
    if (conf) {
      setTempBeginTime(conf.beginTime);
      setTempEndTime(conf.endTime);
    }
  });

  const handleSave = async () => {
    // Validate time range
    if (tempEndTime() <= tempBeginTime()) {
      alert('End time must be greater than begin time');
      return;
    }

    const newConf: { beginTime: bigint; endTime: bigint } = {
      beginTime: tempBeginTime(),
      endTime: tempEndTime(),
    };

    setIsDeploying(true);
    try {
      await update(newConf);
      await refetch();
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to deploy penalty config:', error);
      alert(`Failed to deploy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleCancel = () => {
    const conf = linearPenaltyConf();
    if (conf) {
      setTempBeginTime(conf.beginTime);
      setTempEndTime(conf.endTime);
    }
    setIsEditing(false);
  };

  return (
    <div class="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200 overflow-hidden">
      <HookPanelHeader
        icon={BsFire}
        title="Linear Penalty Hook"
        description="Linear penalty to the recipient before token transfer"
        proportion={props.proportion}
        isFallback={props.isFallback}
        color="purple"
      />

      {/* Penalty Configuration Details */}
      <div class="p-4 bg-white bg-opacity-50">
        {/* Time Range Grid */}
        <div class="grid grid-cols-2 gap-4">
          <DatetimePicker
            value={tempBeginTime}
            setValue={setTempBeginTime}
            label="Begin Time (UTC)"
            icon={BsCalendar}
            isEditing={isEditing()}
            color="purple"
          />
          <DatetimePicker
            value={tempEndTime}
            setValue={setTempEndTime}
            label="End Time (UTC)"
            icon={BsCalendar}
            isEditing={isEditing()}
            color="purple"
          />
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
            title="Configure penalty preset"
          >
            <BsPencil size={14} />
            Configure
          </button>
        </Show>
      </div>
    </div>
  );
}
