"use client";

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import ThreeBackground from '../components/ThreeBackground';


export default function Dashboard() {
  const { data: session } = useSession();

  if (!session)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>You are not signed in. </p>
        <Link href="/signin">
          <span className="text-blue-500 hover:underline">Sign In</span>
        </Link>
      </div>
    );
  return (
    <ThreeBackground />
  );


}

