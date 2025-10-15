import { Accessor, createEffect, createSignal, JSX } from "solid-js";
import type { Deployment } from "../hooks/useAppConf";
import { Input } from "./Input";

interface DeploymentCardProps {
    name: string;
    deployment: Deployment;
    setDeployment: (deployment: Deployment) => void;
}

export const DeploymentCard = (props: DeploymentCardProps) => {
    return (
        <div class="border border-gray-300 pb-4 ml-4 mr-4 rounded-md">
            <span class="text-lg font-bold pt-4 pl-4">{props.name}</span>
            <div class="ml-4 mr-4">
                <Input
                    label="Chain ID"
                    value={() => props.deployment.chainId}
                />
            </div>
            <div class="ml-4 mr-4">
                <Input
                    label="Rpc Url"
                    value={() => props.deployment.rpcUrl}
                />
            </div>
            <span class="text-lg font-bold pt-4 pl-4">Roles</span>
            <RecordInput class="pl-6 ml-6 mr-4" value={() => props.deployment.roles} setValue={(value) => props.setDeployment({ ...props.deployment, roles: value })} />
            <span class="text-lg font-bold pt-4 pl-4">Extra</span>
            <RecordInput class="pl-6 ml-6 mr-4" value={() => props.deployment.extra} setValue={(value) => props.setDeployment({ ...props.deployment, extra: value })} />
        </div>
    )
}

interface RecordInputProps {
    class?: string;
    value: Accessor<Record<string, string>>;
    setValue: (value: Record<string, string>) => void;
}

export const RecordInput = (props: RecordInputProps) => {
    const [entry, setEntry] = createSignal<{ key: string, value: string }[]>(
        Object.entries(props.value()).map(([key, value]) => ({ key, value }))
    );
    const [editingIndex, setEditingIndex] = createSignal<number | null>(null);
    const [tempValues, setTempValues] = createSignal<{ key: string, value: string }>({ key: '', value: '' });

    const startEdit = (index: number, item: { key: string, value: string }) => {
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
            // 更新父组件状态
            const record = newEntry.reduce((acc, item) => {
                acc[item.key] = item.value;
                return acc;
            }, {} as Record<string, string>);
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
        // 更新父组件状态
        const record = newEntry.reduce((acc, item) => {
            acc[item.key] = item.value;
            return acc;
        }, {} as Record<string, string>);
        props.setValue(record);
    };

    return (
        <div class={props.class}>
            {
                entry().map((item, index) => {
                    const isEditing = editingIndex() === index;
                    return (
                        <div class="flex items-end gap-2 mb-2">
                            <Input
                                class="flex-1"
                                label="Key"
                                value={() => isEditing ? tempValues().key : item.key}
                                onChange={(value) => {
                                    if (isEditing) {
                                        setTempValues({ ...tempValues(), key: value });
                                    } else {
                                        setEntry(entry().map((entryItem, i) => i === index ? { ...entryItem, key: value } : entryItem));
                                    }
                                }}
                                readOnly={!isEditing}
                            />
                            <Input
                                class="flex-1"
                                label="Value"
                                value={() => isEditing ? tempValues().value : item.value}
                                onChange={(value) => {
                                    if (isEditing) {
                                        setTempValues({ ...tempValues(), value: value });
                                    } else {
                                        setEntry(entry().map((entryItem, i) => i === index ? { ...entryItem, value: value } : entryItem));
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
                })
            }
            <button
                class="w-full p-2 text-sm rounded-md bg-blue-500 hover:bg-blue-600 text-white transition-colors mt-2"
                onClick={() => {
                    const newEntry = [...entry(), { key: '', value: '' }];
                    setEntry(newEntry);
                    // 更新父组件状态
                    const record = newEntry.reduce((acc, item) => {
                        acc[item.key] = item.value;
                        return acc;
                    }, {} as Record<string, string>);
                    props.setValue(record);
                }}
            >
                +
            </button>
        </div>
    )
}