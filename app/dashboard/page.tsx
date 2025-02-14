"use client";
import { useState, useEffect } from "react";

interface DashboardType {
    totalItems: number;
    totalTypes: number;
    untypedItems: number;
    itemsPerType: { itemTypeId: string; count: number; typeName?: string }[];
}

export default function Dashboard() {
    const [dashboard, setDashboard] = useState<DashboardType | null>(null);
    const [loading, setLoading] = useState(true);

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

    if (loading || !dashboard) return <p className="p-6 text-lg">Loading dashboard...</p>;

    return (
        <div className="min-h-screen bg-brandBackground">
            <main className="max-w-7xl mx-auto p-8">
                <h1 className="text-4xl font-bold text-brandPrimary mb-8">Dashboard</h1>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h2 className="text-xl font-semibold text-gray-700">Total Items</h2>
                        <p className="mt-4 text-4xl font-bold text-brandPrimary">{dashboard.totalItems}</p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h2 className="text-xl font-semibold text-gray-700">Total Types</h2>
                        <p className="mt-4 text-4xl font-bold text-brandPrimary">{dashboard.totalTypes}</p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h2 className="text-xl font-semibold text-gray-700">Untyped Items</h2>
                        <p className="mt-4 text-4xl font-bold text-brandPrimary">{dashboard.untypedItems}</p>
                    </div>
                </div>
                <div className="mt-12">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Items Per Type</h2>
                    {dashboard.itemsPerType.length === 0 ? (
                        <p className="text-gray-600">No items are assigned to a type.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {dashboard.itemsPerType.map((group) => (
                                <div key={group.itemTypeId} className="bg-white p-6 rounded-lg shadow">
                                    <h3 className="text-xl font-semibold text-gray-700">{group.typeName}</h3>
                                    <p className="mt-2 text-3xl font-bold text-brandPrimary">{group.count}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
