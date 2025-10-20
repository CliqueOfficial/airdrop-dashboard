import { Accessor, createSignal, For, JSX, Show } from 'solid-js';

interface TabViewProps {
  tabs: {
    id: string;
    label: string;
  }[];
  children: (tab: { id: string; label: string }) => JSX.Element;
}

export default function TabView(props: TabViewProps) {
  const [activeTab, setActiveTab] = createSignal<{
    id: string;
    label: string;
  } | null>(props.tabs.length > 0 ? props.tabs[0] : null);

  return (
    <div class="space-y-6">
      {/* Tab Header */}
      <div class="border-b border-gray-200">
        <nav class="-mb-px flex space-x-1 overflow-x-auto">
          <For each={props.tabs}>
            {(tab) => (
              <button
                class={`
                  min-w-0 flex-1 sm:flex-initial
                  whitespace-nowrap py-3 px-6 
                  font-medium text-sm
                  transition-all duration-200 ease-in-out
                  ${
                    activeTab()?.id === tab.id
                      ? 'text-blue-600 border-b-2 border-blue-500'
                      : 'text-gray-600 hover:text-gray-900 hover:border-gray-300 border-b-2 border-transparent'
                  }
                `}
                onClick={() => setActiveTab(tab)}
              >
                {tab.label}
              </button>
            )}
          </For>
        </nav>
      </div>

      {/* Tab Content */}
      <div class="py-2">
        <Show
          when={activeTab()}
          fallback={
            <div class="text-center py-12 text-gray-400">
              <p>No content available</p>
            </div>
          }
        >
          <div class="animate-fadeIn">{props.children(activeTab()!)}</div>
        </Show>
      </div>
    </div>
  );
}
