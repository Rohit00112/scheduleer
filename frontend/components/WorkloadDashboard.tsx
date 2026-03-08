"use client";

import { Schedule } from "@/lib/types";

interface WorkloadDashboardProps {
    schedules: Schedule[];
}

function parseHours(start: string, end: string): number {
    const toMin = (t: string) => {
        const match = t.match(/(\d+):(\d+)\s*(AM|PM)?/i);
        if (!match) return 0;
        let h = parseInt(match[1]);
        const m = parseInt(match[2]);
        const period = match[3]?.toUpperCase();
        if (period === "PM" && h !== 12) h += 12;
        if (period === "AM" && h === 12) h = 0;
        return h * 60 + m;
    };
    return Math.max(0, (toMin(end) - toMin(start)) / 60);
}

export default function WorkloadDashboard({ schedules }: WorkloadDashboardProps) {
    const instructorMap = new Map<string, { classes: number; hours: number; types: Record<string, number>; modules: Set<string> }>();

    schedules.forEach((s) => {
        if (!s.instructor) return;
        const existing = instructorMap.get(s.instructor) || { classes: 0, hours: 0, types: {}, modules: new Set<string>() };
        existing.classes++;
        existing.hours += parseHours(s.startTime, s.endTime);
        existing.types[s.classType] = (existing.types[s.classType] || 0) + 1;
        existing.modules.add(s.moduleCode);
        instructorMap.set(s.instructor, existing);
    });

    const data = Array.from(instructorMap.entries())
        .map(([name, info]) => ({ name, ...info, moduleCount: info.modules.size }))
        .sort((a, b) => b.hours - a.hours);

    const avgHours = data.length ? data.reduce((sum, d) => sum + d.hours, 0) / data.length : 0;
    const maxHours = data.length ? Math.max(...data.map((d) => d.hours)) : 1;

    return (
        <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="text-2xl font-bold text-gray-900">{data.length}</div>
                    <div className="text-xs text-gray-500 mt-1">Instructors</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="text-2xl font-bold text-gray-900">{avgHours.toFixed(1)}h</div>
                    <div className="text-xs text-gray-500 mt-1">Avg Hours/Week</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="text-2xl font-bold text-green-700">
                        {data.filter((d) => d.hours <= avgHours * 0.7).length}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Under-loaded</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="text-2xl font-bold text-red-700">
                        {data.filter((d) => d.hours >= avgHours * 1.3).length}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Over-loaded</div>
                </div>
            </div>

            {/* Workload chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Teaching Hours Distribution</h3>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {data.map((d) => {
                        const pct = maxHours > 0 ? (d.hours / maxHours) * 100 : 0;
                        const status = d.hours >= avgHours * 1.3 ? "overloaded" : d.hours <= avgHours * 0.7 ? "underloaded" : "normal";
                        const barColor = status === "overloaded" ? "bg-red-500" : status === "underloaded" ? "bg-yellow-500" : "bg-blue-500";
                        return (
                            <div key={d.name} className="flex items-center gap-3">
                                <div className="w-40 text-xs text-gray-700 truncate font-medium" title={d.name}>{d.name}</div>
                                <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                                    <div className={`${barColor} h-full rounded-full transition-all`} style={{ width: `${pct}%` }} />
                                    <span className="absolute inset-0 flex items-center px-2 text-xs font-medium text-gray-800">
                                        {d.hours.toFixed(1)}h &bull; {d.classes} classes &bull; {d.moduleCount} modules
                                    </span>
                                </div>
                                {status === "overloaded" && <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 whitespace-nowrap">Over</span>}
                                {status === "underloaded" && <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 whitespace-nowrap">Under</span>}
                            </div>
                        );
                    })}
                </div>
                <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-blue-500" /> Normal</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-500" /> Over-loaded (&gt;130% avg)</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-yellow-500" /> Under-loaded (&lt;70% avg)</div>
                    <div className="ml-auto">Average: {avgHours.toFixed(1)}h/week</div>
                </div>
            </div>

            {/* Detailed table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-4 py-3 font-semibold text-gray-600">Instructor</th>
                            <th className="text-center px-4 py-3 font-semibold text-gray-600">Classes</th>
                            <th className="text-center px-4 py-3 font-semibold text-gray-600">Hours</th>
                            <th className="text-center px-4 py-3 font-semibold text-gray-600">Modules</th>
                            <th className="text-center px-4 py-3 font-semibold text-gray-600">Lectures</th>
                            <th className="text-center px-4 py-3 font-semibold text-gray-600">Tutorials</th>
                            <th className="text-center px-4 py-3 font-semibold text-gray-600">Workshops</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((d) => (
                            <tr key={d.name} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="px-4 py-2 font-medium text-gray-900">{d.name}</td>
                                <td className="text-center px-4 py-2">{d.classes}</td>
                                <td className="text-center px-4 py-2">{d.hours.toFixed(1)}</td>
                                <td className="text-center px-4 py-2">{d.moduleCount}</td>
                                <td className="text-center px-4 py-2">{d.types["Lecture"] || 0}</td>
                                <td className="text-center px-4 py-2">{d.types["Tutorial"] || 0}</td>
                                <td className="text-center px-4 py-2">{d.types["Workshop"] || 0}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
