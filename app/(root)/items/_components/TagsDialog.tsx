"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { TagForm, validateTag, type TagFormErrors } from "@/components/TagForm";
import { TagBadge } from "@/components/TagBadge";
import type { Tag } from "./types";

interface TagsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tags: Tag[];
    onRequestDelete: (tag: Tag) => void;
    name: string;
    onNameChange: (value: string) => void;
    color: string;
    onColorChange: (value: string) => void;
    description: string;
    onDescriptionChange: (value: string) => void;
    onCreate: () => void;
}

export function TagsDialog({
    open,
    onOpenChange,
    tags,
    onRequestDelete,
    name,
    onNameChange,
    color,
    onColorChange,
    description,
    onDescriptionChange,
    onCreate,
}: TagsDialogProps) {
    const [errors, setErrors] = useState<TagFormErrors>({});
    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (!o) setErrors({});
                onOpenChange(o);
            }}
        >
            <DialogContent
                title="Tags"
                description="Create and delete the tags used to label configuration items."
                footer={
                    <Button variant="secondary" onClick={() => {
                            setErrors({});
                            onOpenChange(false);
                        }}>
                        Close
                    </Button>
                }
            >
                <div className="space-y-5">
                    <div>
                        <h3 className="mb-2 text-sm font-medium text-text">Existing tags</h3>
                        {tags.length === 0 ? (
                            <p className="text-sm text-muted">No tags created yet.</p>
                        ) : (
                            <ul className="flex flex-wrap gap-2">
                                {tags.map((tag) => (
                                    <li key={tag.id} className="flex max-w-full items-center gap-0.5">
                                        <TagBadge tag={tag} />
                                        <button
                                            type="button"
                                            onClick={() => onRequestDelete(tag)}
                                            aria-label={`Delete tag ${tag.name}`}
                                            title={`Delete tag ${tag.name}`}
                                            className="inline-flex size-6 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text max-sm:size-11"
                                        >
                                            <X className="size-3.5" aria-hidden="true" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <form
                        noValidate
                        onSubmit={(e) => {
                            e.preventDefault();
                            const found = validateTag({ name, color, description });
                            setErrors(found);
                            if (Object.keys(found).length === 0) onCreate();
                        }}
                        className="space-y-4 border-t border-border pt-4"
                    >
                        <h3 className="text-sm font-medium text-text">Create new tag</h3>
                        <TagForm
                            idPrefix="new-tag"
                            values={{ name, color, description }}
                            onChange={(v) => {
                                onNameChange(v.name);
                                onColorChange(v.color);
                                onDescriptionChange(v.description);
                            }}
                            errors={errors}
                            withPlaceholders
                        />
                        <Button type="submit">Create</Button>
                    </form>
                </div>
            </DialogContent>
        </Dialog>
    );
}
