import { BsCheck, BsPencil, BsPlus, BsX } from 'solid-icons/bs';
import { Accessor, Show, type JSX } from 'solid-js';

interface DefaultHeaderProps {
  title?: JSX.Element;
  canEdit: Accessor<boolean>;
  canAdd: Accessor<boolean>;
  isEditing: Accessor<boolean>;
  setIsEditing: (editing: boolean) => void;
  handleConfirm: () => void;
  handleCancel: () => void;
  handleAdd: () => void;
}

export default function DefaultHeader({
  title,
  canEdit,
  canAdd,
  isEditing,
  setIsEditing,
  handleConfirm,
  handleCancel,
  handleAdd,
}: DefaultHeaderProps) {
  return (
    <Show when={title || canEdit}>
      <div class="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
        <Show when={title}>{title}</Show>

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
            <Show when={canAdd()}>
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
  );
}
