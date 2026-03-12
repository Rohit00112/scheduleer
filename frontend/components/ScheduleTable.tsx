"use client";

import { useState } from "react";
import { Schedule } from "@/lib/types";
import Pagination, { usePagination } from "./Pagination";

const CLASS_TYPE_COLORS: Record<string, string> = {
    Lecture: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-100",
    Tutorial: "bg-green-100 text-green-800 dark:bg-emerald-950/40 dark:text-emerald-100",
    Workshop: "bg-purple-100 text-purple-800 dark:bg-violet-950/40 dark:text-violet-100",
};

interface ScheduleTableProps {
    schedules: Schedule[];
    onEdit: (schedule: Schedule) => void;
    onDelete: (id: number) => void;
    isAdmin?: boolean;
}

export default function ScheduleTable({ schedules, onEdit, onDelete, isAdmin }: ScheduleTableProps) {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const { paginated, totalPages, safePage } = usePagination(schedules, page, pageSize);

    // Reset to page 1 when schedules change (e.g. filter)
    const [prevLen, setPrevLen] = useState(schedules.length);
    if (schedules.length !== prevLen) {
        setPrevLen(schedules.length);
        if (page !== 1) setPage(1);
    }

    if (schedules.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-lg font-medium">No schedules found</p>
                <p className="text-sm">Try adjusting your filters</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                    <thead className="bg-gray-50 dark:bg-gray-800/80">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Day</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Time</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Type</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Module</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Instructor</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Group</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Room</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Program</th>
                            {isAdmin && (
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                        {paginated.map((s) => (
                            <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/70 transition-colors">
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{s.day}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                                    {s.startTime} - {s.endTime}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CLASS_TYPE_COLORS[s.classType] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100"}`}>
                                        {s.classType}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                    <div className="font-medium">{s.moduleCode}</div>
                                    <div className="text-gray-500 dark:text-gray-400 text-xs">{s.moduleTitle}</div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{s.instructor}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{s.group}</td>
                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                                    <div>{s.room}</div>
                                    <div className="text-gray-400 dark:text-gray-500 text-xs">{s.block} - Level {s.level}</div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                                    <div>{s.program} Y{s.year}</div>
                                    <div className="text-gray-400 dark:text-gray-500 text-xs">{s.section}</div>
                                </td>
                                {isAdmin && (
                                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                                        <button
                                            onClick={() => onEdit(s)}
                                            className="text-blue-600 hover:text-blue-800 mr-3 font-medium"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => onDelete(s.id)}
                                            className="text-red-600 hover:text-red-800 font-medium"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Pagination
                currentPage={safePage}
                totalItems={schedules.length}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
        </div>
    );
}
