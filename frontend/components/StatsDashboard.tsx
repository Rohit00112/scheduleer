"use client";

import { useState, useEffect } from "react";
import { DashboardStats } from "@/lib/types";
import { getDashboardStats } from "@/lib/api";

export default function StatsDashboard() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getDashboardStats()
            .then(setStats)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="text-center py-12">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent" />
                <p className="mt-3 text-gray-500">Loading dashboard...</p>
            </div>
        );
    }

    if (!stats) {
        return <div className="text-center py-12 text-gray-500">Failed to load dashboard data.</div>;
    }

    const { overview, byDay, byProgram, busyInstructors, busyRooms, timeDistribution } = stats;

    const maxDayCount = Math.max(...byDay.map((d) => d.count), 1);
    const maxTimeCount = Math.max(...timeDistribution.map((t) => t.count), 1);

    return (
        <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{overview.totalClasses}</div>
                    <div className="text-xs text-gray-500 mt-1">Total Classes</div>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{overview.totalInstructors}</div>
                    <div className="text-xs text-gray-500 mt-1">Instructors</div>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{overview.totalRooms}</div>
                    <div className="text-xs text-gray-500 mt-1">Rooms</div>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{overview.totalModules}</div>
                    <div className="text-xs text-gray-500 mt-1">Modules</div>
                </div>
            </div>

            {/* Class Type Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Class Types</h3>
                    <div className="space-y-3">
                        {[...overview.classTypes].sort((a, b) => b.count - a.count).map((ct) => {
                            const pct = overview.totalClasses > 0 ? (ct.count / overview.totalClasses) * 100 : 0;
                            const color = ct.type === "Lecture" ? "bg-blue-500" : ct.type === "Tutorial" ? "bg-green-500" : ct.type === "Workshop" ? "bg-purple-500" : "bg-gray-500";
                            return (
                                <div key={ct.type}>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">{ct.type}</span>
                                        <span className="text-gray-500">{ct.count} ({pct.toFixed(0)}%)</span>
                                    </div>
                                    <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Programs Breakdown */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Programs</h3>
                    <div className="space-y-3">
                        {[...byProgram].sort((a, b) => b.count - a.count).map((p) => {
                            const pct = overview.totalClasses > 0 ? (p.count / overview.totalClasses) * 100 : 0;
                            return (
                                <div key={p.program}>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">{p.program}</span>
                                        <span className="text-gray-500">{p.count} ({pct.toFixed(0)}%)</span>
                                    </div>
                                    <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Distribution by Day */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Classes by Day</h3>
                <div className="flex items-end gap-2 h-40">
                    {byDay.filter((d) => d.count > 0).map((d) => {
                        const pct = (d.count / maxDayCount) * 100;
                        return (
                            <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{d.count}</span>
                                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-t-lg relative" style={{ height: "120px" }}>
                                    <div
                                        className="absolute bottom-0 w-full bg-blue-500 rounded-t-lg transition-all"
                                        style={{ height: `${pct}%` }}
                                    />
                                </div>
                                <span className="text-xs text-gray-500">{d.day.slice(0, 3)}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Program Year Breakdown */}
            {byProgram.length > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Classes by Program & Year</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                    <th className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-gray-400">Program</th>
                                    <th className="text-center px-4 py-2 font-semibold text-gray-600 dark:text-gray-400">Year 1</th>
                                    <th className="text-center px-4 py-2 font-semibold text-gray-600 dark:text-gray-400">Year 2</th>
                                    <th className="text-center px-4 py-2 font-semibold text-gray-600 dark:text-gray-400">Year 3</th>
                                    <th className="text-center px-4 py-2 font-semibold text-gray-600 dark:text-gray-400">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {byProgram.map((p) => (
                                    <tr key={p.program} className="border-b border-gray-100 dark:border-gray-800">
                                        <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{p.program}</td>
                                        <td className="text-center px-4 py-2">{p.year1}</td>
                                        <td className="text-center px-4 py-2">{p.year2}</td>
                                        <td className="text-center px-4 py-2">{p.year3}</td>
                                        <td className="text-center px-4 py-2 font-semibold">{p.count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Time Distribution */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Class Start Time Distribution</h3>
                <div className="flex items-end gap-1 h-32">
                    {timeDistribution.map((t) => {
                        const pct = (t.count / maxTimeCount) * 100;
                        return (
                            <div key={t.slot} className="flex-1 flex flex-col items-center gap-1">
                                <span className="text-xs text-gray-500">{t.count > 0 ? t.count : ""}</span>
                                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-t relative" style={{ height: "100px" }}>
                                    <div
                                        className="absolute bottom-0 w-full bg-teal-500 rounded-t transition-all"
                                        style={{ height: `${pct}%` }}
                                    />
                                </div>
                                <span className="text-xs text-gray-500 whitespace-nowrap">{t.slot}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Busy Instructors & Rooms */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Top 10 Busiest Instructors</h3>
                    <div className="space-y-2">
                        {busyInstructors.map((item, idx) => {
                            const maxHours = busyInstructors[0]?.hours || 1;
                            const pct = (item.hours / maxHours) * 100;
                            return (
                                <div key={item.instructor} className="flex items-center gap-3">
                                    <span className="w-5 text-xs text-gray-400 text-right">{idx + 1}.</span>
                                    <div className="w-36 text-xs text-gray-700 dark:text-gray-300 truncate font-medium">{item.instructor}</div>
                                    <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-4 relative overflow-hidden">
                                        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="text-xs text-gray-500 w-16 text-right">{item.hours.toFixed(1)}h</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Top 10 Busiest Rooms</h3>
                    <div className="space-y-2">
                        {busyRooms.map((item, idx) => {
                            const maxClasses = busyRooms[0]?.classes || 1;
                            const pct = (item.classes / maxClasses) * 100;
                            return (
                                <div key={item.room} className="flex items-center gap-3">
                                    <span className="w-5 text-xs text-gray-400 text-right">{idx + 1}.</span>
                                    <div className="w-36 text-xs text-gray-700 dark:text-gray-300 truncate font-medium">{item.room}</div>
                                    <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-4 relative overflow-hidden">
                                        <div className="h-full bg-rose-500 rounded-full" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="text-xs text-gray-500 w-8 text-right">{item.classes}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
