"use client";

import Image from 'next/image';

export default function Logo() {
    return (
        <div className="flex items-center">
            <Image src="/logo.svg" alt="Blokhouse Logo" width={50} height={50} />
            <span className="ml-2 text-2xl font-bold text-brandWood">Blokhouse</span>
        </div>
    );
}

