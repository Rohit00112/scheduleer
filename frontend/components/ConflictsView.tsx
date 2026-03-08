"use client";

import { useState, useEffect } from "react";
import { Conflict } from "@/lib/types";
import { getConflicts } from "@/lib/api";

export default function ConflictsView() {
    const [conflicts, setConflicts] = useState<Conflict[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getConflicts()
            .then(setConflicts)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="text-center py-12">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent" />
                <p className="mt-3 text-gray-500">Scanning for conflicts...</p>
            </div>
        );
    }

    if (conflicts.length === 0) {
        return (
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
                <svg className="w-12 h-12 mx-auto text-green-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-green-800">No Conflicts Found</h3>
                <p className="text-sm text-green-600 mt-1">All schedules are conflict-free.</p>
            </div>
        );
    }

    const typeColors: Record<string, string> = {
        instructor: "bg-red-50 border-red-200 text-red-800",
        room: "bg-orange-50 border-orange-200 text-orange-800",
        group: "bg-yellow-50 border-yellow-200 text-yellow-800",
    };

    const typeLabels: Record<string, string> = {
        instructor: "Instructor Conflict",
        room: "Room Conflict",
        group: "Group Conflict",
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900">
                    {conflicts.length} Conflict{conflicts.length !== 1 ? "s" : ""} Detected
                </h3>
                <div className="flex gap-2 text-xs">
                    <span className="px-2 py-1 rounded bg-red-100 text-red-700">
                        {conflicts.filter((c) => c.type === "instructor").length} Instructor
                    </span>
                    <span className="px-2 py-1 rounded bg-orange-100 text-orange-700">
                        {conflicts.filter((c) => c.type === "room").length} Room
                    </span>
                    <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-700">
                        {conflicts.filter((c) => c.type === "group").length} Group
                    </span>
                </div>
            </div>

            {conflicts.map((conflict, idx) => (
                <div
                    key={idx}
                    className={`rounded-xl border p-4 ${typeColors[conflict.type] || "bg-gray-50 border-gray-200"}`}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <span className="font-semibold text-sm">{typeLabels[conflict.type]}</span>
                        <span className="text-xs opacity-75">
                            {conflict.day} &bull; {conflict.startTime} - {conflict.endTime}
                        </span>
                    </div>
                    <p className="text-sm mb-2">
                        <strong>{conflict.resource}</strong> is double-booked
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {conflict.schedules.map((s) => (
                            <div key={s.id} className="bg-white/60 rounded-lg p-2 text-xs">
                                <div className="font-semibold">{s.moduleCode} - {s.moduleTitle}</div>
                                <div>{s.instructor} &bull; {s.room} &bull; {s.group}</div>
                                <div className="opacity-75">{s.startTime} - {s.endTime}</div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
