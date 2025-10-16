import { Accessor, createEffect, createMemo, createSignal, JSX } from 'solid-js';
import type { Configuration, Deployment } from '../hooks/useAppConf';
import { Input } from './Input';
import { createStore, unwrap } from 'solid-js/store';
import { CreateButton } from './CreateButton';
import { DeploymentConfiguration } from './DeploymentConfiguration';
import { root } from 'viem/chains';
import { BsTrash } from 'solid-icons/bs';

interface DeploymentCardProps {
  name: string;
  roots: Accessor<Record<string, string>>;
  deployment: Deployment;
}

interface DeploymentExtra {
  root: Record<string, string>;
}

export const DeploymentCard = (props: DeploymentCardProps) => {
  const [rootConf, setRootConf] = createStore<Record<string, string>>(props.deployment.extra.root);
  const [configurations, setConfigurations] = createStore<Record<string, Configuration>>(
    props.deployment.extra.configurations
  );
  const [roles, setRoles] = createStore<Record<string, string>>(props.deployment.roles);

  const availibleHooks = createMemo(() => {
    return Object.keys(roles)
      .filter((key) => key.endsWith('Hook'))
      .map((key) => {
        return {
          name: key,
          value: roles[key],
        };
      });
  }, [roles]);

  return (
    <div class="border border-gray-300 pb-4 ml-4 mr-4 rounded-md">
      <span class="text-lg font-bold pt-4 pl-4 block">{props.name}</span>
      <div class="ml-4 mr-4">
        <Input label="Chain ID" value={() => props.deployment.chainId} />
      </div>
      <div class="ml-4 mr-4">
        <Input label="Rpc Url" value={() => props.deployment.rpcUrl} />
      </div>
      <span class="text-lg font-bold pt-4 pl-4">Roles</span>
      <RecordInput
        class="pl-6 ml-6 mr-4"
        value={() => props.deployment.roles}
        setValue={(value) => setRoles(value)}
      />
      <div class="pt-4 pl-4 flex items-center gap-2">
        <span class="text-lg font-bold">Root</span>
        <CreateButton
          disabled={
            Object.keys(props.roots()).length === 0 || Object.keys(configurations).length === 0
          }
          onComplete={() => {
            const firstRoot = Object.keys(props.roots())[0];
            const firstConfiguration = Object.keys(configurations)[0];
            setRootConf({ ...rootConf, [firstRoot]: firstConfiguration });
          }}
          onValidate={() => {
            return true;
          }}
        />
      </div>
      {Object.entries(rootConf).map(([key, value]) => (
        <div class="ml-4 mr-4 mb-3 flex items-center gap-3">
          {/* First dropdown - select root */}
          <select
            value={key}
            class="flex-1 h-8 px-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500"
            onChange={(e) => {
              const newKey = e.currentTarget.value;
              if (newKey !== key) {
                const newRootConf = { ...rootConf };
                delete newRootConf[key];
                newRootConf[newKey] = value;
                setRootConf(newRootConf);
              }
            }}
          >
            {Object.keys(props.roots()).map((rootKey) => (
              <option value={rootKey}>{rootKey}</option>
            ))}
          </select>

          {/* Second dropdown - select configuration */}
          <select
            value={value}
            class="flex-1 h-8 px-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500"
            onChange={(e) => {
              setRootConf({ ...rootConf, [key]: e.currentTarget.value });
            }}
          >
            {Object.keys(configurations).map((configKey) => (
              <option value={configKey}>{configKey}</option>
            ))}
          </select>

          {/* Delete button */}
          <button
            class="w-6 h-6 flex items-center justify-center text-red-500 hover:text-red-600 rounded-md transition-colors cursor-pointer shrink-0"
            onClick={() => {
              const newRootConf = { ...rootConf };
              delete newRootConf[key];
              setRootConf(newRootConf);
            }}
          >
            <BsTrash size={14} />
          </button>
        </div>
      ))}
      <div class="pt-4 pl-4 mr-4 flex items-center gap-2">
        <span class="text-lg font-bold">Configurations</span>
        <CreateButton
          requireInput
          onComplete={(name) => {
            const configuration: Configuration = {
              strategy: [],
              fallbackIdx: '0',
            };
            setConfigurations({ ...configurations, [name]: configuration });
            console.log(unwrap(configurations));
            console.log(unwrap(props.deployment));
          }}
          onValidate={(name) => {
            const isAlphabetic = /^[a-zA-Z]+$/.test(name);
            const isUnique = !(name in configurations);
            return isAlphabetic && isUnique;
          }}
        />
      </div>
      {Object.entries(configurations).map(([key, value]) => (
        <DeploymentConfiguration name={key} configuration={value} hooks={availibleHooks} />
      ))}
    </div>
  );
};

interface RecordInputProps {
  class?: string;
  value: Accessor<Record<string, string>>;
  setValue: (value: Record<string, string>) => void;
}

export const RecordInput = (props: RecordInputProps) => {
  const [entry, setEntry] = createSignal<{ key: string; value: string }[]>(
    Object.entries(props.value()).map(([key, value]) => ({ key, value }))
  );
  const [editingIndex, setEditingIndex] = createSignal<number | null>(null);
  const [tempValues, setTempValues] = createSignal<{ key: string; value: string }>({
    key: '',
    value: '',
  });

  const startEdit = (index: number, item: { key: string; value: string }) => {
    setEditingIndex(index);
    setTempValues({ key: item.key, value: item.value });
  };

  const saveEdit = () => {
    const index = editingIndex();
    if (index !== null) {
      const newEntry = [...entry()];
      newEntry[index] = { ...tempValues() };
      setEntry(newEntry);
      setEditingIndex(null);
      setTempValues({ key: '', value: '' });
      const record = newEntry.reduce(
        (acc, item) => {
          acc[item.key] = item.value;
          return acc;
        },
        {} as Record<string, string>
      );
      props.setValue(record);
    }
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setTempValues({ key: '', value: '' });
  };

  const removeItem = (index: number) => {
    const newEntry = entry().filter((_, i) => i !== index);
    setEntry(newEntry);
    if (editingIndex() === index) {
      setEditingIndex(null);
      setTempValues({ key: '', value: '' });
    } else if (editingIndex() !== null && editingIndex()! > index) {
      setEditingIndex(editingIndex()! - 1);
    }
    const record = newEntry.reduce(
      (acc, item) => {
        acc[item.key] = item.value;
        return acc;
      },
      {} as Record<string, string>
    );
    props.setValue(record);
  };

  return (
    <div class={props.class}>
      {entry().map((item, index) => {
        const isEditing = editingIndex() === index;
        return (
          <div class="flex items-end gap-2 mb-2">
            <Input
              class="flex-1"
              label="Key"
              value={() => (isEditing ? tempValues().key : item.key)}
              onChange={(value) => {
                if (isEditing) {
                  setTempValues({ ...tempValues(), key: value });
                } else {
                  setEntry(
                    entry().map((entryItem, i) =>
                      i === index ? { ...entryItem, key: value } : entryItem
                    )
                  );
                }
              }}
              readOnly={!isEditing}
            />
            <Input
              class="flex-1"
              label="Value"
              value={() => (isEditing ? tempValues().value : item.value)}
              onChange={(value) => {
                if (isEditing) {
                  setTempValues({ ...tempValues(), value: value });
                } else {
                  setEntry(
                    entry().map((entryItem, i) =>
                      i === index ? { ...entryItem, value: value } : entryItem
                    )
                  );
                }
              }}
              readOnly={!isEditing}
            />
            <div class="flex gap-1 mt-6">
              {isEditing ? (
                <>
                  <button
                    class="w-8 h-8 flex items-center justify-center text-sm bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors"
                    onClick={saveEdit}
                  >
                    ✓
                  </button>
                  <button
                    class="w-8 h-8 flex items-center justify-center text-sm bg-gray-500 hover:bg-gray-600 text-white rounded-md transition-colors"
                    onClick={cancelEdit}
                  >
                    ×
                  </button>
                </>
              ) : (
                <>
                  <button
                    class="w-8 h-8 flex items-center justify-center text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
                    onClick={() => startEdit(index, item)}
                  >
                    ✏️
                  </button>
                  <button
                    class="w-8 h-8 flex items-center justify-center text-sm bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors"
                    onClick={() => removeItem(index)}
                  >
                    ×
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
      <button
        class="w-full p-2 text-sm rounded-md bg-blue-500 hover:bg-blue-600 text-white transition-colors mt-2"
        onClick={() => {
          const newEntry = [...entry(), { key: '', value: '' }];
          setEntry(newEntry);
          const record = newEntry.reduce(
            (acc, item) => {
              acc[item.key] = item.value;
              return acc;
            },
            {} as Record<string, string>
          );
          props.setValue(record);
        }}
      >
        +
      </button>
    </div>
  );
};
