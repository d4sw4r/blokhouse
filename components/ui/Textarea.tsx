import React, { forwardRef, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { controlClass } from "./Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
    ({ className, ...props }, ref) => (
        <textarea ref={ref} className={cn(controlClass, "min-h-20 py-2", className)} {...props} />
    )
);
Textarea.displayName = "Textarea";
