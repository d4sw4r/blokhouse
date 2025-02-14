"use client";
import ThreeBackground from "@/components/ThreeBackground";
import Link from "next/link";
import { useSession } from "next-auth/react";

export default function LandingPage() {
  const { data: session } = useSession();

  return (
    <div className="relative min-h-screen bg-brandBackground">
      <ThreeBackground />
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen text-center px-4">
        <h1 className="text-5xl font-bold text-brandPrimary mb-4">Welcome to Blokhouse</h1>
        <p className="text-xl text-gray-700 mb-8">
          A modern CMDB solution to manage your infrastructure.
        </p>
        {session ? (
          <Link href="/dashboard" className="px-8 py-4 bg-brandPrimary text-white rounded-md shadow hover:bg-brandAccent transition">
            Go to Dashboard
          </Link>
        ) : (
          <Link href="/signin" className="px-8 py-4 bg-brandPrimary text-white rounded-md shadow hover:bg-brandAccent transition">
            Sign In
          </Link>
        )}
      </div>
    </div>
  );
}
