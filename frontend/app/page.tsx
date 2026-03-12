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
import ChangePasswordModal from "@/components/ChangePasswordModal";
import FilterBar from "@/components/FilterBar";
import ScheduleTable from "@/components/ScheduleTable";
import TimetableView from "@/components/TimetableView";
import ScheduleModal from "@/components/ScheduleModal";
import InstructorView from "@/components/InstructorView";
import ConflictsView from "@/components/ConflictsView";
import WorkloadDashboard from "@/components/WorkloadDashboard";
import RoomUtilization from "@/components/RoomUtilization";
import UserManagement from "@/components/UserManagement";
import AnnouncementsPanel from "@/components/AnnouncementsPanel";
import AuditLogView from "@/components/AuditLogView";
import GlobalSearch from "@/components/GlobalSearch";
import DarkModeToggle from "@/components/DarkModeToggle";
import AnnouncementsBanner from "@/components/AnnouncementsBanner";
import ImportExport from "@/components/ImportExport";
import StatsDashboard from "@/components/StatsDashboard";
import ProgramView from "@/components/ProgramView";
import RoomAvailability from "@/components/RoomAvailability";

type AdminTab = "schedules" | "timetable" | "dashboard" | "instructors" | "conflicts" | "workload" | "rooms" | "programs" | "users" | "announcements" | "audit" | "import-export";

export default function Home() {
  const { user, loading: authLoading, isAdmin, isInstructor, changePassword, logout } = useAuth();
  const router = useRouter();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [filter, setFilter] = useState<ScheduleFilter>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Admin state — restore from localStorage
  const [adminTab, setAdminTabRaw] = useState<AdminTab>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("adminTab");
      if (saved && ["schedules", "timetable", "dashboard", "instructors", "conflicts", "workload", "rooms", "programs", "users", "announcements", "audit", "import-export"].includes(saved)) {
        return saved as AdminTab;
      }
    }
    return "schedules";
  });
  const setAdminTab = (tab: AdminTab) => {
    setAdminTabRaw(tab);
    localStorage.setItem("adminTab", tab);
  };
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  // User state — restore from localStorage
  const [userView, setUserViewRaw] = useState<"table" | "timetable">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("userView");
      if (saved === "table" || saved === "timetable") return saved;
    }
    return "table";
  });
  const setUserView = (v: "table" | "timetable") => {
    setUserViewRaw(v);
    localStorage.setItem("userView", v);
  };

  const [showRoomAvailability, setShowRoomAvailability] = useState(false);

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
      <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex items-center justify-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
      </div>
    );
  }

  // Force password change for first-time logins
  if (user.mustChangePassword) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex items-center justify-center">
        <ChangePasswordModal
          isForced={true}
          onChangePassword={changePassword}
        />
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
      <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col min-h-screen sticky top-0 h-screen">
          <div className="p-5 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Schedule Manager</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Admin Dashboard</p>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {[
              { id: "schedules" as AdminTab, label: "Schedules", icon: "M4 6h16M4 10h16M4 14h16M4 18h16" },
              { id: "timetable" as AdminTab, label: "Timetable", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
              { id: "dashboard" as AdminTab, label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" },
              { id: "instructors" as AdminTab, label: "Instructors", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
              { id: "conflicts" as AdminTab, label: "Conflicts", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" },
              { id: "workload" as AdminTab, label: "Workload", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
              { id: "rooms" as AdminTab, label: "Room Utilization", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
              { id: "programs" as AdminTab, label: "Programs", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
              { id: "users" as AdminTab, label: "Users", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
              { id: "announcements" as AdminTab, label: "Announcements", icon: "M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" },
              { id: "audit" as AdminTab, label: "Audit Log", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
              { id: "import-export" as AdminTab, label: "Import/Export", icon: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setAdminTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${adminTab === tab.id
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                  }`}
              >
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.username}</p>
                <p className="text-xs text-amber-600 font-medium">Admin</p>
              </div>
              <div className="flex items-center gap-2">
                <DarkModeToggle />
                <button
                  onClick={logout}
                  className="text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          {/* Top bar */}
          <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {adminTab === "schedules" && "Schedule Management"}
                  {adminTab === "timetable" && "Timetable View"}
                  {adminTab === "dashboard" && "Analytics Dashboard"}
                  {adminTab === "instructors" && "Instructor Overview"}
                  {adminTab === "conflicts" && "Conflict Detection"}
                  {adminTab === "workload" && "Instructor Workload"}
                  {adminTab === "rooms" && "Room Utilization"}
                  {adminTab === "programs" && "Programs & Modules"}
                  {adminTab === "users" && "User Management"}
                  {adminTab === "announcements" && "Announcements"}
                  {adminTab === "audit" && "Audit Log"}
                  {adminTab === "import-export" && "Import / Export"}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  London Metropolitan University &mdash; Spring 2026
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-72">
                  <GlobalSearch schedules={schedules} />
                </div>
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
                {adminTab === "dashboard" && (
                  <StatsDashboard />
                )}
                {adminTab === "instructors" && (
                  <InstructorView
                    schedules={schedules}
                    onEdit={handleEdit}
                  />
                )}
                {adminTab === "conflicts" && <ConflictsView />}
                {adminTab === "workload" && <WorkloadDashboard schedules={schedules} />}
                {adminTab === "rooms" && <RoomUtilization />}
                {adminTab === "programs" && <ProgramView />}
                {adminTab === "users" && <UserManagement />}
                {adminTab === "announcements" && <AnnouncementsPanel />}
                {adminTab === "audit" && <AuditLogView />}
                {adminTab === "import-export" && (
                  <ImportExport onImportComplete={() => { loadSchedules(); loadFilterOptions(); }} />
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

  // ============ INSTRUCTOR INTERFACE ============
  if (isInstructor && user.instructorName) {
    const mySchedules = schedules.filter(
      (s) => s.instructor === user.instructorName
    );
    const myModules = Array.from(
      new Map(
        mySchedules.map((s) => [s.moduleCode, { code: s.moduleCode, title: s.moduleTitle }])
      ).values()
    );
    const totalHours = mySchedules.reduce((sum, s) => {
      return sum + (s.hours || 0);
    }, 0);

    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-950">
        <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  My Schedule
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {user.instructorName} &mdash; Spring 2026
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                  <button
                    onClick={() => setUserView("table")}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${userView === "table"
                      ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                      }`}
                  >
                    Table
                  </button>
                  <button
                    onClick={() => setUserView("timetable")}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${userView === "timetable"
                      ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                      }`}
                  >
                    Timetable
                  </button>
                </div>
                <DarkModeToggle />
                <div className="flex items-center gap-2 ml-2 pl-3 border-l border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {user.username}
                    <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                      instructor
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
          <AnnouncementsBanner />

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{mySchedules.length}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">My Classes</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl shadow-sm border border-blue-200 dark:border-blue-900/60 p-4">
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{myModules.length}</div>
              <div className="text-xs text-blue-600 dark:text-blue-300 mt-1">My Modules</div>
            </div>
            <div className="bg-green-50 dark:bg-emerald-950/30 rounded-xl shadow-sm border border-green-200 dark:border-emerald-900/60 p-4">
              <div className="text-2xl font-bold text-green-900 dark:text-emerald-100">{totalHours.toFixed(1)}h</div>
              <div className="text-xs text-green-600 dark:text-emerald-300 mt-1">Hours/Week</div>
            </div>
            <div className="bg-purple-50 dark:bg-violet-950/30 rounded-xl shadow-sm border border-purple-200 dark:border-violet-900/60 p-4">
              <div className="text-2xl font-bold text-purple-900 dark:text-violet-100">
                {new Set(mySchedules.map((s) => s.day)).size}
              </div>
              <div className="text-xs text-purple-600 dark:text-violet-300 mt-1">Teaching Days</div>
            </div>
          </div>

          {/* My Modules */}
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-5 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">My Modules</h3>
            <div className="flex flex-wrap gap-2">
              {myModules.map((m) => (
                <span
                  key={m.code}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-100 border border-blue-200 dark:border-blue-900/60"
                >
                  <span className="font-semibold">{m.code}</span>
                  <span className="mx-1.5 text-blue-300 dark:text-blue-700">|</span>
                  {m.title}
                  <span className="ml-2 text-xs bg-blue-200 dark:bg-blue-900/70 text-blue-800 dark:text-blue-100 px-1.5 py-0.5 rounded-full">
                    {mySchedules.filter((s) => s.moduleCode === m.code).length}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* Room Availability */}
          {showRoomAvailability ? (
            <div>
              <button
                onClick={() => setShowRoomAvailability(false)}
                className="mb-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm font-medium"
              >
                Hide Room Availability
              </button>
              <RoomAvailability schedules={schedules} />
            </div>
          ) : (
            <button
              onClick={() => setShowRoomAvailability(true)}
              className="mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
            >
              Check Room Availability
            </button>
          )}

          {/* Schedule */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
              <p className="mt-3 text-gray-500 dark:text-gray-400">Loading schedules...</p>
            </div>
          ) : userView === "table" ? (
            <ScheduleTable
              schedules={mySchedules}
              onEdit={() => { }}
              onDelete={() => { }}
              isAdmin={false}
            />
          ) : (
            <TimetableView schedules={mySchedules} />
          )}
        </main>
      </div>
    );
  }

  // ============ NORMAL USER INTERFACE ============
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Schedule Viewer
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                London Metropolitan University &mdash; Spring 2026
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-64">
                <GlobalSearch schedules={schedules} />
              </div>
              <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setUserView("table")}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${userView === "table"
                    ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                    }`}
                >
                  Table
                </button>
                <button
                  onClick={() => setUserView("timetable")}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${userView === "timetable"
                    ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                    }`}
                >
                  Timetable
                </button>
              </div>
              <DarkModeToggle />
              <div className="flex items-center gap-2 ml-2 pl-3 border-l border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {user.username}
                  <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
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
        <AnnouncementsBanner />

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
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {schedules.length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total Classes</div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl shadow-sm border border-blue-200 dark:border-blue-900/60 p-4">
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {schedules.filter((s) => s.classType === "Lecture").length}
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-300 mt-1">Lectures</div>
          </div>
          <div className="bg-green-50 dark:bg-emerald-950/30 rounded-xl shadow-sm border border-green-200 dark:border-emerald-900/60 p-4">
            <div className="text-2xl font-bold text-green-900 dark:text-emerald-100">
              {schedules.filter((s) => s.classType === "Tutorial").length}
            </div>
            <div className="text-xs text-green-600 dark:text-emerald-300 mt-1">Tutorials</div>
          </div>
          <div className="bg-purple-50 dark:bg-violet-950/30 rounded-xl shadow-sm border border-purple-200 dark:border-violet-900/60 p-4">
            <div className="text-2xl font-bold text-purple-900 dark:text-violet-100">
              {schedules.filter((s) => s.classType === "Workshop").length}
            </div>
            <div className="text-xs text-purple-600 dark:text-violet-300 mt-1">Workshops</div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl shadow-sm border border-amber-200 dark:border-amber-900/60 p-4">
            <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">
              {new Set(schedules.map((s) => s.instructor)).size}
            </div>
            <div className="text-xs text-amber-600 dark:text-amber-300 mt-1">Instructors</div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-xl p-4 mb-6 text-red-700 dark:text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-3 text-gray-500 dark:text-gray-400">Loading schedules...</p>
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
