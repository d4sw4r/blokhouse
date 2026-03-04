"use client";
import Image from "next/image";

export default function Logo() {
    return (
        <div className="flex items-center gap-3">
            <Image src="/logo.svg" alt="Blokhouse" width={40} height={40} />
            <span className="text-xl font-bold text-brand-primary">Blokhouse</span>
        </div>
    );
}