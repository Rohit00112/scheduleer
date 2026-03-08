"use client";

import { useEffect, useState } from "react";
import { Announcement } from "@/lib/types";
import { getAnnouncements } from "@/lib/api";

export default function AnnouncementsBanner() {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [dismissed, setDismissed] = useState<Set<number>>(new Set());

    useEffect(() => {
        getAnnouncements().then(setAnnouncements).catch(console.error);
    }, []);

    const visible = announcements.filter((a) => !dismissed.has(a.id));
    if (visible.length === 0) return null;

    const typeStyles: Record<string, string> = {
        info: "bg-blue-50 border-blue-200 text-blue-800",
        warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
        urgent: "bg-red-50 border-red-200 text-red-800",
    };

    const typeIcons: Record<string, string> = {
        info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
        warning: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z",
        urgent: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    };

    return (
        <div className="space-y-2 mb-4">
            {visible.map((a) => (
                <div key={a.id} className={`rounded-lg border p-3 flex items-start gap-3 ${typeStyles[a.type] || typeStyles.info}`}>
                    <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={typeIcons[a.type] || typeIcons.info} />
                    </svg>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{a.title}</p>
                        <p className="text-sm opacity-80">{a.message}</p>
                    </div>
                    <button
                        onClick={() => setDismissed((prev) => new Set(prev).add(a.id))}
                        className="shrink-0 opacity-60 hover:opacity-100"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            ))}
        </div>
    );
}
