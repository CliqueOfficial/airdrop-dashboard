import { Accessor, createEffect, createMemo } from 'solid-js';
import { encodeAbiParameters } from 'viem';

interface TransferHookProps {
  allocatedAmount: Accessor<bigint>;
  setHookExtra: (extra: { data: `0x${string}`; consumed: bigint }) => void;
}

export default function TransferHook(props: TransferHookProps) {
  const { allocatedAmount, setHookExtra } = props;

  const hookExtra = createMemo(() => {
    return encodeAbiParameters([{ type: 'uint256' }], [allocatedAmount()]);
  });

  createEffect(() => {
    console.log('allocatedAmount', allocatedAmount());
    setHookExtra({
      data: encodeAbiParameters([{ type: 'uint256' }], [allocatedAmount()]),
      consumed: allocatedAmount(),
    });
  });

  return (
    <article class="bg-white rounded-lg border-2 border-green-200 shadow-sm hover:shadow-md transition-shadow p-5">
      <div class="flex items-center gap-2 mb-4">
        <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
          <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </div>
        <div>
          <h3 class="text-lg font-semibold text-gray-900">Transfer Hook</h3>
          <p class="text-xs text-gray-500">Direct token transfer strategy</p>
        </div>
      </div>

      <dl class="space-y-3">
        <div class="bg-green-50 rounded-lg p-3 border border-green-100">
          <dt class="text-xs font-medium text-gray-600 mb-1">Allocated Amount</dt>
          <dd class="text-lg font-mono text-gray-900">{allocatedAmount().toString()}</dd>
        </div>
        <div class="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <dt class="text-xs font-medium text-gray-600 mb-1">Consumed</dt>
          <dd class="text-lg font-mono text-gray-900">{allocatedAmount().toString()}</dd>
        </div>
        <div class="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <dt class="text-xs font-medium text-gray-600 mb-1">Encoded Extra</dt>
          <dd class="text-xs font-mono text-gray-700 break-all">{hookExtra()}</dd>
        </div>
      </dl>
    </article>
  );
}
