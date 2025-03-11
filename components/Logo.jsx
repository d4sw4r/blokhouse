"use client";
import Image from "next/image";

export default function Logo() {
    return (
        <div className="flex items-center">
            <Image src="/logo.svg" alt="Blokhouse Logo" width={48} height={48} />
            <span className="ml-3 text-2xl font-bold text-brand-primary">Blokhouse</span>
        </div>
    );
}
