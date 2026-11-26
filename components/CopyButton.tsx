"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
    text: string;
    className?: string;
}

export default function CopyButton({ text, className = "" }: CopyButtonProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        if (!text) return;

        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    if (!text) return null;

    return (
        <button
            onClick={handleCopy}
            className={cn(
                "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-150 motion-reduce:transition-none hover:bg-surface-2 hover:text-text max-sm:size-11",
                className,
            )}
            title={copied ? "Copied" : "Copy to clipboard"}
            aria-label={copied ? "Copied" : "Copy to clipboard"}
            type="button"
        >
            {copied ? (
                <Check className="size-4 text-text" aria-hidden="true" />
            ) : (
                <Copy className="size-4" aria-hidden="true" />
            )}
        </button>
    );
}
