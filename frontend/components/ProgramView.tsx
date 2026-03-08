"use client";

import { useState, useEffect } from "react";
import { ModuleCatalogItem, TeacherAssignmentItem, ProgramSummary } from "@/lib/types";
import { getProgramSummary } from "@/lib/api";
import Pagination, { usePagination } from "./Pagination";

export default function ProgramView() {
    const [summaries, setSummaries] = useState<ProgramSummary[]>([]);
    const [modules, setModules] = useState<ModuleCatalogItem[]>([]);
    const [assignments, setAssignments] = useState<TeacherAssignmentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<"overview" | "modules" | "assignments">("overview");
    const [selectedModule, setSelectedModule] = useState<string | null>(null);
    const [modPage, setModPage] = useState(1);
    const [modPageSize, setModPageSize] = useState(25);
    const [assignPage, setAssignPage] = useState(1);
    const [assignPageSize, setAssignPageSize] = useState(25);

    useEffect(() => {
        getProgramSummary()
            .then((res) => {
                setSummaries(res.programs || []);
                setModules(res.moduleCatalog || []);
                setAssignments(res.teacherAssignments || []);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="text-center py-12">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent" />
                <p className="mt-3 text-gray-500">Loading program data...</p>
            </div>
        );
    }

    const filteredAssignments = selectedModule
        ? assignments.filter((a) => a.moduleCode === selectedModule)
        : assignments;

    const { paginated: paginatedModules, safePage: modSafePage } = usePagination(modules, modPage, modPageSize);
    const { paginated: paginatedAssignments, safePage: assignSafePage } = usePagination(filteredAssignments, assignPage, assignPageSize);

    return (
        <div className="space-y-6">
            {/* Tabs */}
            <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
                {(["overview", "modules", "assignments"] as const).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${tab === t ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {tab === "overview" && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{summaries.length}</div>
                            <div className="text-xs text-gray-500 mt-1">Programs</div>
                        </div>
                        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{modules.length}</div>
                            <div className="text-xs text-gray-500 mt-1">Modules in Catalog</div>
                        </div>
                        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{assignments.length}</div>
                            <div className="text-xs text-gray-500 mt-1">Teacher Assignments</div>
                        </div>
                        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                {new Set(assignments.map((a) => a.teacher)).size}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">Assigned Teachers</div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Program</th>
                                    <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Years</th>
                                    <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Sections</th>
                                    <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Modules</th>
                                    <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Instructors</th>
                                    <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Classes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {summaries.map((s) => {
                                    const allSections = new Set(s.years.flatMap((y) => y.sections));
                                    const allModules = new Set(s.years.flatMap((y) => y.modules));
                                    const allInstructors = new Set(s.years.flatMap((y) => y.instructors));
                                    return (
                                        <tr key={s.name} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{s.name}</td>
                                            <td className="text-center px-4 py-3">{s.years.map((y) => y.year).join(", ")}</td>
                                            <td className="text-center px-4 py-3">{allSections.size}</td>
                                            <td className="text-center px-4 py-3">{allModules.size}</td>
                                            <td className="text-center px-4 py-3">{allInstructors.size}</td>
                                            <td className="text-center px-4 py-3 font-semibold">{s.totalClasses}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {tab === "modules" && (
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Code</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Title</th>
                                <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Assignments</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedModules.map((m) => {
                                const count = assignments.filter((a) => a.moduleCode === m.code).length;
                                return (
                                    <tr
                                        key={m.id}
                                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                                        onClick={() => { setSelectedModule(m.code); setTab("assignments"); setAssignPage(1); }}
                                    >
                                        <td className="px-4 py-2 font-mono text-xs text-blue-600 dark:text-blue-400">{m.code}</td>
                                        <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{m.title}</td>
                                        <td className="text-center px-4 py-2">{count}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <Pagination
                        currentPage={modSafePage}
                        totalItems={modules.length}
                        pageSize={modPageSize}
                        onPageChange={setModPage}
                        onPageSizeChange={(s) => { setModPageSize(s); setModPage(1); }}
                    />
                </div>
            )}

            {tab === "assignments" && (
                <>
                    {selectedModule && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">Filtered by:</span>
                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">{selectedModule}</span>
                            <button onClick={() => { setSelectedModule(null); setAssignPage(1); }} className="text-xs text-red-600 hover:text-red-800">Clear</button>
                        </div>
                    )}
                    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Module Code</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Class Type</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Teacher</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Block</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedAssignments.map((a) => (
                                    <tr key={a.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                                        <td className="px-4 py-2 font-mono text-xs">{a.moduleCode}</td>
                                        <td className="px-4 py-2">{a.classType || "-"}</td>
                                        <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{a.teacher}</td>
                                        <td className="px-4 py-2">{a.block || "-"}</td>
                                    </tr>
                                ))}
                                {filteredAssignments.length === 0 && (
                                    <tr><td colSpan={4} className="text-center py-8 text-gray-500">No assignments found.</td></tr>
                                )}
                            </tbody>
                        </table>
                        <Pagination
                            currentPage={assignSafePage}
                            totalItems={filteredAssignments.length}
                            pageSize={assignPageSize}
                            onPageChange={setAssignPage}
                            onPageSizeChange={(s) => { setAssignPageSize(s); setAssignPage(1); }}
                        />
                    </div>
                </>
            )}
        </div>
    );
}
