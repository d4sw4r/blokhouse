"use client";

import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

export interface TagFormValues {
    name: string;
    color: string;
    description: string;
}

export interface TagFormErrors {
    name?: string;
    color?: string;
    submit?: string;
    [key: string]: string | undefined;
}

export const DEFAULT_TAG_COLOR = "#3b82f6";

export const EMPTY_TAG: TagFormValues = { name: "", color: DEFAULT_TAG_COLOR, description: "" };

/** Validation shared by every place that creates or edits a tag. */
export function validateTag(values: TagFormValues): TagFormErrors {
    const errors: TagFormErrors = {};
    if (!values.name.trim()) {
        errors.name = "Tag name is required";
    }
    if (values.color && !/^#[0-9A-Fa-f]{6}$/.test(values.color)) {
        errors.color = "Invalid hex color format";
    }
    return errors;
}

interface TagFormProps {
    /** Prefix for the field ids, so two forms on a page never share ids. */
    idPrefix: string;
    values: TagFormValues;
    onChange: (values: TagFormValues) => void;
    errors?: TagFormErrors;
    withPlaceholders?: boolean;
}

/** The fields of the tag form: name, colour (picker plus hex input) and description. The
 *  caller owns the state, the submit button and the API call. */
export function TagForm({ idPrefix, values, onChange, errors = {}, withPlaceholders = false }: TagFormProps) {
    return (
        <div className="space-y-4">
            <Field label="Name *" htmlFor={`${idPrefix}-name`} error={errors.name}>
                <Input
                    id={`${idPrefix}-name`}
                    type="text"
                    value={values.name}
                    onChange={(e) => onChange({ ...values, name: e.target.value })}
                    placeholder={withPlaceholders ? "e.g., production" : undefined}
                />
            </Field>
            <Field label="Color" htmlFor={`${idPrefix}-color`} error={errors.color}>
                <div className="flex items-center gap-3">
                    <input
                        type="color"
                        aria-label="Pick a colour"
                        value={values.color}
                        onChange={(e) => onChange({ ...values, color: e.target.value })}
                        className="h-9 w-16 shrink-0 cursor-pointer rounded-md border border-border-strong bg-surface p-1 max-sm:h-11"
                    />
                    <Input
                        id={`${idPrefix}-color`}
                        type="text"
                        value={values.color}
                        onChange={(e) => onChange({ ...values, color: e.target.value })}
                        className="min-w-0 flex-1 font-mono"
                        placeholder={withPlaceholders ? DEFAULT_TAG_COLOR : undefined}
                    />
                </div>
            </Field>
            <Field label="Description" htmlFor={`${idPrefix}-description`}>
                <Textarea
                    id={`${idPrefix}-description`}
                    value={values.description}
                    onChange={(e) => onChange({ ...values, description: e.target.value })}
                    rows={3}
                    placeholder={withPlaceholders ? "Optional description for this tag" : undefined}
                />
            </Field>
            {errors.submit && (
                <p role="alert" className="text-sm text-danger">{errors.submit}</p>
            )}
        </div>
    );
}
