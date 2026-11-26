"use client";
import { useState } from "react";
import { Check, X } from "lucide-react";
import { isValidIP, isValidMAC } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { controlClass } from "@/components/ui/Input";
import CopyButton from "./CopyButton";

interface ValidatedInputProps {
    type: "ip" | "mac";
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    showCopyButton?: boolean;
    id?: string;
}

export default function ValidatedInput({
    type,
    value,
    onChange,
    placeholder,
    className = "",
    showCopyButton = false,
    id,
}: ValidatedInputProps) {
    const [isTouched, setIsTouched] = useState(false);

    // Derived — no useEffect needed
    const isValid = !value || (type === "ip" ? isValidIP(value) : isValidMAC(value));

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
    };

    const handleBlur = () => {
        setIsTouched(true);
    };

    const invalid = isTouched && !isValid;
    const validAndFilled = !invalid && isValid && !!value;

    const label = type === "ip" ? "IP address" : "MAC address";
    const validationMessage = invalid
        ? type === "ip"
            ? "Invalid IP address (use IPv4: xxx.xxx.xxx.xxx or IPv6)"
            : "Invalid MAC address (use: XX:XX:XX:XX:XX:XX)"
        : null;
    const messageId = id ? `${id}-validation` : undefined;

    return (
        <div className={cn("relative min-w-0", className)}>
            <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                    <input
                        id={id}
                        type="text"
                        value={value}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder={placeholder || label}
                        aria-invalid={invalid || undefined}
                        aria-describedby={invalid ? messageId : undefined}
                        className={cn(
                            controlClass,
                            "h-9 pr-9 font-mono text-[13px] max-sm:min-h-11",
                            validAndFilled && "border-success",
                            invalid && "border-danger",
                        )}
                    />
                    {/* Validation indicator */}
                    {value && (
                        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
                            {isValid ? (
                                <Check className="size-4 text-success" aria-hidden="true" />
                            ) : (
                                <X className="size-4 text-danger" aria-hidden="true" />
                            )}
                        </span>
                    )}
                </div>
                {showCopyButton && value && <CopyButton text={value} />}
            </div>

            {/* Validation message */}
            {validationMessage && (
                <p id={messageId} role="alert" className="mt-1 text-xs text-danger">
                    {validationMessage}
                </p>
            )}
        </div>
    );
}
