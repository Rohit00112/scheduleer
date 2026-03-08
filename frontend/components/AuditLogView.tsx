"use client";

import { useState, useEffect } from "react";
import { AuditLog } from "@/lib/types";
import { getAuditLog } from "@/lib/api";
import Pagination, { usePagination } from "./Pagination";

export default function AuditLogView() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    useEffect(() => {
        getAuditLog(200)
            .then(setLogs)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="text-center py-12">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent" />
                <p className="mt-3 text-gray-500">Loading audit log...</p>
            </div>
        );
    }

    const actionColors: Record<string, string> = {
        create: "bg-green-100 text-green-800",
        update: "bg-blue-100 text-blue-800",
        delete: "bg-red-100 text-red-800",
    };

    const { paginated, safePage } = usePagination(logs, page, pageSize);

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">{logs.length} Audit Entries</h3>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-gray-50 z-10">
                            <tr className="border-b border-gray-200">
                                <th className="text-left px-4 py-3 font-semibold text-gray-600">Time</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600">Action</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600">User</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600">Description</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginated.map((log) => (
                                <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                                    <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                                        {new Date(log.createdAt).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${actionColors[log.action] || "bg-gray-100 text-gray-800"}`}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-gray-700">{log.username}</td>
                                    <td className="px-4 py-2 text-gray-700">{log.description}</td>
                                    <td className="px-4 py-2">
                                        {log.oldValues && (
                                            <details className="text-xs">
                                                <summary className="cursor-pointer text-gray-500 hover:text-gray-700">View changes</summary>
                                                <div className="mt-1 space-y-1">
                                                    {log.oldValues && (
                                                        <div>
                                                            <span className="font-medium text-red-600">Old:</span>
                                                            <pre className="text-xs bg-red-50 p-1 rounded mt-0.5 overflow-x-auto max-w-xs">{log.oldValues}</pre>
                                                        </div>
                                                    )}
                                                    {log.newValues && (
                                                        <div>
                                                            <span className="font-medium text-green-600">New:</span>
                                                            <pre className="text-xs bg-green-50 p-1 rounded mt-0.5 overflow-x-auto max-w-xs">{log.newValues}</pre>
                                                        </div>
                                                    )}
                                                </div>
                                            </details>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {logs.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="text-center py-8 text-gray-500">No audit entries yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <Pagination
                    currentPage={safePage}
                    totalItems={logs.length}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
                />
            </div>
        </div>
    );
}
