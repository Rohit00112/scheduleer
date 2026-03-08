"use client";

import { Schedule } from "@/lib/types";
import { useState, useEffect } from "react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const CLASS_TYPES = ["Lecture", "Tutorial", "Workshop"];

interface ScheduleModalProps {
    schedule: Schedule | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<Schedule>) => void;
    programs: string[];
    sections: string[];
    instructors: string[];
    rooms: string[];
}

export default function ScheduleModal({
    schedule,
    isOpen,
    onClose,
    onSave,
    programs,
    sections,
    instructors,
    rooms,
}: ScheduleModalProps) {
    const [form, setForm] = useState({
        day: "",
        startTime: "",
        endTime: "",
        classType: "",
        year: 1,
        moduleCode: "",
        moduleTitle: "",
        instructor: "",
        group: "",
        block: "",
        level: 1,
        room: "",
        program: "",
        section: "",
    });

    useEffect(() => {
        if (schedule) {
            setForm({
                day: schedule.day,
                startTime: schedule.startTime,
                endTime: schedule.endTime,
                classType: schedule.classType,
                year: schedule.year,
                moduleCode: schedule.moduleCode,
                moduleTitle: schedule.moduleTitle,
                instructor: schedule.instructor,
                group: schedule.group,
                block: schedule.block,
                level: schedule.level,
                room: schedule.room,
                program: schedule.program,
                section: schedule.section,
            });
        } else {
            setForm({
                day: "",
                startTime: "",
                endTime: "",
                classType: "",
                year: 1,
                moduleCode: "",
                moduleTitle: "",
                instructor: "",
                group: "",
                block: "",
                level: 1,
                room: "",
                program: "",
                section: "",
            });
        }
    }, [schedule, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(form);
    };

    const update = (key: string, value: string | number) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="fixed inset-0 bg-black/30" onClick={onClose} />
                <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">
                        {schedule ? "Edit Schedule" : "Add Schedule"}
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
                                <select
                                    value={form.day}
                                    onChange={(e) => update("day", e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                    required
                                >
                                    <option value="">Select Day</option>
                                    {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Class Type</label>
                                <select
                                    value={form.classType}
                                    onChange={(e) => update("classType", e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                    required
                                >
                                    <option value="">Select Type</option>
                                    {CLASS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                                <input
                                    type="text"
                                    value={form.startTime}
                                    onChange={(e) => update("startTime", e.target.value)}
                                    placeholder="08:00 AM"
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                                <input
                                    type="text"
                                    value={form.endTime}
                                    onChange={(e) => update("endTime", e.target.value)}
                                    placeholder="09:30 AM"
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Module Code</label>
                                <input
                                    type="text"
                                    value={form.moduleCode}
                                    onChange={(e) => update("moduleCode", e.target.value)}
                                    placeholder="CS4001NT"
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Module Title</label>
                                <input
                                    type="text"
                                    value={form.moduleTitle}
                                    onChange={(e) => update("moduleTitle", e.target.value)}
                                    placeholder="Programming"
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Program</label>
                                <select
                                    value={form.program}
                                    onChange={(e) => update("program", e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                    required
                                >
                                    <option value="">Select Program</option>
                                    {programs.map((p) => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                                <select
                                    value={form.year}
                                    onChange={(e) => update("year", Number(e.target.value))}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                    required
                                >
                                    <option value={1}>Year 1</option>
                                    <option value={2}>Year 2</option>
                                    <option value={3}>Year 3</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                                <input
                                    type="text"
                                    value={form.section}
                                    onChange={(e) => update("section", e.target.value)}
                                    placeholder="L1C1"
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Instructor</label>
                                <input
                                    type="text"
                                    value={form.instructor}
                                    onChange={(e) => update("instructor", e.target.value)}
                                    placeholder="Mr. John Doe"
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                    list="instructors-list"
                                    required
                                />
                                <datalist id="instructors-list">
                                    {instructors.map((i) => <option key={i} value={i} />)}
                                </datalist>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Group</label>
                                <input
                                    type="text"
                                    value={form.group}
                                    onChange={(e) => update("group", e.target.value)}
                                    placeholder="C1+C2+C3"
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
                                <input
                                    type="text"
                                    value={form.room}
                                    onChange={(e) => update("room", e.target.value)}
                                    placeholder="LT-08 Vairav Tech"
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                    list="rooms-list"
                                    required
                                />
                                <datalist id="rooms-list">
                                    {rooms.map((r) => <option key={r} value={r} />)}
                                </datalist>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Block</label>
                                <input
                                    type="text"
                                    value={form.block}
                                    onChange={(e) => update("block", e.target.value)}
                                    placeholder="Tower"
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
                                <input
                                    type="number"
                                    value={form.level}
                                    onChange={(e) => update("level", Number(e.target.value))}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                    required
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                            >
                                {schedule ? "Update" : "Create"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
