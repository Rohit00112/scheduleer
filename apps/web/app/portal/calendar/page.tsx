"use client";

import { useState } from "react";
import { useAuth } from "../../../components/auth-context";
import { API_BASE_URL } from "../../../lib/api";

export default function PortalCalendarPage() {
  const { token } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  function download(range: "week" | "month") {
    if (!token) {
      return;
    }

    const url = new URL(`${API_BASE_URL}/portal/calendar.ics`);
    url.searchParams.set("range", range);
    url.searchParams.set("date", date);

    fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then((response) => response.text())
      .then((text) => {
        const blob = new Blob([text], { type: "text/calendar" });
        const href = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = href;
        anchor.download = `schedule-${range}.ics`;
        anchor.click();
        URL.revokeObjectURL(href);
      });
  }

  return (
    <section>
      <h3>Calendar Export</h3>
      <p>Export your timetable to Google Calendar, Outlook, or Apple Calendar.</p>
      <div className="controls">
        <label>
          Start Date
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <button onClick={() => download("week")}>Export Week (.ics)</button>
        <button onClick={() => download("month")}>Export Month (.ics)</button>
      </div>
    </section>
  );
}
