"use client";

import { Schedule } from "@/lib/types";

interface RoomUtilizationProps {
    schedules: Schedule[];
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16];

function timeToHour(time: string): number {
    const match = time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!match) return 0;
    let h = parseInt(match[1]);
    const period = match[3]?.toUpperCase();
    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return h;
}

export default function RoomUtilization({ schedules }: RoomUtilizationProps) {
    const rooms = Array.from(new Set(schedules.map((s) => s.room).filter(Boolean))).sort();
    const totalSlots = DAYS.length * HOURS.length;

    // Room -> Set of "day-hour" occupied slots
    const roomOccupancy = new Map<string, Set<string>>();
    schedules.forEach((s) => {
        if (!s.room) return;
        const set = roomOccupancy.get(s.room) || new Set<string>();
        const startH = timeToHour(s.startTime);
        const endH = timeToHour(s.endTime);
        for (let h = startH; h < endH; h++) {
            set.add(`${s.day}-${h}`);
        }
        roomOccupancy.set(s.room, set);
    });

    const roomStats = rooms.map((room) => {
        const occupied = roomOccupancy.get(room)?.size || 0;
        return { room, occupied, pct: totalSlots > 0 ? (occupied / totalSlots) * 100 : 0 };
    }).sort((a, b) => b.pct - a.pct);

    const avgUtil = roomStats.length ? roomStats.reduce((s, r) => s + r.pct, 0) / roomStats.length : 0;

    // Heatmap: for each day-hour, count how many rooms are occupied
    const heatmap: Record<string, number> = {};
    let maxHeat = 0;
    DAYS.forEach((day) => {
        HOURS.forEach((hour) => {
            const key = `${day}-${hour}`;
            let count = 0;
            roomOccupancy.forEach((slots) => { if (slots.has(key)) count++; });
            heatmap[key] = count;
            if (count > maxHeat) maxHeat = count;
        });
    });

    const heatColor = (count: number) => {
        if (count === 0) return "bg-gray-50";
        const intensity = maxHeat > 0 ? count / maxHeat : 0;
        if (intensity > 0.75) return "bg-red-400 text-white";
        if (intensity > 0.5) return "bg-orange-300";
        if (intensity > 0.25) return "bg-yellow-200";
        return "bg-green-100";
    };

    return (
        <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="text-2xl font-bold text-gray-900">{rooms.length}</div>
                    <div className="text-xs text-gray-500 mt-1">Rooms</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="text-2xl font-bold text-gray-900">{avgUtil.toFixed(1)}%</div>
                    <div className="text-xs text-gray-500 mt-1">Avg Utilization</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="text-2xl font-bold text-green-700">
                        {roomStats.filter((r) => r.pct < 20).length}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Under-used (&lt;20%)</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="text-2xl font-bold text-red-700">
                        {roomStats.filter((r) => r.pct > 60).length}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Heavily-used (&gt;60%)</div>
                </div>
            </div>

            {/* Heatmap */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Room Usage Heatmap (rooms occupied per time slot)</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr>
                                <th className="px-3 py-2 text-xs font-semibold text-gray-600 text-left">Time</th>
                                {DAYS.map((d) => (
                                    <th key={d} className="px-3 py-2 text-xs font-semibold text-gray-600 text-center">{d.slice(0, 3)}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {HOURS.map((hour) => (
                                <tr key={hour}>
                                    <td className="px-3 py-1 text-xs text-gray-500 font-mono">{hour}:00</td>
                                    {DAYS.map((day) => {
                                        const count = heatmap[`${day}-${hour}`] || 0;
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

            {/* Room bars */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Per-Room Utilization</h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {roomStats.map((r) => (
                        <div key={r.room} className="flex items-center gap-3">
                            <div className="w-32 text-xs text-gray-700 truncate font-medium" title={r.room}>{r.room}</div>
                            <div className="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${r.pct > 60 ? "bg-red-500" : r.pct < 20 ? "bg-yellow-500" : "bg-blue-500"}`}
                                    style={{ width: `${Math.min(r.pct, 100)}%` }}
                                />
                                <span className="absolute inset-0 flex items-center px-2 text-xs font-medium text-gray-800">
                                    {r.pct.toFixed(1)}% &bull; {r.occupied} slots
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
