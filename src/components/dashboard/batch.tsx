import { useParams } from "@solidjs/router";
import { useAppConf } from "../../hooks/useAppConf";
import { createMemo, createResource, createSignal, For, Suspense } from "solid-js";
import TabView from "../TabView";
import { useConfig } from "../../hooks/useConfig";
import EditableListView from "../EditableListView";
import { formatUnits } from 'viem';

interface BatchProps {
  appId: string;
}

export default function BatchOverview({
  appId,
}: BatchProps) {
  const { appConf, refetch } = useAppConf(() => appId);
  const availableBatches = () => appConf()?.extra.root || {};

  const tabs = createMemo(() => {
    return Object.keys(availableBatches()).map((name) => ({
      id: name,
      label: name,
    }));
  });

  return (
    <TabView tabs={tabs()}>
      {(tab) => (
        <BatchListView appId={appId} batchName={tab.label} />
      )}
    </TabView>
  );
}

interface BatchListViewProps {
  appId: string;
  batchName: string;
}

interface Allocation {
  address_handler: string;
  allocation: string;
  claim_at?: string;
  extra: {
    recipient?: string;
  }
}

function BatchListView({
  appId,
  batchName,
}: BatchListViewProps) {
  const { config } = useConfig();
  const [decimal, setDecimal] = createSignal(18);

  const [allocations, { refetch }] = createResource(async () => {
    const response = await fetch(`${config.baseUrl}/admin/allocation/${appId}/${batchName}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch allocations: ${response.statusText}`);
    }

    const allocations = await response.json() as Promise<{
      allocations: Allocation[];
    }>;
    return allocations;
  });

  // Calculate statistics
  const stats = createMemo(() => {
    const items = allocations()?.allocations || [];
    const totalCount = items.length;
    const claimedCount = items.filter(item => item.claim_at).length;

    const totalAllocation = items.reduce((sum, item) => sum + BigInt(item.allocation), BigInt(0));
    const claimedAllocation = items
      .filter(item => item.claim_at)
      .reduce((sum, item) => sum + BigInt(item.allocation), BigInt(0));

    return {
      totalCount,
      claimedCount,
      totalAllocation,
      claimedAllocation,
    };
  });

  return (
    <div>
      <Suspense fallback={<div>Loading...</div>}>
        <EditableListView
          class="bg-transparent"
          title={() => (
            <div class="flex items-center gap-3">
              {/* Claims Badge */}
              <div class="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-full">
                <span class="text-xs font-medium text-blue-700">Claims:</span>
                <span class="text-sm font-bold text-blue-900">
                  {stats().claimedCount}/{stats().totalCount}
                </span>
              </div>

              {/* Amount Badge */}
              <div class="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full">
                <span class="text-xs font-medium text-green-700">Amount:</span>
                <span class="text-sm font-bold text-green-900">
                  {formatUnits(stats().claimedAllocation, decimal())}/{formatUnits(stats().totalAllocation, decimal())}
                </span>
              </div>

              {/* Decimal Input */}
              <div class="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg">
                <label for="decimal-input" class="text-xs font-medium text-gray-700">
                  Decimals:
                </label>
                <input
                  id="decimal-input"
                  type="number"
                  min="0"
                  max="18"
                  value={decimal()}
                  onChange={(e) => setDecimal(parseInt(e.currentTarget.value) || 0)}
                  class="w-16 px-2 py-1 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}
          items={allocations()?.allocations || []}
          onItemsChange={(items) => {
            console.log(items);
          }}
        >
          {(allocation) => (
            <div class="grid grid-cols-4 gap-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200">
              {/* Address Handler */}
              <div class="flex flex-col">
                <span class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Address
                </span>
                <span class="text-sm font-mono text-gray-900 break-all">
                  {allocation.address_handler}
                </span>
              </div>

              {/* Recipient */}
              <div class="flex flex-col">
                <span class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Recipient
                </span>
                <span class="text-sm font-mono text-gray-900 break-all">
                  {allocation.extra?.recipient || <span class="text-gray-400 italic">Not set</span>}
                </span>
              </div>

              {/* Allocation Amount */}
              <div class="flex flex-col">
                <span class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Allocation
                </span>
                <span class="text-sm font-semibold text-blue-600">
                  {formatUnits(BigInt(allocation.allocation), decimal())}
                </span>
              </div>

              {/* Claim Date */}
              <div class="flex flex-col">
                <span class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Claim Date
                </span>
                <span class="text-sm text-gray-700">
                  {allocation.claim_at
                    ? new Date(allocation.claim_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })
                    : <span class="text-gray-400 italic">Not set</span>
                  }
                </span>
              </div>
            </div>
          )}
        </EditableListView>
      </Suspense>
    </div>
  );
}