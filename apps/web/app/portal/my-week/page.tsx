"use client";

import { useCallback, useEffect, useState } from "react";
import { getSocket } from "../../../components/socket";
import { WeekBoard } from "../../../components/week-board";
import { useAuth } from "../../../components/auth-context";
import { apiFetch } from "../../../lib/api";

interface BoardData {
  rooms: Array<{ id: string; name: string; block: string | null; level: string | null }>;
  timeslots: Array<{ id: string; startMinute: number; label: string }>;
  cells: Array<{
    id: string;
    roomId: string;
    roomName: string;
    rowStart: number;
    rowSpan: number;
    start: string;
    end: string;
    classType: string;
    moduleCode: string | null;
    moduleTitle: string | null;
    lecturerName: string | null;
    groups: string[];
    dayType: "weekly" | "exception";
    conflictFlags: { room: boolean; lecturer: boolean; group: boolean };
  }>;
  summary: {
    sessionCount: number;
    roomCount: number;
    timeslotCount: number;
    exceptionCount: number;
    conflictCount: number;
  };
}

export default function PortalMyWeekPage() {
  const { token } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [board, setBoard] = useState<BoardData | null>(null);
  const [room, setRoom] = useState("");

  const loadBoard = useCallback(async () => {
    if (!token) {
      return;
    }

    const params = new URLSearchParams({
      date,
      scope: "mine"
    });

    if (room) {
      params.set("room", room);
    }

    const data = await apiFetch<BoardData>(`/board/weekly?${params.toString()}`, { token });
    setBoard(data);
  }, [token, date, room]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const socket = getSocket(token);
    socket.emit("subscribe.board", { scope: "mine", date });

    const reload = () => {
      loadBoard();
    };

    socket.on("board.updated", reload);
    socket.on("schedule.activated", reload);

    return () => {
      socket.off("board.updated", reload);
      socket.off("schedule.activated", reload);
    };
  }, [token, date, loadBoard]);

  return (
    <section>
      <h3>My Week Board</h3>
      <div className="controls">
        <label>
          Date
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label>
          Room Filter
          <input value={room} onChange={(event) => setRoom(event.target.value)} placeholder="A101" />
        </label>
        <button onClick={loadBoard}>Refresh</button>
      </div>

      <WeekBoard data={board} title="My Weekly Timetable" />
    </section>
  );
}
