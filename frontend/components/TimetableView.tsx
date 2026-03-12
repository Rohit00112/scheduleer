"use client";

import { Schedule } from "@/lib/types";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const TIME_SLOTS = [
    "08:00 AM", "08:30 AM", "09:00 AM", "09:30 AM",
    "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
    "12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM",
    "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM",
    "04:00 PM",
];
const SLOT_HEIGHT_PX = 56;
const CELL_PADDING_PX = 8;

const CLASS_TYPE_COLORS: Record<string, string> = {
    Lecture: "bg-blue-50 border-blue-300 text-blue-900 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-100",
    Tutorial: "bg-green-50 border-green-300 text-green-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-100",
    Workshop: "bg-purple-50 border-purple-300 text-purple-900 dark:bg-violet-950/30 dark:border-violet-800 dark:text-violet-100",
};

function timeToIndex(time: string): number {
    return TIME_SLOTS.indexOf(time);
}

function getScheduleSpan(schedule: Schedule): number {
    const span = timeToIndex(schedule.endTime) - timeToIndex(schedule.startTime);
    return span > 0 ? span : 1;
}

interface TimetableViewProps {
    schedules: Schedule[];
}

export default function TimetableView({ schedules }: TimetableViewProps) {
    if (schedules.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <p className="text-lg font-medium">No schedules to display</p>
                <p className="text-sm">Try adjusting your filters</p>
            </div>
        );
    }

    const groupedByDay: Record<string, Schedule[]> = {};
    DAYS.forEach((day) => {
        groupedByDay[day] = schedules.filter((s) => s.day === day);
    });

    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800/80">
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase border-b border-r border-gray-200 dark:border-gray-800 w-20">
                                Time
                            </th>
                            {DAYS.map((day) => (
                                <th
                                    key={day}
                                    className="px-3 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase border-b border-r border-gray-200 dark:border-gray-800"
                                >
                                    {day}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {TIME_SLOTS.map((time, idx) => (
                            <tr
                                key={time}
                                className={idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50/50 dark:bg-gray-950/50"}
                                style={{ height: `${SLOT_HEIGHT_PX}px` }}
                            >
                                <td className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-800 whitespace-nowrap font-mono">
                                    {time}
                                </td>
                                {DAYS.map((day) => {
                                    const startingHere = groupedByDay[day]?.filter(
                                        (s) => s.startTime === time
                                    );
                                    const rowSpan = Math.max(
                                        ...(startingHere?.map(getScheduleSpan) ?? [1])
                                    );
                                    const occupying = groupedByDay[day]?.some(
                                        (s) => {
                                            const start = timeToIndex(s.startTime);
                                            const end = timeToIndex(s.endTime);
                                            return idx > start && idx < end;
                                        }
                                    );

                                    if (occupying) return null;

                                    if (startingHere && startingHere.length > 0) {
                                        return (
                                            <td
                                                key={day}
                                                className="px-1 py-1 border-r border-gray-200 dark:border-gray-800 align-top"
                                                rowSpan={rowSpan}
                                            >
                                                <div className="space-y-1">
                                                    {startingHere.map((s) => (
                                                        <div
                                                            key={s.id}
                                                            className={`rounded-lg border p-2 text-xs ${CLASS_TYPE_COLORS[s.classType] || "bg-gray-50 border-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"} ${startingHere.length === 1 ? "flex h-full flex-col" : ""}`}
                                                            style={
                                                                startingHere.length === 1
                                                                    ? {
                                                                        minHeight: `${getScheduleSpan(s) * SLOT_HEIGHT_PX - CELL_PADDING_PX}px`,
                                                                    }
                                                                    : undefined
                                                            }
                                                        >
                                                            <div className="font-bold">{s.moduleCode}</div>
                                                            <div className="text-[10px] opacity-75 truncate">{s.moduleTitle}</div>
                                                            <div className="mt-1 text-[10px]">{s.instructor}</div>
                                                            <div className="text-[10px] opacity-60">{s.room} | {s.group}</div>
                                                            <div className={`text-[10px] opacity-60 ${startingHere.length === 1 ? "mt-auto pt-2" : ""}`}>
                                                                {s.startTime} - {s.endTime}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                        );
                                    }

                                    return (
                                        <td key={day} className="px-1 py-1 border-r border-gray-200 dark:border-gray-800" />
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
