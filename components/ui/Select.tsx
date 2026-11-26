"use client";
import React from "react";
import { Select as SelectPrimitive } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { controlClass } from "./Input";

// Radix forbids empty-string item values, so an option whose value is "" is mapped to
// this sentinel internally and back to "" for callers.
const EMPTY = "__empty__";
const toInner = (v: string) => (v === "" ? EMPTY : v);
const toOuter = (v: string) => (v === EMPTY ? "" : v);

export interface SelectProps {
    value?: string;
    onValueChange?: (value: string) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
    id?: string;
    disabled?: boolean;
    className?: string;
    "aria-label"?: string;
}

export function Select({ value, onValueChange, options, placeholder, id, disabled, className, ...rest }: SelectProps) {
    const hasEmpty = options.some((o) => o.value === "");
    // "" with no matching "none" option means "nothing selected" -> show placeholder.
    // Always a string so Radix stays controlled; "" (no matching option) shows the placeholder.
    const inner = value === undefined || (value === "" && !hasEmpty) ? "" : toInner(value);
    return (
        <SelectPrimitive.Root
            value={inner}
            onValueChange={(v) => onValueChange?.(toOuter(v))}
            disabled={disabled}
        >
            <SelectPrimitive.Trigger
                id={id}
                aria-label={rest["aria-label"]}
                className={cn(
                    controlClass,
                    "inline-flex h-9 items-center justify-between gap-2 text-left max-sm:min-h-11 data-[placeholder]:text-muted",
                    className,
                )}
            >
                <span className="min-w-0 truncate">
                    <SelectPrimitive.Value placeholder={placeholder} />
                </span>
                <SelectPrimitive.Icon asChild>
                    <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden="true" />
                </SelectPrimitive.Icon>
            </SelectPrimitive.Trigger>
            <SelectPrimitive.Portal>
                <SelectPrimitive.Content
                    position="popper"
                    sideOffset={4}
                    className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-md border border-border bg-surface text-text shadow-lg"
                >
                    <SelectPrimitive.Viewport className="p-1">
                        {options.map((o) => (
                            <SelectPrimitive.Item
                                key={o.value}
                                value={toInner(o.value)}
                                className="relative flex min-h-8 cursor-default select-none items-center rounded-sm py-1.5 pr-3 pl-8 text-sm outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2 data-[highlighted]:outline-solid data-[highlighted]:outline-2 data-[highlighted]:-outline-offset-2 data-[highlighted]:outline-accent max-sm:min-h-11"
                            >
                                <span className="absolute left-2 inline-flex size-4 items-center justify-center">
                                    <SelectPrimitive.ItemIndicator>
                                        <Check className="size-4 text-accent" aria-hidden="true" />
                                    </SelectPrimitive.ItemIndicator>
                                </span>
                                <span className="min-w-0 truncate" title={o.label}><SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText></span>
                            </SelectPrimitive.Item>
                        ))}
                    </SelectPrimitive.Viewport>
                </SelectPrimitive.Content>
            </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
    );
}
