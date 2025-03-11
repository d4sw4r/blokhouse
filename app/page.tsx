"use client";
import ThreeBackground from "@/components/ThreeBackground";
import Link from "next/link";


export default function LandingPage() {


  return (
    <div className="">
      <ThreeBackground />
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen text-center px-4">
        <h1 className="text-5xl font-bold text-brand-primary mb-4">Welcome to Blokhouse</h1>
        <p className="text-xl text-gray-700 mb-8">
          A modern CMDB solution to manage your infrastructure.
        </p>

        <Link href="/signin" className="px-8 py-4 bg-brand-primary text-white rounded-md shadow-sm hover:bg-brand-accent transition">
          Sign In
        </Link>

      </div>
    </div >
  );
}
