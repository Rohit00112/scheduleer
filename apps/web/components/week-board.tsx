"use client";

import { useMemo, useState } from "react";

interface BoardCell {
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
  conflictFlags: {
    room: boolean;
    lecturer: boolean;
    group: boolean;
  };
}

interface BoardData {
  rooms: Array<{ id: string; name: string; block: string | null; level: string | null }>;
  timeslots: Array<{ id: string; startMinute: number; label: string }>;
  cells: BoardCell[];
  summary: {
    sessionCount: number;
    roomCount: number;
    timeslotCount: number;
    exceptionCount: number;
    conflictCount: number;
  };
}

function classTypeClass(value: string): string {
  const lower = value.toLowerCase();
  if (lower.includes("lecture")) {
    return "class-lecture";
  }

  if (lower.includes("tutorial")) {
    return "class-tutorial";
  }

  if (lower.includes("workshop")) {
    return "class-workshop";
  }

  return "class-other";
}

export function WeekBoard({ data, title }: { data: BoardData | null; title: string }) {
  const [mobileMode, setMobileMode] = useState<"time" | "room" | "sessions">("time");

  const { cellStarts, hiddenCells } = useMemo(() => {
    const starts = new Map<string, BoardCell>();
    const hidden = new Set<string>();

    for (const cell of data?.cells ?? []) {
      starts.set(`${cell.roomId}:${cell.rowStart}`, cell);
      for (let step = 1; step < cell.rowSpan; step += 1) {
        hidden.add(`${cell.roomId}:${cell.rowStart + step}`);
      }
    }

    return {
      cellStarts: starts,
      hiddenCells: hidden
    };
  }, [data]);

  if (!data) {
    return <p className="loading">Loading board...</p>;
  }

  return (
    <section className="board-card">
      <header className="board-header">
        <div>
          <h3>{title}</h3>
          <p>
            {data.summary.sessionCount} sessions across {data.summary.roomCount} rooms
          </p>
        </div>

        <div className="board-legend">
          <span className="pill class-lecture">Lecture</span>
          <span className="pill class-tutorial">Tutorial</span>
          <span className="pill class-workshop">Workshop</span>
          <span className="pill class-other">Other</span>
        </div>
      </header>

      <div className="mobile-board-tabs">
        <button
          className={mobileMode === "time" ? "active" : ""}
          onClick={() => setMobileMode("time")}
        >
          By Time
        </button>
        <button
          className={mobileMode === "room" ? "active" : ""}
          onClick={() => setMobileMode("room")}
        >
          By Room
        </button>
        <button
          className={mobileMode === "sessions" ? "active" : ""}
          onClick={() => setMobileMode("sessions")}
        >
          My Sessions
        </button>
      </div>

      <div className="board-wrap desktop-board">
        <table className="board-table">
          <thead>
            <tr>
              <th className="time-col">Time</th>
              {data.rooms.map((room) => (
                <th key={room.id}>{room.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.timeslots.map((slot, rowIndex) => (
              <tr key={slot.id}>
                <th className="time-col">{slot.label}</th>
                {data.rooms.map((room) => {
                  const key = `${room.id}:${rowIndex}`;
                  const cell = cellStarts.get(key);
                  if (cell) {
                    const conflict =
                      cell.conflictFlags.room || cell.conflictFlags.lecturer || cell.conflictFlags.group;

                    return (
                      <td
                        key={key}
                        rowSpan={cell.rowSpan}
                        className={`session-cell ${classTypeClass(cell.classType)} ${conflict ? "has-conflict" : ""}`}
                      >
                        <strong>
                          {cell.start} - {cell.end}
                        </strong>
                        <p>
                          {cell.moduleCode ?? "N/A"} {cell.moduleTitle ?? ""}
                        </p>
                        <p>{cell.lecturerName ?? "Unassigned"}</p>
                        {cell.groups.length > 0 ? <small>{cell.groups.join(", ")}</small> : null}
                        {cell.dayType === "exception" ? <em>Exception</em> : null}
                      </td>
                    );
                  }

                  if (hiddenCells.has(key)) {
                    return null;
                  }

                  return <td key={key} className="empty-cell" />;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mobile-board-list">
        {mobileMode === "time" ? (
          <div className="panel-list">
            {data.cells
              .slice()
              .sort((a, b) => a.start.localeCompare(b.start) || a.roomName.localeCompare(b.roomName))
              .map((cell) => (
                <article key={cell.id} className={classTypeClass(cell.classType)}>
                  <header>
                    <strong>
                      {cell.start} - {cell.end}
                    </strong>
                    <span>{cell.roomName}</span>
                  </header>
                  <p>
                    {cell.moduleCode ?? "N/A"} {cell.moduleTitle ?? ""}
                  </p>
                </article>
              ))}
          </div>
        ) : null}

        {mobileMode === "room" ? (
          <div className="panel-list">
            {data.rooms.map((room) => {
              const roomSessions = data.cells.filter((cell) => cell.roomId === room.id);
              return (
                <article key={room.id}>
                  <header>
                    <strong>{room.name}</strong>
                    <span>{roomSessions.length} sessions</span>
                  </header>
                  {roomSessions.length === 0 ? <p>No sessions.</p> : null}
                  {roomSessions.map((cell) => (
                    <p key={cell.id}>
                      {cell.start} {cell.moduleCode ?? "N/A"}
                    </p>
                  ))}
                </article>
              );
            })}
          </div>
        ) : null}

        {mobileMode === "sessions" ? (
          <div className="panel-list">
            {data.cells.map((cell) => (
              <article key={cell.id}>
                <header>
                  <strong>
                    {cell.moduleCode ?? "N/A"} {cell.classType}
                  </strong>
                  <span>{cell.roomName}</span>
                </header>
                <p>
                  {cell.start} - {cell.end}
                </p>
                <p>{cell.lecturerName ?? "Unassigned"}</p>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
