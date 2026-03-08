"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Schedule, ScheduleFilter } from "@/lib/types";
import {
  getSchedules,
  getInstructors,
  getRooms,
  getPrograms,
  getSections,
  getModules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  exportExcel,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import FilterBar from "@/components/FilterBar";
import ScheduleTable from "@/components/ScheduleTable";
import TimetableView from "@/components/TimetableView";
import ScheduleModal from "@/components/ScheduleModal";
import InstructorView from "@/components/InstructorView";

type AdminTab = "schedules" | "timetable" | "instructors";

export default function Home() {
  const { user, loading: authLoading, isAdmin, logout } = useAuth();
  const router = useRouter();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [filter, setFilter] = useState<ScheduleFilter>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Admin state
  const [adminTab, setAdminTab] = useState<AdminTab>("schedules");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  // User state
  const [userView, setUserView] = useState<"table" | "timetable">("table");

  // Filter options
  const [programs, setPrograms] = useState<string[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [instructors, setInstructors] = useState<string[]>([]);
  const [rooms, setRooms] = useState<string[]>([]);
  const [modules, setModules] = useState<{ code: string; title: string }[]>([]);

  const loadFilterOptions = useCallback(async () => {
    try {
      const [p, s, i, r, m] = await Promise.all([
        getPrograms(),
        getSections(),
        getInstructors(),
        getRooms(),
        getModules(),
      ]);
      setPrograms(p);
      setSections(s);
      setInstructors(i);
      setRooms(r);
      setModules(m);
    } catch {
      console.error("Failed to load filter options");
    }
  }, []);

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSchedules(filter);
      setSchedules(data);
    } catch (err) {
      setError("Failed to load schedules. Make sure the backend is running.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
      </div>
    );
  }

  const handleEdit = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this schedule?")) return;
    try {
      await deleteSchedule(id);
      loadSchedules();
      loadFilterOptions();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const handleSave = async (data: Partial<Schedule>) => {
    try {
      if (editingSchedule) {
        await updateSchedule(editingSchedule.id, data);
      } else {
        await createSchedule(
          data as Omit<Schedule, "id" | "createdAt" | "updatedAt">
        );
      }
      setModalOpen(false);
      setEditingSchedule(null);
      loadSchedules();
      loadFilterOptions();
    } catch (err) {
      console.error("Failed to save:", err);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportExcel();
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  // ============ ADMIN INTERFACE ============
  if (isAdmin) {
    return (
      <div className="min-h-screen bg-gray-100 flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col min-h-screen sticky top-0 h-screen">
          <div className="p-5 border-b border-gray-200">
            <h1 className="text-lg font-bold text-gray-900">Schedule Manager</h1>
            <p className="text-xs text-gray-500 mt-0.5">Admin Dashboard</p>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            <button
              onClick={() => setAdminTab("schedules")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${adminTab === "schedules"
                ? "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:bg-gray-50"
                }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Schedules
            </button>
            <button
              onClick={() => setAdminTab("timetable")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${adminTab === "timetable"
                ? "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:bg-gray-50"
                }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Timetable
            </button>
            <button
              onClick={() => setAdminTab("instructors")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${adminTab === "instructors"
                ? "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:bg-gray-50"
                }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Instructors
            </button>

            <div className="pt-4 mt-4 border-t border-gray-200">
              <button
                onClick={handleExport}
                disabled={exporting}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {exporting ? "Exporting..." : "Export Excel"}
              </button>
            </div>
          </nav>

          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{user.username}</p>
                <p className="text-xs text-amber-600 font-medium">Admin</p>
              </div>
              <button
                onClick={logout}
                className="text-sm text-red-600 hover:text-red-800 font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          {/* Top bar */}
          <header className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {adminTab === "schedules" && "Schedule Management"}
                  {adminTab === "timetable" && "Timetable View"}
                  {adminTab === "instructors" && "Instructor Overview"}
                </h2>
                <p className="text-sm text-gray-500">
                  London Metropolitan University &mdash; Spring 2026
                </p>
              </div>
              <div className="flex items-center gap-3">
                {adminTab === "schedules" && (
                  <button
                    onClick={() => {
                      setEditingSchedule(null);
                      setModalOpen(true);
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    + Add Schedule
                  </button>
                )}
              </div>
            </div>
          </header>

          <main className="p-6">
            {/* Stats bar */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="text-2xl font-bold text-gray-900">
                  {schedules.length}
                </div>
                <div className="text-xs text-gray-500 mt-1">Total Classes</div>
              </div>
              <div className="bg-blue-50 rounded-xl shadow-sm border border-blue-200 p-4">
                <div className="text-2xl font-bold text-blue-900">
                  {schedules.filter((s) => s.classType === "Lecture").length}
                </div>
                <div className="text-xs text-blue-600 mt-1">Lectures</div>
              </div>
              <div className="bg-green-50 rounded-xl shadow-sm border border-green-200 p-4">
                <div className="text-2xl font-bold text-green-900">
                  {schedules.filter((s) => s.classType === "Tutorial").length}
                </div>
                <div className="text-xs text-green-600 mt-1">Tutorials</div>
              </div>
              <div className="bg-purple-50 rounded-xl shadow-sm border border-purple-200 p-4">
                <div className="text-2xl font-bold text-purple-900">
                  {schedules.filter((s) => s.classType === "Workshop").length}
                </div>
                <div className="text-xs text-purple-600 mt-1">Workshops</div>
              </div>
              <div className="bg-amber-50 rounded-xl shadow-sm border border-amber-200 p-4">
                <div className="text-2xl font-bold text-amber-900">
                  {new Set(schedules.map((s) => s.instructor)).size}
                </div>
                <div className="text-xs text-amber-600 mt-1">Instructors</div>
              </div>
            </div>

            <FilterBar
              filter={filter}
              onChange={setFilter}
              programs={programs}
              sections={sections}
              instructors={instructors}
              rooms={rooms}
              modules={modules}
            />

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700">
                {error}
              </div>
            )}

            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                <p className="mt-3 text-gray-500">Loading schedules...</p>
              </div>
            ) : (
              <>
                {adminTab === "schedules" && (
                  <ScheduleTable
                    schedules={schedules}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    isAdmin={true}
                  />
                )}
                {adminTab === "timetable" && (
                  <TimetableView schedules={schedules} />
                )}
                {adminTab === "instructors" && (
                  <InstructorView
                    schedules={schedules}
                    onEdit={handleEdit}
                  />
                )}
              </>
            )}
          </main>
        </div>

        <ScheduleModal
          schedule={editingSchedule}
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditingSchedule(null);
          }}
          onSave={handleSave}
          programs={programs}
          sections={sections}
          instructors={instructors}
          rooms={rooms}
        />
      </div>
    );
  }

  // ============ NORMAL USER INTERFACE ============
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Schedule Viewer
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                London Metropolitan University &mdash; Spring 2026
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setUserView("table")}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${userView === "table"
                    ? "bg-white shadow-sm text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                  Table
                </button>
                <button
                  onClick={() => setUserView("timetable")}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${userView === "timetable"
                    ? "bg-white shadow-sm text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                  Timetable
                </button>
              </div>
              <div className="flex items-center gap-2 ml-2 pl-3 border-l border-gray-200">
                <span className="text-sm text-gray-600">
                  {user.username}
                  <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    viewer
                  </span>
                </span>
                <button
                  onClick={logout}
                  className="text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
        <FilterBar
          filter={filter}
          onChange={setFilter}
          programs={programs}
          sections={sections}
          instructors={instructors}
          rooms={rooms}
          modules={modules}
        />

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">
              {schedules.length}
            </div>
            <div className="text-xs text-gray-500 mt-1">Total Classes</div>
          </div>
          <div className="bg-blue-50 rounded-xl shadow-sm border border-blue-200 p-4">
            <div className="text-2xl font-bold text-blue-900">
              {schedules.filter((s) => s.classType === "Lecture").length}
            </div>
            <div className="text-xs text-blue-600 mt-1">Lectures</div>
          </div>
          <div className="bg-green-50 rounded-xl shadow-sm border border-green-200 p-4">
            <div className="text-2xl font-bold text-green-900">
              {schedules.filter((s) => s.classType === "Tutorial").length}
            </div>
            <div className="text-xs text-green-600 mt-1">Tutorials</div>
          </div>
          <div className="bg-purple-50 rounded-xl shadow-sm border border-purple-200 p-4">
            <div className="text-2xl font-bold text-purple-900">
              {schedules.filter((s) => s.classType === "Workshop").length}
            </div>
            <div className="text-xs text-purple-600 mt-1">Workshops</div>
          </div>
          <div className="bg-amber-50 rounded-xl shadow-sm border border-amber-200 p-4">
            <div className="text-2xl font-bold text-amber-900">
              {new Set(schedules.map((s) => s.instructor)).size}
            </div>
            <div className="text-xs text-amber-600 mt-1">Instructors</div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-3 text-gray-500">Loading schedules...</p>
          </div>
        ) : userView === "table" ? (
          <ScheduleTable
            schedules={schedules}
            onEdit={() => { }}
            onDelete={() => { }}
            isAdmin={false}
          />
        ) : (
          <TimetableView schedules={schedules} />
        )}
      </main>
    </div>
  );
}
