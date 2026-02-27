"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../components/auth-context";
import { apiFetch } from "../../../lib/api";

interface SessionItem {
  id: string;
  start: string;
  end: string;
  classType: string;
  moduleCode: string | null;
  moduleTitle: string | null;
  roomName: string;
  lecturerName?: string | null;
  groups: string[];
}

export default function PortalTodayPage() {
  const { token } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [weekly, setWeekly] = useState<SessionItem[]>([]);
  const [exceptions, setExceptions] = useState<SessionItem[]>([]);

  useEffect(() => {
    if (!token) {
      return;
    }

    apiFetch<{ weekly: SessionItem[]; exceptions: SessionItem[] }>(`/schedule/my?date=${date}`, { token }).then((data) => {
      setWeekly(data.weekly);
      setExceptions(data.exceptions);
    });
  }, [token, date]);

  return (
    <section>
      <h3>Today Agenda</h3>
      <label className="inline-field">
        Date
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>

      <div className="agenda-list section-gap">
        {[...weekly, ...exceptions]
          .sort((a, b) => a.start.localeCompare(b.start))
          .map((item) => (
            <article key={item.id}>
              <header>
                <strong>
                  {item.start} - {item.end}
                </strong>
                <span>{item.classType}</span>
              </header>
              <p>
                {item.moduleCode ?? "N/A"} {item.moduleTitle ?? ""}
              </p>
              <p>{item.roomName}</p>
            </article>
          ))}
      </div>
    </section>
  );
}
