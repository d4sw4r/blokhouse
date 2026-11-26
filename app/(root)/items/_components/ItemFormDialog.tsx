"use client";

import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import ValidatedInput from "@/components/ValidatedInput";
import { TagToggle } from "@/components/TagToggle";
import { statusOptions, type AssetStatus, type ItemFormData, type Tag, type Type } from "./types";

interface ItemFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    submitLabel: string;
    idPrefix: string;
    data: ItemFormData;
    onChange: (data: ItemFormData) => void;
    availableTypes: Type[];
    availableTags: Tag[];
    onToggleTag: (tagId: string) => void;
    onSubmit: () => void;
}

export function ItemFormDialog({
    open,
    onOpenChange,
    title,
    submitLabel,
    idPrefix,
    data,
    onChange,
    availableTypes,
    availableTags,
    onToggleTag,
    onSubmit,
}: ItemFormDialogProps) {
    const formId = `${idPrefix}-form`;
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                title={title}
                className="max-w-2xl"
                footer={
                    <>
                        <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" form={formId}>
                            {submitLabel}
                        </Button>
                    </>
                }
            >
                <form
                    id={formId}
                    noValidate
                    onSubmit={(e) => {
                        e.preventDefault();
                        onSubmit();
                    }}
                    className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                >
                    <Field label="Name" htmlFor={`${idPrefix}-name`}>
                        <Input
                            id={`${idPrefix}-name`}
                            type="text"
                            placeholder="Name"
                            value={data.name}
                            onChange={(e) => onChange({ ...data, name: e.target.value })}
                            className="font-mono text-[13px]"
                        />
                    </Field>
                    <Field label="Description" htmlFor={`${idPrefix}-description`}>
                        <Input
                            id={`${idPrefix}-description`}
                            type="text"
                            placeholder="Description"
                            value={data.description}
                            onChange={(e) => onChange({ ...data, description: e.target.value })}
                        />
                    </Field>
                    <Field label="IP address" htmlFor={`${idPrefix}-ip`}>
                        <ValidatedInput
                            id={`${idPrefix}-ip`}
                            type="ip"
                            value={data.ip}
                            onChange={(value) => onChange({ ...data, ip: value })}
                            placeholder="e.g. 192.168.1.1"
                        />
                    </Field>
                    <Field label="MAC address" htmlFor={`${idPrefix}-mac`}>
                        <ValidatedInput
                            id={`${idPrefix}-mac`}
                            type="mac"
                            value={data.mac}
                            onChange={(value) => onChange({ ...data, mac: value })}
                            placeholder="e.g. 00:11:22:33:44:55"
                        />
                    </Field>
                    <Field label="Type" htmlFor={`${idPrefix}-type`}>
                        <Select
                            id={`${idPrefix}-type`}
                            value={data.itemTypeId}
                            onValueChange={(value) => onChange({ ...data, itemTypeId: value })}
                            placeholder="Select a type (optional)"
                            options={[
                                { value: "", label: "None" },
                                ...availableTypes.map((type) => ({ value: type.id, label: type.name })),
                            ]}
                        />
                    </Field>
                    <Field label="Status" htmlFor={`${idPrefix}-status`}>
                        <Select
                            id={`${idPrefix}-status`}
                            value={data.status}
                            onValueChange={(value) => onChange({ ...data, status: value as AssetStatus })}
                            options={statusOptions}
                        />
                    </Field>
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                        <span id={`${idPrefix}-tags-label`} className="text-sm font-medium text-text">
                            Tags
                        </span>
                        <div role="group" aria-labelledby={`${idPrefix}-tags-label`} className="flex flex-wrap gap-2">
                            {availableTags.map((tag) => (
                                <TagToggle
                                    key={tag.id}
                                    tag={tag}
                                    selected={data.tagIds.includes(tag.id)}
                                    onToggle={() => onToggleTag(tag.id)}
                                />
                            ))}
                            {availableTags.length === 0 && (
                                <span className="text-sm text-muted">No tags available. Create some with the Tags button.</span>
                            )}
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
