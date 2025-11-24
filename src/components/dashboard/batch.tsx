import { createEffect, createMemo, createResource, createSignal, For, Suspense } from 'solid-js';
import TabView from '../TabView';
import { useConfig } from '../../hooks/useConfig';
import EditableListView from '../EditableListView';
import { formatUnits } from 'viem';
import { TbArrowLeft, TbArrowRight } from 'solid-icons/tb';

interface BatchProps {
  appId: string;
}

interface BatchStat {
  batch: string;
  totalUsersCount: number;
  claimedUsersCount: number;
  totalAllocationAmount: string;
  claimedAllocationAmount: string;
}

export default function BatchOverview(props: BatchProps) {
  const { config } = useConfig();
  const [stats] = createResource(async () => {
    const response = await fetch(`${config().baseUrl}/admin/stats/${props.appId}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config().apiKey,
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch stats: ${response.statusText}`);
    }
    const stats = (await response.json()) as {
      perBatchStats: BatchStat[];
    };
    return stats.perBatchStats;
  });

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TabView
        tabs={
          stats()?.map((stat) => ({
            id: stat.batch,
            label: stat.batch,
            data: stat,
          })) || []
        }
      >
        {(tab) => <BatchListView appId={props.appId} batchName={tab.label} data={tab.data} />}
      </TabView>
    </Suspense>
  );
}

interface BatchListViewProps {
  appId: string;
  batchName: string;
  data: BatchStat;
}

interface Allocation {
  address_handler: string;
  allocation: string;
  claim_at?: string;
  extra: {
    recipient?: string;
  };
}

function BatchListView(props: BatchListViewProps) {
  const { config } = useConfig();
  const [decimal, setDecimal] = createSignal(18);
  const [cursor, setCursor] = createSignal<string | null>(null);
  const [page, setPage] = createSignal(1);
  const [pageSize, setPageSize] = createSignal(10);

  const pageCount = createMemo(() => {
    return Math.ceil(props.data.totalUsersCount / pageSize());
  });

  const [allocations, { refetch }] = createResource(page, async (page) => {
    const queryParams = new URLSearchParams();
    queryParams.set('page', page.toString());
    if (cursor()) {
      queryParams.set('cursor', cursor()!);
    } else {
      queryParams.set('pageSize', pageSize().toString());
    }
    const response = await fetch(
      `${config().baseUrl}/admin/allocation/${props.appId}/${props.batchName}?${queryParams.toString()}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config().apiKey,
        },
      }
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch allocations: ${response.statusText}`);
    }

    const allocations = (await response.json()) as {
      allocations: Allocation[];
      cursor: string | null;
    };
    if (allocations?.cursor) {
      setCursor(allocations.cursor);
    }
    return allocations;
  });

  // Pagination handlers
  const handlePreviousPage = () => {
    setPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setPage((prev) => Math.min(pageCount(), prev + 1));
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCursor(null);
    setPage(1);
    refetch();
  };

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
                  {props.data.claimedUsersCount}/{props.data.totalUsersCount}
                </span>
              </div>

              {/* Amount Badge */}
              <div class="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full">
                <span class="text-xs font-medium text-green-700">Amount:</span>
                <span class="text-sm font-bold text-green-900">
                  {formatUnits(BigInt(props.data.claimedAllocationAmount), decimal())}/
                  {formatUnits(BigInt(props.data.totalAllocationAmount), decimal())}
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
              {/* Page Size Input */}
              <div class="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg">
                <label for="page-size-input" class="text-xs font-medium text-gray-700">
                  Page Size:
                </label>
                <input
                  id="page-size-input"
                  type="number"
                  min="1"
                  max="100"
                  value={pageSize()}
                  onChange={(e) => handlePageSizeChange(parseInt(e.currentTarget.value) || 10)}
                  class="w-16 px-2 py-1 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              {/* Pagination Controls */}
              <div class="inline-flex items-center gap-1 px-2 py-1.5 bg-gray-50 border border-gray-300 rounded-lg">
                <button
                  onClick={handlePreviousPage}
                  disabled={page() === 1}
                  class="p-1.5 text-gray-700 hover:bg-gray-200 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  aria-label="Previous page"
                >
                  <TbArrowLeft size={18} />
                </button>
                <div class="px-3 py-1 min-w-[60px] text-center">
                  <span class="text-sm font-medium text-gray-900">{page()}</span>
                  <span class="text-xs text-gray-500 mx-1">/</span>
                  <span class="text-sm font-medium text-gray-600">{pageCount()}</span>
                </div>
                <button
                  onClick={handleNextPage}
                  disabled={page() === pageCount()}
                  class="p-1.5 text-gray-700 hover:bg-gray-200 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  aria-label="Next page"
                >
                  <TbArrowRight size={18} />
                </button>
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
                  {allocation.claim_at ? (
                    new Date(allocation.claim_at).toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false,
                    })
                  ) : (
                    <span class="text-gray-400 italic">Not set</span>
                  )}
                </span>
              </div>
            </div>
          )}
        </EditableListView>
      </Suspense>
    </div>
  );
}
