"use client";

import { useState, useMemo } from "react";
import { Schedule } from "@/lib/types";

interface GlobalSearchProps {
    schedules: Schedule[];
    onSelect?: (schedule: Schedule) => void;
}

export default function GlobalSearch({ schedules, onSelect }: GlobalSearchProps) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);

    const results = useMemo(() => {
        if (!query.trim()) return [];
        const q = query.toLowerCase();
        return schedules
            .filter(
                (s) =>
                    s.moduleCode?.toLowerCase().includes(q) ||
                    s.moduleTitle?.toLowerCase().includes(q) ||
                    s.instructor?.toLowerCase().includes(q) ||
                    s.room?.toLowerCase().includes(q) ||
                    s.group?.toLowerCase().includes(q) ||
                    s.program?.toLowerCase().includes(q) ||
                    s.day?.toLowerCase().includes(q)
            )
            .slice(0, 20);
    }, [query, schedules]);

    return (
        <div className="relative">
            <div className="relative">
                <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                    type="text"
                    placeholder="Search schedules..."
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 200)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {query && (
                    <button
                        onClick={() => { setQuery(""); setOpen(false); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            {open && query.trim() && (
                <div className="absolute z-50 top-full mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-lg max-h-80 overflow-y-auto">
                    {results.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500">No results found</div>
                    ) : (
                        <>
                            <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100">
                                {results.length} result{results.length !== 1 ? "s" : ""}
                            </div>
                            {results.map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => {
                                        onSelect?.(s);
                                        setOpen(false);
                                    }}
                                    className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-blue-600">{s.moduleCode}</span>
                                        <span className="text-xs text-gray-700">{s.moduleTitle}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5">
                                        {s.day} {s.startTime}-{s.endTime} &bull; {s.instructor} &bull; {s.room} &bull; {s.group}
                                    </div>
                                </button>
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
