"use client";
import { useState, useEffect } from "react";
import { isValidIP, isValidMAC, getValidationColor } from "@/lib/validation";
import CopyButton from "./CopyButton";

interface ValidatedInputProps {
    type: "ip" | "mac";
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    showCopyButton?: boolean;
}

export default function ValidatedInput({
    type,
    value,
    onChange,
    placeholder,
    className = "",
    showCopyButton = false,
}: ValidatedInputProps) {
    const [isValid, setIsValid] = useState(true);
    const [isTouched, setIsTouched] = useState(false);

    useEffect(() => {
        const valid = type === "ip" ? isValidIP(value) : isValidMAC(value);
        setIsValid(valid);
    }, [value, type]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
    };

    const handleBlur = () => {
        setIsTouched(true);
    };

    const borderColor = !isTouched || isValid
        ? isValid && value
            ? "border-green-500"
            : "border-gray-300"
        : "border-red-500";

    const focusRing = !isTouched || isValid
        ? isValid && value
            ? "focus:ring-green-500 focus:border-green-500"
            : "focus:ring-brand-primary focus:border-brand-primary"
        : "focus:ring-red-500 focus:border-red-500";

    const label = type === "ip" ? "IP Address" : "MAC Address";
    const validationMessage = isTouched && !isValid
        ? type === "ip"
            ? "Invalid IP address (use IPv4: xxx.xxx.xxx.xxx or IPv6)"
            : "Invalid MAC address (use: XX:XX:XX:XX:XX:XX)"
        : null;

    return (
        <div className={`relative ${className}`}>
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={value}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder={placeholder || label}
                    className={`flex-1 border rounded-sm p-2 transition-colors ${borderColor} ${focusRing} focus:ring-2 focus:outline-none`}
                />
                {showCopyButton && value && (
                    <CopyButton text={value} />
                )}
            </div>
            
            {/* Validation indicator */}
            {value && (
                <div className="absolute right-10 top-1/2 transform -translate-y-1/2 pointer-events-none">
                    {isValid ? (
                        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    )}
                </div>
            )}
            
            {/* Validation message */}
            {validationMessage && (
                <p className="mt-1 text-sm text-red-600">{validationMessage}</p>
            )}
        </div>
    );
}
