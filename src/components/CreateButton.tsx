import { createSignal, Show, onMount, onCleanup } from 'solid-js';
import { BsCheck, BsX, BsPlus } from 'solid-icons/bs';

interface CreateButtonProps {
  requireInput?: boolean;
  disabled?: boolean;
  onComplete: (name: string) => void;
  onValidate: (name: string) => boolean;
}

export const CreateButton = (props: CreateButtonProps) => {
  const [isEditing, setIsEditing] = createSignal(false);
  const [name, setName] = createSignal('');
  let containerRef: HTMLDivElement | undefined;

  const handleComplete = () => {
    if (props.onValidate(name())) {
      props.onComplete(name());
      setName('');
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setName('');
    setIsEditing(false);
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (isEditing() && containerRef && !containerRef.contains(e.target as Node)) {
      handleCancel();
    }
  };

  const handleAdd = () => {
    if (props.requireInput) {
      setIsEditing(true);
    } else {
      props.onComplete(name());
      setName('');
      setIsEditing(false);
    }
  };

  onMount(() => {
    document.addEventListener('mousedown', handleClickOutside);
  });

  onCleanup(() => {
    document.removeEventListener('mousedown', handleClickOutside);
  });

  return (
    <div
      ref={containerRef}
      class="inline-flex items-center gap-2 transition-all duration-300 ease-in-out h-6"
    >
      <Show
        when={isEditing()}
        fallback={
          <button
            disabled={props.disabled}
            class="w-6 h-6 flex items-center justify-center text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors cursor-pointer"
            onClick={handleAdd}
          >
            <BsPlus size={16} />
          </button>
        }
      >
        <input
          type="text"
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleComplete();
            } else if (e.key === 'Escape') {
              handleCancel();
            }
          }}
          class="h-6 px-2 border-b border-gray-300 text-sm transition-all duration-300 ease-in-out focus:outline-none focus:border-b-blue-500 focus:border-b-1"
          placeholder="Enter name"
          autofocus
        />
        <button
          class="w-6 h-6 flex items-center justify-center bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors cursor-pointer shrink-0"
          onClick={handleComplete}
        >
          <BsCheck size={16} />
        </button>
      </Show>
    </div>
  );
};
