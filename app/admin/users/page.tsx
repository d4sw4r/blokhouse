"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";

interface User {
    id: string;
    name: string;
    email: string;
}

export default function AdminUsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [newUser, setNewUser] = useState({ name: "", email: "", password: "" });
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editingUserData, setEditingUserData] = useState({ name: "", email: "" });

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
        fetchUsers();
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
                setNewUser({ name: "", email: "", password: "" });
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
        setEditingUserData({ name: user.name, email: user.email });
    };

    const cancelEditing = () => {
        setEditingUserId(null);
        setEditingUserData({ name: "", email: "" });
    };

    const updateUser = async (id: string) => {
        try {
            const res = await fetch(`/api/users/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingUserData),
            });
            if (res.ok) {
                const updated = await res.json();
                setUsers((prev) =>
                    prev.map((user) => (user.id === id ? updated : user))
                );
                cancelEditing();
            } else {
                console.error("Failed to update user:", await res.text());
            }
        } catch (error) {
            console.error("Error updating user:", error);
        }
    };

    if (loading) return <p>Loading users...</p>;

    return (
        <div className="min-h-screen bg-gray-100">
            <main className="max-w-7xl mx-auto p-6">
                <h1 className="text-3xl font-bold mb-4">Manage Users</h1>

                {/* New User Form */}
                <div className="bg-white p-6 rounded shadow mb-6">
                    <h2 className="text-2xl font-bold mb-2">Add New User</h2>
                    <div className="flex flex-col gap-4">
                        <input
                            type="text"
                            placeholder="Name"
                            value={newUser.name}
                            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                            className="border rounded p-2"
                        />
                        <input
                            type="email"
                            placeholder="Email"
                            value={newUser.email}
                            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                            className="border rounded p-2"
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={newUser.password}
                            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                            className="border rounded p-2"
                        />
                        <Button onClick={createUser}>Create User</Button>
                    </div>
                </div>

                {/* Users Table */}
                <div className="bg-white shadow rounded overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-200">
                            <tr>
                                <th className="py-2 px-4 border">Name</th>
                                <th className="py-2 px-4 border">Email</th>
                                <th className="py-2 px-4 border">Actions</th>
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
                                                    setEditingUserData({
                                                        ...editingUserData,
                                                        name: e.target.value,
                                                    })
                                                }
                                                className="border rounded p-1"
                                            />
                                        </td>
                                        <td className="py-2 px-4 border">
                                            <input
                                                type="email"
                                                value={editingUserData.email}
                                                onChange={(e) =>
                                                    setEditingUserData({
                                                        ...editingUserData,
                                                        email: e.target.value,
                                                    })
                                                }
                                                className="border rounded p-1"
                                            />
                                        </td>
                                        <td className="py-2 px-4 border flex gap-2">
                                            <Button onClick={() => updateUser(user.id)}>Save</Button>
                                            <Button onClick={cancelEditing}>
                                                Cancel
                                            </Button>
                                        </td>
                                    </tr>
                                ) : (
                                    <tr key={user.id}>
                                        <td className="py-2 px-4 border">{user.name}</td>
                                        <td className="py-2 px-4 border">{user.email}</td>
                                        <td className="py-2 px-4 border flex gap-2">
                                            <Button onClick={() => startEditing(user)}>Edit</Button>
                                            <Button onClick={() => deleteUser(user.id)}>
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
