"use client";

import { Schedule } from "@/lib/types";
import { useMemo, useState } from "react";

interface InstructorViewProps {
    schedules: Schedule[];
    onEdit: (schedule: Schedule) => void;
}

interface InstructorData {
    name: string;
    classes: Schedule[];
    modules: Set<string>;
    totalHours: number;
}

export default function InstructorView({ schedules, onEdit }: InstructorViewProps) {
    const [expandedInstructor, setExpandedInstructor] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    const instructorData = useMemo(() => {
        const map = new Map<string, InstructorData>();

        for (const s of schedules) {
            const name = s.instructor || "Unassigned";
            if (!map.has(name)) {
                map.set(name, { name, classes: [], modules: new Set(), totalHours: 0 });
            }
            const data = map.get(name)!;
            data.classes.push(s);
            data.modules.add(s.moduleCode);

            // Calculate hours from time strings
            const parseTime = (t: string) => {
                const [h, m] = t.split(":").map(Number);
                return h + (m || 0) / 60;
            };
            if (s.startTime && s.endTime) {
                data.totalHours += parseTime(s.endTime) - parseTime(s.startTime);
            }
        }

        return Array.from(map.values()).sort((a, b) => b.classes.length - a.classes.length);
    }, [schedules]);

    const filtered = useMemo(() => {
        if (!search) return instructorData;
        const q = search.toLowerCase();
        return instructorData.filter(
            (i) =>
                i.name.toLowerCase().includes(q) ||
                Array.from(i.modules).some((m) => m.toLowerCase().includes(q))
        );
    }, [instructorData, search]);

    const classTypeColor: Record<string, string> = {
        Lecture: "bg-blue-100 text-blue-800",
        Tutorial: "bg-green-100 text-green-800",
        Workshop: "bg-purple-100 text-purple-800",
    };

    return (
        <div>
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Search instructors or modules..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
            </div>

            <div className="space-y-3">
                {filtered.map((instructor) => (
                    <div
                        key={instructor.name}
                        className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
                    >
                        {/* Instructor header */}
                        <button
                            onClick={() =>
                                setExpandedInstructor(
                                    expandedInstructor === instructor.name ? null : instructor.name
                                )
                            }
                            className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-sm">
                                    {instructor.name
                                        .split(" ")
                                        .map((n) => n[0])
                                        .join("")
                                        .substring(0, 2)
                                        .toUpperCase()}
                                </div>
                                <div className="text-left">
                                    <div className="font-semibold text-gray-900">
                                        {instructor.name}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {instructor.modules.size} module
                                        {instructor.modules.size !== 1 ? "s" : ""} &middot;{" "}
                                        {instructor.classes.length} class
                                        {instructor.classes.length !== 1 ? "es" : ""} &middot;{" "}
                                        {instructor.totalHours.toFixed(1)} hrs/week
                                    </div>
                                </div>
                            </div>
                            <svg
                                className={`w-5 h-5 text-gray-400 transition-transform ${expandedInstructor === instructor.name ? "rotate-180" : ""
                                    }`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 9l-7 7-7-7"
                                />
                            </svg>
                        </button>

                        {/* Expanded class list */}
                        {expandedInstructor === instructor.name && (
                            <div className="border-t border-gray-200">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                                                Day
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                                                Time
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                                                Type
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                                                Module
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                                                Program
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                                                Section
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                                                Room
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {instructor.classes
                                            .sort((a, b) => {
                                                const days = [
                                                    "Sunday",
                                                    "Monday",
                                                    "Tuesday",
                                                    "Wednesday",
                                                    "Thursday",
                                                    "Friday",
                                                    "Saturday",
                                                ];
                                                const dayDiff =
                                                    days.indexOf(a.day) - days.indexOf(b.day);
                                                if (dayDiff !== 0) return dayDiff;
                                                return (a.startTime || "").localeCompare(
                                                    b.startTime || ""
                                                );
                                            })
                                            .map((cls) => (
                                                <tr key={cls.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-2 text-gray-900">
                                                        {cls.day}
                                                    </td>
                                                    <td className="px-4 py-2 text-gray-600">
                                                        {cls.startTime} - {cls.endTime}
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <span
                                                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${classTypeColor[cls.classType] ||
                                                                "bg-gray-100 text-gray-800"
                                                                }`}
                                                        >
                                                            {cls.classType}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <div className="text-gray-900">
                                                            {cls.moduleCode}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {cls.moduleTitle}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2 text-gray-600">
                                                        {cls.program}
                                                    </td>
                                                    <td className="px-4 py-2 text-gray-600">
                                                        {cls.section}
                                                    </td>
                                                    <td className="px-4 py-2 text-gray-600">
                                                        {cls.room}
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <button
                                                            onClick={() => onEdit(cls)}
                                                            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                                                        >
                                                            Edit
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ))}

                {filtered.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        No instructors found.
                    </div>
                )}
            </div>
        </div>
    );
}
