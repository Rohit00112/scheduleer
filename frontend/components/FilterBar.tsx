"use client";

import { ScheduleFilter } from "@/lib/types";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const CLASS_TYPES = ["Lecture", "Tutorial", "Workshop"];

interface FilterBarProps {
    filter: ScheduleFilter;
    onChange: (filter: ScheduleFilter) => void;
    programs: string[];
    sections: string[];
    instructors: string[];
    rooms: string[];
    modules: { code: string; title: string }[];
}

export default function FilterBar({
    filter,
    onChange,
    programs,
    sections,
    instructors,
    rooms,
    modules,
}: FilterBarProps) {
    const update = (key: keyof ScheduleFilter, value: string | number) => {
        onChange({ ...filter, [key]: value || undefined });
    };

    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-4 mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                <select
                    value={filter.program || ""}
                    onChange={(e) => update("program", e.target.value)}
                    className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">All Programs</option>
                    {programs.map((p) => (
                        <option key={p} value={p}>{p}</option>
                    ))}
                </select>

                <select
                    value={filter.year || ""}
                    onChange={(e) => update("year", e.target.value ? Number(e.target.value) : "")}
                    className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">All Years</option>
                    <option value="1">Year 1</option>
                    <option value="2">Year 2</option>
                    <option value="3">Year 3</option>
                </select>

                <select
                    value={filter.section || ""}
                    onChange={(e) => update("section", e.target.value)}
                    className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">All Sections</option>
                    {sections.map((s) => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>

                <select
                    value={filter.day || ""}
                    onChange={(e) => update("day", e.target.value)}
                    className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">All Days</option>
                    {DAYS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                    ))}
                </select>

                <select
                    value={filter.classType || ""}
                    onChange={(e) => update("classType", e.target.value)}
                    className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">All Types</option>
                    {CLASS_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                    ))}
                </select>

                <select
                    value={filter.instructor || ""}
                    onChange={(e) => update("instructor", e.target.value)}
                    className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">All Instructors</option>
                    {instructors.map((i) => (
                        <option key={i} value={i}>{i}</option>
                    ))}
                </select>

                <select
                    value={filter.room || ""}
                    onChange={(e) => update("room", e.target.value)}
                    className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">All Rooms</option>
                    {rooms.map((r) => (
                        <option key={r} value={r}>{r}</option>
                    ))}
                </select>

                <select
                    value={filter.moduleCode || ""}
                    onChange={(e) => update("moduleCode", e.target.value)}
                    className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">All Modules</option>
                    {modules.map((m) => (
                        <option key={m.code} value={m.code}>{m.code} - {m.title}</option>
                    ))}
                </select>
            </div>

            <div className="mt-3 flex justify-end">
                <button
                    onClick={() => onChange({})}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
                >
                    Clear Filters
                </button>
            </div>
        </div>
    );
}
