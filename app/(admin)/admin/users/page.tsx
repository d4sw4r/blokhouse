"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Select } from "@/components/ui/Select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { SkeletonTable } from "@/components/Skeleton";

interface User {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "USER" | "API" | "AUDIT" | "READONLY";
    sso?: boolean;
    roleManagedBySso?: boolean;
    disabledAt?: string | null;
}

const ROLE_OPTIONS = ["ADMIN", "USER", "API", "AUDIT", "READONLY"].map((r) => ({ value: r, label: r }));

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
    const currentId = (session?.user as { id?: string } | undefined)?.id;
    const [actionError, setActionError] = useState<string | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "USER" });
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editingUserData, setEditingUserData] = useState({ name: "", email: "", role: "" });
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [userToDeleteOpen, setUserToDeleteOpen] = useState(false);
    const [userToDeactivate, setUserToDeactivate] = useState<User | null>(null);
    const [userToDeactivateOpen, setUserToDeactivateOpen] = useState(false);

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

    const header = <PageHeader title="Users" description="Create accounts, change roles and deactivate or delete users." />;

    if (loading)
        return (
            <div className="space-y-6">
                {header}
                <SkeletonTable rows={6} />
            </div>
        );

    return (
        <div className="space-y-6">
            {header}

            {actionError && (
                <Callout tone="danger" role="alert">
                    {actionError}
                </Callout>
            )}

            <Panel title="Add new user">
                <form
                    className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        createUser();
                    }}
                >
                    <Field label="Name" htmlFor="new-user-name">
                        <Input
                            id="new-user-name"
                            type="text"
                            placeholder="Name"
                            value={newUser.name}
                            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                        />
                    </Field>
                    <Field label="Email" htmlFor="new-user-email">
                        <Input
                            id="new-user-email"
                            type="email"
                            placeholder="Email"
                            value={newUser.email}
                            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        />
                    </Field>
                    <Field label="Password" htmlFor="new-user-password">
                        <Input
                            id="new-user-password"
                            type="password"
                            placeholder="Password"
                            value={newUser.password}
                            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        />
                    </Field>
                    <Field label="Role" htmlFor="new-user-role">
                        <Select
                            id="new-user-role"
                            value={newUser.role}
                            onValueChange={(role) => setNewUser({ ...newUser, role })}
                            options={ROLE_OPTIONS}
                        />
                    </Field>
                    <div className="sm:col-span-2 lg:col-span-4">
                        <Button type="submit">Create User</Button>
                    </div>
                </form>
            </Panel>

            <Table>
                <THead>
                    <tr>
                        <TH>Name</TH>
                        <TH>Email</TH>
                        <TH>Role</TH>
                        <TH className="relative">
                            <span className="sr-only">Actions</span>
                        </TH>
                    </tr>
                </THead>
                <TBody>
                    {users.map((user) =>
                        editingUserId === user.id ? (
                            <TR key={user.id}>
                                <TD className="min-w-40">
                                    <Input
                                        type="text"
                                        aria-label="Name"
                                        value={editingUserData.name}
                                        onChange={(e) => setEditingUserData({ ...editingUserData, name: e.target.value })}
                                    />
                                </TD>
                                <TD className="min-w-52">
                                    <Input
                                        type="email"
                                        aria-label="Email"
                                        value={editingUserData.email}
                                        onChange={(e) => setEditingUserData({ ...editingUserData, email: e.target.value })}
                                    />
                                </TD>
                                <TD className="min-w-40">
                                    <Select
                                        aria-label="Role"
                                        value={editingUserData.role}
                                        onValueChange={(role) => setEditingUserData({ ...editingUserData, role })}
                                        disabled={user.roleManagedBySso}
                                        options={ROLE_OPTIONS}
                                    />
                                    {user.roleManagedBySso && (
                                        <p className="mt-1 text-xs text-muted">Role is managed by SSO.</p>
                                    )}
                                </TD>
                                <TD>
                                    <div className="flex justify-end gap-2">
                                        <Button size="sm" onClick={() => updateUser(user.id)}>Save</Button>
                                        <Button size="sm" variant="secondary" onClick={cancelEditing}>Cancel</Button>
                                    </div>
                                </TD>
                            </TR>
                        ) : (
                            <TR key={user.id}>
                                <TD>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={user.disabledAt ? "text-muted line-through" : ""}>{user.name}</span>
                                        {user.sso && <Badge tone="accent">SSO</Badge>}
                                        {user.disabledAt && <Badge>Deactivated</Badge>}
                                    </div>
                                </TD>
                                <TD mono className="break-all">{user.email}</TD>
                                <TD>
                                    <span className="font-mono text-[13px]">{user.role}</span>
                                    {user.roleManagedBySso && (
                                        <span className="block text-xs text-muted">Managed by SSO</span>
                                    )}
                                </TD>
                                <TD>
                                    <div className="flex justify-end gap-2">
                                        <Button size="sm" variant="secondary" onClick={() => startEditing(user)}>Edit</Button>
                                        {currentId && user.id !== currentId && (
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() =>
                                                    user.disabledAt ? setDisabled(user.id, false) : (setUserToDeactivate(user), setUserToDeactivateOpen(true))
                                                }
                                            >
                                                {user.disabledAt ? "Activate" : "Deactivate"}
                                            </Button>
                                        )}
                                        <Button size="sm" variant="danger" onClick={() => { setUserToDelete(user); setUserToDeleteOpen(true); }}>Delete</Button>
                                    </div>
                                </TD>
                            </TR>
                        )
                    )}
                </TBody>
            </Table>

            <ConfirmDialog
                open={userToDeactivateOpen}
                onOpenChange={setUserToDeactivateOpen}
                title="Deactivate user"
                description={`${userToDeactivate?.name ?? "This user"} will no longer be able to sign in. You can activate the account again later.`}
                confirmLabel="Deactivate"
                tone="danger"
                onConfirm={() => userToDeactivate && setDisabled(userToDeactivate.id, true)}
            />
            <ConfirmDialog
                open={userToDeleteOpen}
                onOpenChange={setUserToDeleteOpen}
                title="Delete user"
                description={`Delete ${userToDelete?.name ?? "this user"} (${userToDelete?.email ?? ""})? This cannot be undone.`}
                confirmLabel="Delete"
                tone="danger"
                onConfirm={() => userToDelete && deleteUser(userToDelete.id)}
            />
        </div>
    );
}
