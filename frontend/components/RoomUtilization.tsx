"use client";

import { useState, useEffect } from "react";
import { RoomUtilizationData } from "@/lib/types";
import { getRoomUtilization } from "@/lib/api";
import Pagination, { usePagination } from "./Pagination";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16];

export default function RoomUtilization() {
    const [roomData, setRoomData] = useState<RoomUtilizationData[]>([]);
    const [globalHeatmap, setGlobalHeatmap] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
    const [barPage, setBarPage] = useState(1);
    const [tablePage, setTablePage] = useState(1);
    const barPageSize = 15;
    const tablePageSize = 15;

    useEffect(() => {
        getRoomUtilization()
            .then((res) => {
                setRoomData(res.rooms || []);
                setGlobalHeatmap(res.heatmap || {});
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="text-center py-12">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent" />
                <p className="mt-3 text-gray-500">Loading room data...</p>
            </div>
        );
    }

    const sorted = [...roomData].sort((a, b) => b.utilizationPct - a.utilizationPct);
    const avgUtil = sorted.length ? sorted.reduce((s, r) => s + r.utilizationPct, 0) / sorted.length : 0;
    const totalCapacity = sorted.reduce((s, r) => s + (r.capacity || 0), 0);
    const roomsWithCapacity = sorted.filter((r) => r.capacity);

    const { paginated: paginatedBars, safePage: barSafePage } = usePagination(sorted, barPage, barPageSize);
    const { paginated: paginatedCapacity, safePage: tableSafePage } = usePagination(roomsWithCapacity, tablePage, tablePageSize);

    // Use global heatmap from API
    let maxHeat = 0;
    for (const val of Object.values(globalHeatmap)) {
        if (val > maxHeat) maxHeat = val;
    }

    const heatColor = (count: number) => {
        if (count === 0) return "bg-gray-50 dark:bg-gray-800";
        const intensity = maxHeat > 0 ? count / maxHeat : 0;
        if (intensity > 0.75) return "bg-red-400 text-white";
        if (intensity > 0.5) return "bg-orange-300";
        if (intensity > 0.25) return "bg-yellow-200";
        return "bg-green-100";
    };

    const selected = selectedRoom ? roomData.find((r) => r.name === selectedRoom) : null;

    return (
        <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{sorted.length}</div>
                    <div className="text-xs text-gray-500 mt-1">Rooms</div>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{avgUtil.toFixed(1)}%</div>
                    <div className="text-xs text-gray-500 mt-1">Avg Utilization</div>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <div className="text-2xl font-bold text-green-700">{totalCapacity}</div>
                    <div className="text-xs text-gray-500 mt-1">Total Capacity</div>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <div className="text-2xl font-bold text-yellow-600">
                        {sorted.filter((r) => r.utilizationPct < 20).length}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Under-used (&lt;20%)</div>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <div className="text-2xl font-bold text-red-700">
                        {sorted.filter((r) => r.utilizationPct > 60).length}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Heavily-used (&gt;60%)</div>
                </div>
            </div>

            {/* Heatmap */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Room Usage Heatmap (rooms occupied per time slot)</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr>
                                <th className="px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 text-left">Time</th>
                                {DAYS.map((d) => (
                                    <th key={d} className="px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 text-center">{d.slice(0, 3)}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {HOURS.map((hour) => (
                                <tr key={hour}>
                                    <td className="px-3 py-1 text-xs text-gray-500 font-mono">{hour}:00</td>
                                    {DAYS.map((day) => {
                                        const count = globalHeatmap[`${day}-${hour}`] || 0;
                                        return (
                                            <td key={day} className="px-1 py-1 text-center">
                                                <div className={`rounded px-2 py-1 text-xs font-medium ${heatColor(count)}`}>
                                                    {count > 0 ? count : ""}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                    <span>Low</span>
                    <div className="flex gap-0.5">
                        <div className="w-4 h-4 rounded bg-green-100" />
                        <div className="w-4 h-4 rounded bg-yellow-200" />
                        <div className="w-4 h-4 rounded bg-orange-300" />
                        <div className="w-4 h-4 rounded bg-red-400" />
                    </div>
                    <span>High</span>
                </div>
            </div>

            {/* Room bars with capacity */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Per-Room Utilization</h3>
                <div className="space-y-2">
                    {paginatedBars.map((r) => (
                        <button
                            key={r.name}
                            onClick={() => setSelectedRoom(selectedRoom === r.name ? null : r.name)}
                            className={`w-full flex items-center gap-3 p-1 rounded-lg transition-colors ${selectedRoom === r.name ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                        >
                            <div className="w-40 text-xs text-gray-700 dark:text-gray-300 truncate font-medium text-left" title={r.name}>{r.name}</div>
                            {r.capacity && <div className="w-12 text-xs text-gray-400 text-right">{r.capacity} seats</div>}
                            <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-5 relative overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${r.utilizationPct > 60 ? "bg-red-500" : r.utilizationPct < 20 ? "bg-yellow-500" : "bg-blue-500"}`}
                                    style={{ width: `${Math.min(r.utilizationPct, 100)}%` }}
                                />
                                <span className="absolute inset-0 flex items-center px-2 text-xs font-medium text-gray-800 dark:text-gray-200">
                                    {r.utilizationPct.toFixed(1)}% &bull; {r.occupiedSlots} slots
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
                <Pagination
                    currentPage={barSafePage}
                    totalItems={sorted.length}
                    pageSize={barPageSize}
                    onPageChange={setBarPage}
                />
            </div>

            {/* Selected room detail */}
            {selected && (
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{selected.name} Details</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{selected.capacity || "N/A"}</div>
                            <div className="text-xs text-gray-500">Capacity</div>
                        </div>
                        <div>
                            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{selected.block || "N/A"}</div>
                            <div className="text-xs text-gray-500">Block</div>
                        </div>
                        <div>
                            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{selected.level || "N/A"}</div>
                            <div className="text-xs text-gray-500">Level</div>
                        </div>
                        <div>
                            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{selected.occupiedSlots}</div>
                            <div className="text-xs text-gray-500">Occupied Slots</div>
                        </div>
                    </div>
                    {selected.classCounts && (
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(selected.classCounts).filter(([, count]) => count > 0).map(([type, count]) => (
                                <span key={type} className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                    {type}: {count}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Room capacity table */}
            {roomsWithCapacity.length > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Room</th>
                                <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Capacity</th>
                                <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Block</th>
                                <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Level</th>
                                <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Classes</th>
                                <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Utilization</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedCapacity.map((r) => (
                                <tr key={r.name} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{r.name}</td>
                                    <td className="text-center px-4 py-2">{r.capacity}</td>
                                    <td className="text-center px-4 py-2">{r.block || "-"}</td>
                                    <td className="text-center px-4 py-2">{r.level || "-"}</td>
                                    <td className="text-center px-4 py-2">{r.occupiedSlots}</td>
                                    <td className="text-center px-4 py-2">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.utilizationPct > 60 ? "bg-red-100 text-red-700" : r.utilizationPct < 20 ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"}`}>
                                            {r.utilizationPct.toFixed(1)}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <Pagination
                        currentPage={tableSafePage}
                        totalItems={roomsWithCapacity.length}
                        pageSize={tablePageSize}
                        onPageChange={setTablePage}
                    />
                </div>
            )}
        </div>
    );
}
