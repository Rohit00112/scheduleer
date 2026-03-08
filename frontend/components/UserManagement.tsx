"use client";

import { useState, useEffect } from "react";
import { getUsers, createUser, updateUserRole, resetUserPassword, deleteUser } from "@/lib/api";
import Pagination, { usePagination } from "./Pagination";

interface UserRecord {
    id: number;
    username: string;
    role: string;
}

export default function UserManagement() {
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newUsername, setNewUsername] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [newRole, setNewRole] = useState("user");
    const [resetId, setResetId] = useState<number | null>(null);
    const [resetPwd, setResetPwd] = useState("");
    const [error, setError] = useState("");
    const [page, setPage] = useState(1);
    const pageSize = 15;

    const load = () => {
        setLoading(true);
        getUsers()
            .then(setUsers)
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const handleCreate = async () => {
        if (!newUsername || !newPassword) return;
        setError("");
        try {
            await createUser(newUsername, newPassword, newRole);
            setNewUsername("");
            setNewPassword("");
            setNewRole("user");
            setShowCreate(false);
            load();
        } catch (e: any) {
            setError(e.message || "Failed to create user");
        }
    };

    const handleRoleChange = async (id: number, role: string) => {
        try {
            await updateUserRole(id, role);
            load();
        } catch (e) {
            console.error(e);
        }
    };

    const handleResetPassword = async () => {
        if (!resetId || !resetPwd) return;
        try {
            await resetUserPassword(resetId, resetPwd);
            setResetId(null);
            setResetPwd("");
        } catch (e) {
            console.error(e);
        }
    };

    const handleDelete = async (id: number, username: string) => {
        if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
        try {
            await deleteUser(id);
            load();
        } catch (e) {
            console.error(e);
        }
    };

    if (loading) {
        return (
            <div className="text-center py-12">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent" />
            </div>
        );
    }

    const { paginated, safePage } = (() => {
        const totalPages = Math.max(1, Math.ceil(users.length / pageSize));
        const sp = Math.min(page, totalPages);
        const start = (sp - 1) * pageSize;
        return { paginated: users.slice(start, start + pageSize), safePage: sp };
    })();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">{users.length} Users</h3>
                <button
                    onClick={() => setShowCreate(!showCreate)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                    + Create User
                </button>
            </div>

            {showCreate && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">New User</h4>
                    {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <input
                            type="text"
                            placeholder="Username"
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                        <select
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                        </select>
                        <button
                            onClick={handleCreate}
                            className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700"
                        >
                            Create
                        </button>
                    </div>
                </div>
            )}

            {/* Reset password modal inline */}
            {resetId !== null && (
                <div className="bg-white rounded-xl border border-yellow-200 p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">
                        Reset Password for: {users.find((u) => u.id === resetId)?.username}
                    </h4>
                    <div className="flex gap-3">
                        <input
                            type="password"
                            placeholder="New password"
                            value={resetPwd}
                            onChange={(e) => setResetPwd(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1"
                        />
                        <button onClick={handleResetPassword} className="bg-yellow-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-yellow-700">
                            Reset
                        </button>
                        <button onClick={() => { setResetId(null); setResetPwd(""); }} className="text-gray-500 hover:text-gray-700 text-sm">
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-4 py-3 font-semibold text-gray-600">ID</th>
                            <th className="text-left px-4 py-3 font-semibold text-gray-600">Username</th>
                            <th className="text-left px-4 py-3 font-semibold text-gray-600">Role</th>
                            <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginated.map((u) => (
                            <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="px-4 py-2 text-gray-500">{u.id}</td>
                                <td className="px-4 py-2 font-medium text-gray-900">{u.username}</td>
                                <td className="px-4 py-2">
                                    <select
                                        value={u.role}
                                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                        className="border border-gray-200 rounded px-2 py-1 text-xs"
                                    >
                                        <option value="user">user</option>
                                        <option value="admin">admin</option>
                                    </select>
                                </td>
                                <td className="px-4 py-2 text-right space-x-2">
                                    <button
                                        onClick={() => setResetId(u.id)}
                                        className="text-yellow-600 hover:text-yellow-800 text-xs font-medium"
                                    >
                                        Reset Password
                                    </button>
                                    <button
                                        onClick={() => handleDelete(u.id, u.username)}
                                        className="text-red-600 hover:text-red-800 text-xs font-medium"
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <Pagination
                    currentPage={safePage}
                    totalItems={users.length}
                    pageSize={pageSize}
                    onPageChange={setPage}
                />
            </div>
        </div>
    );
}
