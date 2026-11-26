"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/IconButton";

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
        <IconButton
            size="sm"
            icon={copied ? Check : Copy}
            label={copied ? "Copied" : "Copy to clipboard"}
            onClick={handleCopy}
            className={cn("shrink-0", copied && "[&>svg]:text-text", className)}
        />
    );
}
