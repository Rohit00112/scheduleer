"use client";

import { useState, useMemo } from "react";
import { Schedule } from "@/lib/types";

interface RoomAvailabilityProps {
    schedules: Schedule[];
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const TIME_SLOTS = [
    { label: "08:00 AM - 09:30 AM", start: "08:00 AM", end: "09:30 AM" },
    { label: "10:30 AM - 12:00 PM", start: "10:30 AM", end: "12:00 PM" },
    { label: "12:30 PM - 02:00 PM", start: "12:30 PM", end: "02:00 PM" },
    { label: "02:30 PM - 04:00 PM", start: "02:30 PM", end: "04:00 PM" },
];

export default function RoomAvailability({ schedules }: RoomAvailabilityProps) {
    const [selectedDay, setSelectedDay] = useState(DAYS[1]);
    const [selectedSlot, setSelectedSlot] = useState(TIME_SLOTS[0].label);

    const allRooms = useMemo(() => {
        const roomSet = new Set<string>();
        schedules.forEach((s) => {
            if (s.room) roomSet.add(s.room);
        });
        return Array.from(roomSet).sort();
    }, [schedules]);

    const slot = TIME_SLOTS.find((s) => s.label === selectedSlot)!;

    const occupiedRooms = useMemo(() => {
        const map = new Map<string, Schedule>();
        if (!slot) return map;
        schedules.forEach((s) => {
            if (s.day === selectedDay && s.startTime === slot.start && s.endTime === slot.end) {
                map.set(s.room, s);
            }
        });
        return map;
    }, [schedules, selectedDay, slot]);

    const availableRooms = allRooms.filter((r) => !occupiedRooms.has(r));
    const busyRooms = allRooms.filter((r) => occupiedRooms.has(r));

    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-5 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Room Availability</h3>

            <div className="flex flex-wrap gap-3 mb-5">
                <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Day</label>
                    <select
                        value={selectedDay}
                        onChange={(e) => setSelectedDay(e.target.value)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        {DAYS.map((d) => (
                            <option key={d} value={d}>{d}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Time Slot</label>
                    <select
                        value={selectedSlot}
                        onChange={(e) => setSelectedSlot(e.target.value)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        {TIME_SLOTS.map((s) => (
                            <option key={s.label} value={s.label}>{s.label}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-end gap-4 ml-2">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <span className="w-3 h-3 rounded bg-green-500 inline-block" />
                        Available ({availableRooms.length})
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <span className="w-3 h-3 rounded bg-red-400 inline-block" />
                        Occupied ({busyRooms.length})
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {allRooms.map((room) => {
                    const occupied = occupiedRooms.get(room);
                    return (
                        <div
                            key={room}
                            className={`rounded-lg border p-3 text-sm transition-colors ${occupied
                                ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900/60"
                                : "bg-green-50 border-green-200 dark:bg-emerald-950/30 dark:border-emerald-900/60"
                                }`}
                        >
                            <div className={`font-semibold ${occupied ? "text-red-800 dark:text-red-100" : "text-green-800 dark:text-emerald-100"}`}>
                                {room}
                            </div>
                            {occupied ? (
                                <div className="text-xs text-red-600 dark:text-red-200 mt-1">
                                    <div>{occupied.moduleCode}</div>
                                    <div className="truncate">{occupied.instructor}</div>
                                </div>
                            ) : (
                                <div className="text-xs text-green-600 dark:text-emerald-200 mt-1">Available</div>
                            )}
                        </div>
                    );
                })}
            </div>

            {allRooms.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No room data available.</p>
            )}
        </div>
    );
}
