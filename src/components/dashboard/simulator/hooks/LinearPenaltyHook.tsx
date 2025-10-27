import {
  Accessor,
  createEffect,
  createMemo,
  createResource,
  Show,
  Suspense,
  useContext,
} from 'solid-js';
import { DeploymentContext } from '../../../../hooks/context/Deployment';
import { createPublicClient } from '../../../../util';
import LinearPenaltyHookAbi from '../../../../abi/LinearPenaltyHook';
import { encodeAbiParameters, keccak256, parseEther, toBytes } from 'viem';
import { ConfigurationContext } from '../../../../hooks/context/Configuration';
import Spin from '../../../Spin';

interface LinearPenaltyHookProps {
  allocatedAmount: Accessor<bigint>;
  setHookExtra: (extra: { data: `0x${string}`; consumed: bigint }) => void;
}

export default function LinearPenaltyHook(props: LinearPenaltyHookProps) {
  const { roles, chainId, rpcUrl } = useContext(DeploymentContext)!;
  const { configuration, configurationName } = useContext(ConfigurationContext)!;
  const linearPenaltyHookAddr = () => roles()['linearPenaltyHook'];
  const client = createMemo(() => createPublicClient(chainId().toString(), rpcUrl()));

  const [data] = createResource(
    () => {
      if (!client() || !linearPenaltyHookAddr() || !props.allocatedAmount()) {
        return undefined;
      }
      return {
        client: client()!,
        linearPenaltyHookAddr: linearPenaltyHookAddr(),
        allocatedAmount: props.allocatedAmount(),
      };
    },
    async ({ client, linearPenaltyHookAddr, allocatedAmount }) => {
      return client.readContract({
        address: linearPenaltyHookAddr,
        abi: LinearPenaltyHookAbi,
        functionName: 'getPenalty',
        args: [keccak256(toBytes(configurationName())), allocatedAmount],
      });
    }
  );

  createEffect(() => {
    if (!data()) {
      return;
    }
    props.setHookExtra({
      data: encodeAbiParameters([{ type: 'uint256' }], [props.allocatedAmount()]),
      consumed: data()!,
    });
  });

  return (
    <article class="bg-white rounded-lg border-2 border-orange-200 shadow-sm hover:shadow-md transition-shadow p-5">
      <div class="flex items-center gap-2 mb-4">
        <div class="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
          <svg
            class="w-6 h-6 text-orange-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
            />
          </svg>
        </div>
        <div>
          <h3 class="text-lg font-semibold text-gray-900">Linear Penalty Hook</h3>
          <p class="text-xs text-gray-500">Time-based penalty calculation</p>
        </div>
      </div>

      <Suspense
        fallback={
          <div class="flex items-center justify-center py-8">
            <Spin size={24} />
            <span class="ml-3 text-sm text-gray-500">Calculating penalty...</span>
          </div>
        }
      >
        <dl class="space-y-3">
          <div class="bg-orange-50 rounded-lg p-3 border border-orange-100">
            <dt class="text-xs font-medium text-gray-600 mb-1">Allocated Amount</dt>
            <dd class="text-lg font-mono text-gray-900">{props.allocatedAmount().toString()}</dd>
          </div>
          <div class="bg-red-50 rounded-lg p-3 border border-red-100">
            <dt class="text-xs font-medium text-gray-600 mb-1">Consumed</dt>
            <dd class="text-lg font-mono text-red-700">{(data() ?? 0n).toString()}</dd>
          </div>
          <Show when={data()}>
            <div class="bg-amber-50 rounded-lg p-3 border border-amber-100">
              <dt class="text-xs font-medium text-gray-600 mb-1">Consumed</dt>
              <dd class="text-lg font-mono text-amber-700">{data()!.toString()}</dd>
            </div>
          </Show>
          <div class="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <dt class="text-xs font-medium text-gray-600 mb-1">Encoded Extra</dt>
            <dd class="text-xs font-mono text-gray-700 break-all">
              {encodeAbiParameters([{ type: 'uint256' }], [props.allocatedAmount()])}
            </dd>
          </div>
        </dl>
      </Suspense>
    </article>
  );
}
