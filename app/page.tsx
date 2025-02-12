"use client";

import { useState, useEffect } from "react";
import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";

interface DashboardType {
  totalItems: number;
  totalTypes: number;
  untypedItems: number;
  itemsPerType: {
    itemTypeId: string;
    count: number;
    typeName?: string;
  }[];
}

export default function Dashboard() {
  const [dashboard, setDashboard] = useState<DashboardType | null>(null);
  const [loading, setLoading] = useState(true);
  const { data: session, status } = useSession();

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch("/api/dashboard");
        if (res.ok) {
          const data = await res.json();
          setDashboard(data);
        } else {
          console.error("Failed to fetch dashboard data:", await res.text());
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      }
      setLoading(false);
    };
    fetchDashboard();
  }, []);

  if (!session)
    redirect("/signin")
  if (loading || dashboard === null) {
    return <p className="p-6">Loading dashboard...</p>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <main className="max-w-7xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded shadow">
            <h2 className="text-xl font-bold">Total Items</h2>
            <p className="text-4xl mt-2">{dashboard.totalItems}</p>
          </div>
          <div className="bg-white p-6 rounded shadow">
            <h2 className="text-xl font-bold">Total Types</h2>
            <p className="text-4xl mt-2">{dashboard.totalTypes}</p>
          </div>
          <div className="bg-white p-6 rounded shadow">
            <h2 className="text-xl font-bold">Untyped Items</h2>
            <p className="text-4xl mt-2">{dashboard.untypedItems}</p>
          </div>
        </div>
        <div className="mt-10">
          <h2 className="text-2xl font-bold mb-4">Items Per Type</h2>
          {dashboard.itemsPerType.length === 0 ? (
            <p>No items are assigned to a type.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {dashboard.itemsPerType.map((group) => (
                <div
                  key={group.itemTypeId}
                  className="bg-white p-6 rounded shadow"
                >
                  <h3 className="text-xl font-bold">{group.typeName}</h3>
                  <p className="text-3xl mt-2">{group.count}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
