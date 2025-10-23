import { createSignal, Show, For, createEffect, type JSX } from 'solid-js';
import { createStore, unwrap } from 'solid-js/store';
import { BsCheck, BsPencil, BsPlus, BsTrash, BsX } from 'solid-icons/bs';

interface EditableListViewProps<T> {
  title?: string;
  items: T[];
  class?: string;
  onItemsChange?: (items: T[]) => void;
  children: (
    item: T,
    index: number,
    isEditing: boolean,
    updateItem: (updates: Partial<T>) => void
  ) => JSX.Element;
  createView?: (onItemCreated: (item: T) => void, onCancel: () => void) => JSX.Element;
  canAdd?: boolean;
  canDelete?: boolean;
  canEdit?: boolean;
  validateItems?: (items: T[]) => boolean;
}

export default function EditableListView<T>(props: EditableListViewProps<T>) {
  // Main store - the source of truth
  const [items, setItems] = createStore<T[]>(props.items);

  // Temporary editing store - initialized with unwrapped values
  const [tempItems, setTempItems] = createStore<T[]>(unwrap(items));

  const [isEditing, setIsEditing] = createSignal(false);
  const [isCreating, setIsCreating] = createSignal(false);

  // Sync props.items to internal state when they change externally
  createEffect(() => {
    if (!isEditing()) {
      setItems(props.items);
      setTempItems(unwrap(props.items));
    }
  });

  // Confirm changes - save temp state to main store
  const handleConfirm = () => {
    if (props.validateItems && !props.validateItems(tempItems)) {
      return;
    }
    setItems(unwrap(tempItems));
    props.onItemsChange?.(unwrap(tempItems));
    setIsEditing(false);
    setIsCreating(false);
  };

  // Cancel changes - reset temp state to main store values
  const handleCancel = () => {
    setTempItems(unwrap(items));
    setIsEditing(false);
    setIsCreating(false);
  };

  // Add a new item
  const handleAdd = () => {
    if (props.createView) {
      setIsCreating(true);
    }
  };

  // Handle item creation from createView
  const handleItemCreated = (item: T) => {
    setTempItems([...tempItems, item]);
    setIsCreating(false);
  };

  // Handle cancel item creation
  const handleCancelCreate = () => {
    setIsCreating(false);
  };

  // Delete an item
  const handleDelete = (index: number) => {
    setTempItems(tempItems.filter((_, i) => i !== index));
  };

  // Update a specific item
  const updateItem = (index: number) => (updates: Partial<T>) => {
    setTempItems(index, updates as any);
  };

  const canAdd = props.canAdd ?? true;
  const canDelete = props.canDelete ?? true;
  const canEdit = props.canEdit ?? true;

  return (
    <div class={`border border-gray-300 rounded-md bg-white shadow-sm ${props.class || ''}`}>
      {/* Header */}
      <Show when={props.title || canEdit}>
        <div class="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
          <Show when={props.title}>
            <h3 class="text-lg font-semibold text-gray-900 flex-1">{props.title}</h3>
          </Show>

          <Show when={canEdit}>
            <Show
              when={isEditing()}
              fallback={
                <button
                  class="w-6 h-6 flex items-center justify-center text-blue-500 hover:text-blue-600 rounded-md transition-colors cursor-pointer"
                  onClick={() => setIsEditing(true)}
                  title="Edit list"
                >
                  <BsPencil size={14} />
                </button>
              }
            >
              <button
                class="w-6 h-6 flex items-center justify-center text-green-500 hover:text-green-600 rounded-md transition-colors cursor-pointer"
                onClick={handleConfirm}
                title="Confirm changes"
              >
                <BsCheck size={16} />
              </button>
              <button
                class="w-6 h-6 flex items-center justify-center text-red-500 hover:text-red-600 rounded-md transition-colors cursor-pointer"
                onClick={handleCancel}
                title="Cancel changes"
              >
                <BsX size={16} />
              </button>
              <Show when={canAdd && props.createView}>
                <button
                  class="w-6 h-6 flex items-center justify-center text-blue-500 hover:text-blue-600 rounded-md transition-colors cursor-pointer ml-2"
                  onClick={handleAdd}
                  title="Add item"
                >
                  <BsPlus size={16} />
                </button>
              </Show>
            </Show>
          </Show>
        </div>
      </Show>

      {/* List items */}
      <div class="p-4">
        <Show
          when={tempItems.length > 0 || isCreating()}
          fallback={
            <div class="text-center text-gray-500 py-8">
              <p>No items</p>
              <Show when={isEditing() && canAdd && props.createView}>
                <button
                  class="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors text-sm"
                  onClick={handleAdd}
                >
                  Add first item
                </button>
              </Show>
            </div>
          }
        >
          <div class="space-y-3">
            <For each={tempItems}>
              {(item, index) => (
                <div class="flex items-center gap-3">
                  <div class="flex-1">
                    {props.children(item, index(), isEditing(), updateItem(index()))}
                  </div>
                  <Show when={isEditing() && canDelete}>
                    <button
                      class="w-6 h-6 flex items-center justify-center text-red-500 hover:text-red-600 rounded-md transition-colors cursor-pointer shrink-0"
                      onClick={() => handleDelete(index())}
                      title="Delete item"
                    >
                      <BsTrash size={14} />
                    </button>
                  </Show>
                </div>
              )}
            </For>
            {/* Create View */}
            <Show when={isCreating() && props.createView}>
              <div class="border-2 border-dashed border-blue-300 rounded-md p-4 bg-blue-50">
                {props.createView!(handleItemCreated, handleCancelCreate)}
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
}
