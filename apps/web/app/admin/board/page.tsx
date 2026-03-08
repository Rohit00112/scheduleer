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

export default function AdminBoardPage() {
  const { token } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [room, setRoom] = useState("");
  const [course, setCourse] = useState("");
  const [group, setGroup] = useState("");
  const [lecturer, setLecturer] = useState("");
  const [board, setBoard] = useState<BoardData | null>(null);

  const loadBoard = useCallback(async () => {
    if (!token) {
      return;
    }

    const params = new URLSearchParams({
      date,
      scope: "all"
    });

    if (room) {
      params.set("room", room);
    }
    if (course) {
      params.set("course", course);
    }
    if (group) {
      params.set("group", group);
    }
    if (lecturer) {
      params.set("lecturer", lecturer);
    }

    const data = await apiFetch<BoardData>(`/board/weekly?${params.toString()}`, { token });
    setBoard(data);
  }, [token, date, room, course, group, lecturer]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const socket = getSocket(token);
    socket.emit("subscribe.board", { scope: "all", date });

    const onBoardUpdated = () => {
      loadBoard();
    };

    socket.on("board.updated", onBoardUpdated);
    socket.on("schedule.activated", onBoardUpdated);

    return () => {
      socket.off("board.updated", onBoardUpdated);
      socket.off("schedule.activated", onBoardUpdated);
    };
  }, [token, date, loadBoard]);

  return (
    <section>
      <h3>Weekly Room Matrix</h3>
      <div className="controls">
        <label>
          Date
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label>
          Room
          <input value={room} onChange={(event) => setRoom(event.target.value)} placeholder="A101" />
        </label>
        <label>
          Course
          <input value={course} onChange={(event) => setCourse(event.target.value)} placeholder="BIT" />
        </label>
        <label>
          Group
          <input value={group} onChange={(event) => setGroup(event.target.value)} placeholder="C1" />
        </label>
        <label>
          Lecturer
          <input value={lecturer} onChange={(event) => setLecturer(event.target.value)} placeholder="Name" />
        </label>
        <button onClick={loadBoard}>Apply</button>
      </div>

      <WeekBoard data={board} title="All Rooms Board" />
    </section>
  );
}
