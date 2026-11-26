"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/Button";

interface User {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "USER" | "API" | "AUDIT" | "READONLY";
    sso?: boolean;
    roleManagedBySso?: boolean;
    disabledAt?: string | null;
}

async function errorText(res: Response, fallback: string) {
    try {
        const data = await res.json();
        return data?.error || fallback;
    } catch {
        return fallback;
    }
}

export default function AdminUsersPage() {
    const { data: session } = useSession();
    const currentEmail = session?.user?.email;
    const [actionError, setActionError] = useState<string | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "USER" });
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editingUserData, setEditingUserData] = useState({ name: "", email: "", role: "" });

    const fetchUsers = async () => {
        try {
            const res = await fetch("/api/users");
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            } else {
                console.error("Failed to fetch users:", await res.text());
            }
        } catch (error) {
            console.error("Error fetching users:", error);
        }
        setLoading(false);
    };

    useEffect(() => {
        const load = async () => { await fetchUsers(); };
        load();
    }, []);

    const createUser = async () => {
        try {
            const res = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newUser),
            });
            if (res.ok) {
                const created = await res.json();
                setUsers((prev) => [...prev, created]);
                setNewUser({ name: "", email: "", password: "", role: "USER" });
            } else {
                console.error("Failed to create user:", await res.text());
            }
        } catch (error) {
            console.error("Error creating user:", error);
        }
    };

    const deleteUser = async (id: string) => {
        try {
            const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
            if (res.ok) {
                setUsers((prev) => prev.filter((user) => user.id !== id));
            } else {
                console.error("Failed to delete user:", await res.text());
            }
        } catch (error) {
            console.error("Error deleting user:", error);
        }
    };

    const startEditing = (user: User) => {
        setEditingUserId(user.id);
        setEditingUserData({ name: user.name, email: user.email, role: user.role });
    };

    const cancelEditing = () => {
        setEditingUserId(null);
        setEditingUserData({ name: "", email: "", role: "" });
    };

    const updateUser = async (id: string) => {
        setActionError(null);
        try {
            const res = await fetch(`/api/users/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingUserData),
            });
            if (res.ok) {
                const updated = await res.json();
                setUsers((prev) => prev.map((user) => (user.id === id ? updated : user)));
                cancelEditing();
            } else {
                setActionError(await errorText(res, "Failed to update user"));
            }
        } catch (error) {
            console.error("Error updating user:", error);
            setActionError("Failed to update user");
        }
    };

    const setDisabled = async (id: string, disabled: boolean) => {
        setActionError(null);
        try {
            const res = await fetch(`/api/users/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ disabled }),
            });
            if (res.ok) {
                const updated = await res.json();
                setUsers((prev) => prev.map((user) => (user.id === id ? updated : user)));
            } else {
                setActionError(await errorText(res, "Failed to update user"));
            }
        } catch (error) {
            console.error("Error updating user:", error);
            setActionError("Failed to update user");
        }
    };

    if (loading) return <p className="text-lg text-brand-text">Loading users...</p>;

    return (
        <div className="min-h-screen bg-brand-background">
            <main className="max-w-7xl mx-auto p-8 space-y-8">
                <h1 className="text-4xl font-bold text-brand-text">Manage Users</h1>

                {actionError && (
                    <p role="alert" className="bg-red-50 border border-red-300 text-red-700 rounded-sm p-3">
                        {actionError}
                    </p>
                )}

                {/* New User Form */}
                <div className="bg-white p-6 rounded-sm shadow-sm">
                    <h2 className="text-2xl font-semibold text-brand-text mb-4">Add New User</h2>
                    <div className="space-y-4">
                        <input
                            type="text"
                            placeholder="Name"
                            value={newUser.name}
                            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                            className="w-full border rounded-sm p-2"
                        />
                        <input
                            type="email"
                            placeholder="Email"
                            value={newUser.email}
                            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                            className="w-full border rounded-sm p-2"
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={newUser.password}
                            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                            className="w-full border rounded-sm p-2"
                        />
                        <select
                            value={newUser.role}
                            onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                            className="w-full border rounded-sm p-2"
                        >
                            <option value="ADMIN">ADMIN</option>
                            <option value="USER">USER</option>
                            <option value="API">API</option>
                            <option value="AUDIT">AUDIT</option>
                            <option value="READONLY">READONLY</option>
                        </select>
                        <Button onClick={createUser}>Create User</Button>
                    </div>
                </div>

                {/* Users Table */}
                <div className="bg-white shadow-sm rounded-sm overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-brand-primary/10">
                            <tr>
                                <th className="py-3 px-4 border">Name</th>
                                <th className="py-3 px-4 border">Email</th>
                                <th className="py-3 px-4 border">Role</th>
                                <th className="py-3 px-4 border">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) =>
                                editingUserId === user.id ? (
                                    <tr key={user.id}>
                                        <td className="py-2 px-4 border">
                                            <input
                                                type="text"
                                                value={editingUserData.name}
                                                onChange={(e) =>
                                                    setEditingUserData({ ...editingUserData, name: e.target.value })
                                                }
                                                className="w-full border rounded-sm p-1"
                                            />
                                        </td>
                                        <td className="py-2 px-4 border">
                                            <input
                                                type="email"
                                                value={editingUserData.email}
                                                onChange={(e) =>
                                                    setEditingUserData({ ...editingUserData, email: e.target.value })
                                                }
                                                className="w-full border rounded-sm p-1"
                                            />
                                        </td>
                                        <td className="py-2 px-4 border">
                                            <select
                                                value={editingUserData.role}
                                                onChange={(e) =>
                                                    setEditingUserData({ ...editingUserData, role: e.target.value })
                                                }
                                                disabled={user.roleManagedBySso}
                                                className="w-full border rounded-sm p-1 disabled:bg-gray-100 disabled:text-gray-500"
                                            >
                                                <option value="ADMIN">ADMIN</option>
                                                <option value="USER">USER</option>
                                                <option value="API">API</option>
                                                <option value="AUDIT">AUDIT</option>
                            <option value="READONLY">READONLY</option>
                                            </select>
                                            {user.roleManagedBySso && (
                                                <p className="text-xs text-gray-500 mt-1">Role is managed by SSO.</p>
                                            )}
                                        </td>
                                        <td className="py-2 px-4 border flex gap-2">
                                            <Button onClick={() => updateUser(user.id)}>Save</Button>
                                            <Button onClick={cancelEditing} variant="outline">
                                                Cancel
                                            </Button>
                                        </td>
                                    </tr>
                                ) : (
                                    <tr key={user.id}>
                                        <td className="py-2 px-4 border">
                                            <span className={user.disabledAt ? "text-gray-400 line-through" : ""}>{user.name}</span>
                                            {user.sso && (
                                                <span className="ml-2 text-xs font-semibold bg-brand-primary/10 text-brand-primary rounded-sm px-2 py-0.5">
                                                    SSO
                                                </span>
                                            )}
                                            {user.disabledAt && (
                                                <span className="ml-2 text-xs font-semibold bg-gray-200 text-gray-700 rounded-sm px-2 py-0.5">
                                                    Deactivated
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2 px-4 border">{user.email}</td>
                                        <td className="py-2 px-4 border">
                                            {user.role}
                                            {user.roleManagedBySso && (
                                                <span className="block text-xs text-gray-500">Managed by SSO</span>
                                            )}
                                        </td>
                                        <td className="py-2 px-4 border flex gap-2">
                                            <Button onClick={() => startEditing(user)}>Edit</Button>
                                            {user.email !== currentEmail && (
                                                <Button
                                                    onClick={() => setDisabled(user.id, !user.disabledAt)}
                                                    variant="outline"
                                                >
                                                    {user.disabledAt ? "Activate" : "Deactivate"}
                                                </Button>
                                            )}
                                            <Button onClick={() => deleteUser(user.id)} variant="destructive">
                                                Delete
                                            </Button>
                                        </td>
                                    </tr>
                                )
                            )}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}
