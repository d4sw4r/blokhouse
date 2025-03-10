"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";

interface ApiToken {
    id: string;
    token: string;
    createdAt: string;
}

export default function AdminAPIPage() {
    const [tokens, setTokens] = useState<ApiToken[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTokens = async () => {
        try {
            const res = await fetch("/api/api-tokens");
            if (res.ok) {
                const data = await res.json();
                setTokens(data);
            } else {
                console.error("Failed to fetch tokens:", await res.text());
            }
        } catch (error) {
            console.error("Error fetching tokens:", error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchTokens();
    }, []);

    const generateToken = async () => {
        try {
            const res = await fetch("/api/api-tokens", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            if (res.ok) {
                const newToken = await res.json();
                setTokens((prev) => [...prev, newToken]);
            } else {
                console.error("Failed to generate token:", await res.text());
            }
        } catch (error) {
            console.error("Error generating token:", error);
        }
    };

    const deleteToken = async (id: string) => {
        try {
            const res = await fetch(`/api/api-tokens/${id}`, { method: "DELETE" });
            if (res.ok) {
                setTokens((prev) => prev.filter((token) => token.id !== id));
            } else {
                console.error("Failed to delete token:", await res.text());
            }
        } catch (error) {
            console.error("Error deleting token:", error);
        }
    };

    if (loading) return <p className="text-lg">Loading tokens...</p>;

    return (
        <div className="space-y-6">
            <h1 className="text-4xl font-bold text-gray-800">API Token Management</h1>
            <p className="text-lg text-gray-600">
                Create and manage API tokens for accessing your /api routes.
            </p>
            <Button onClick={generateToken} className="mt-4">
                Generate API Token
            </Button>
            <div className="overflow-x-auto mt-6">
                {tokens.length === 0 ? (
                    <p className="text-gray-600">No API tokens found.</p>
                ) : (
                    <table className="min-w-full bg-white shadow rounded">
                        <thead className="bg-gray-200">
                            <tr>
                                <th className="py-2 px-4 border">Token</th>
                                <th className="py-2 px-4 border">Created At</th>
                                <th className="py-2 px-4 border">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tokens.map((token) => (
                                <tr key={token.id}>
                                    <td className="py-2 px-4 border font-mono">{token.token}</td>
                                    <td className="py-2 px-4 border">
                                        {new Date(token.createdAt).toLocaleString()}
                                    </td>
                                    <td className="py-2 px-4 border">
                                        <Button onClick={() => deleteToken(token.id)} >
                                            Delete
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
