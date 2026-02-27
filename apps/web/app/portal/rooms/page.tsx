"use client";

import { useEffect, useState } from "react";
import { getSocket } from "../../../components/socket";
import { useAuth } from "../../../components/auth-context";
import { apiFetch } from "../../../lib/api";

interface AvailabilityItem {
  roomId: string;
  roomName: string;
  isAvailable: boolean;
  conflicts: Array<{
    id: string;
    start: string;
    end: string;
    moduleCode: string | null;
    lecturerName: string | null;
  }>;
}

interface Timeline {
  roomName: string;
  weekly: Array<{ id: string; start: string; end: string; moduleCode: string | null }>;
  exceptions: Array<{ id: string; start: string; end: string; moduleCode: string | null }>;
}

export default function PortalRoomsPage() {
  const { token } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("09:30");
  const [items, setItems] = useState<AvailabilityItem[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>("");
  const [timeline, setTimeline] = useState<Timeline | null>(null);

  async function loadAvailability() {
    if (!token) {
      return;
    }

    const data = await apiFetch<{ items: AvailabilityItem[] }>(
      `/rooms/availability?date=${date}&start=${start}&end=${end}`,
      { token }
    );
    setItems(data.items);
  }

  useEffect(() => {
    loadAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token || !selectedRoom) {
      return;
    }

    apiFetch<Timeline>(`/rooms/${selectedRoom}/timeline?date=${date}`, { token }).then(setTimeline);
  }, [token, selectedRoom, date]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const socket = getSocket(token);
    socket.emit("subscribe.rooms", { date });
    socket.on("room.status.updated", () => {
      loadAvailability();
    });

    return () => {
      socket.off("room.status.updated");
    };
  }, [token, date]);

  return (
    <section>
      <h3>Room Availability</h3>
      <div className="controls">
        <label>
          Date
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label>
          Start
          <input type="time" value={start} onChange={(event) => setStart(event.target.value)} />
        </label>
        <label>
          End
          <input type="time" value={end} onChange={(event) => setEnd(event.target.value)} />
        </label>
        <button onClick={loadAvailability}>Check</button>
      </div>

      <div className="panel-list section-gap">
        {items.map((item) => (
          <article key={item.roomId} className={selectedRoom === item.roomId ? "active-row" : ""}>
            <header>
              <strong>{item.roomName}</strong>
              <span className={item.isAvailable ? "ok" : "warn"}>{item.isAvailable ? "Available" : "Busy"}</span>
            </header>
            <button onClick={() => setSelectedRoom(item.roomId)}>View Timeline</button>
            {item.conflicts.map((conflict) => (
              <p key={conflict.id}>
                {conflict.start} - {conflict.end} {conflict.moduleCode ?? "N/A"} {conflict.lecturerName ?? ""}
              </p>
            ))}
          </article>
        ))}
      </div>

      {timeline ? (
        <section className="section-gap">
          <h4>{timeline.roomName} Timeline</h4>
          <p>Weekly sessions: {timeline.weekly.length}</p>
          <p>Exception sessions: {timeline.exceptions.length}</p>
        </section>
      ) : null}
    </section>
  );
}
