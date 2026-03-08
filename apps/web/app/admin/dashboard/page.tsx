"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../components/auth-context";
import { apiFetch } from "../../../lib/api";

interface OverviewData {
  activeVersionId: string | null;
  versionsTotal: number;
  draftVersions: number;
  validatedVersions: number;
  roomsActive: number;
  conflictsOpen: number;
  queuedImports: number;
  processingImports: number;
  mappedUsers: number;
}

interface RoomAnalytics {
  roomId: string;
  roomName: string;
  occupancyRate: number;
}

export default function AdminDashboardPage() {
  const { token } = useAuth();
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [rooms, setRooms] = useState<RoomAnalytics[]>([]);

  useEffect(() => {
    if (!token) {
      return;
    }

    Promise.all([
      apiFetch<OverviewData>("/admin/overview", { token }),
      apiFetch<{ items: RoomAnalytics[] }>("/admin/analytics/rooms", { token })
    ]).then(([overviewData, roomData]) => {
      setOverview(overviewData);
      setRooms(roomData.items.slice(0, 6));
    });
  }, [token]);

  return (
    <section>
      <h3>Operations Snapshot</h3>
      <div className="kpi-grid">
        <article>
          <h4>Active Version</h4>
          <p>{overview?.activeVersionId ? overview.activeVersionId.slice(0, 8) : "None"}</p>
        </article>
        <article>
          <h4>Total Versions</h4>
          <p>{overview?.versionsTotal ?? 0}</p>
        </article>
        <article>
          <h4>Queued Imports</h4>
          <p>{overview?.queuedImports ?? 0}</p>
        </article>
        <article>
          <h4>Open Conflicts</h4>
          <p>{overview?.conflictsOpen ?? 0}</p>
        </article>
        <article>
          <h4>Active Rooms</h4>
          <p>{overview?.roomsActive ?? 0}</p>
        </article>
        <article>
          <h4>User Mappings</h4>
          <p>{overview?.mappedUsers ?? 0}</p>
        </article>
      </div>

      <section className="section-gap">
        <h3>Top Room Occupancy</h3>
        <div className="panel-list">
          {rooms.map((room) => (
            <article key={room.roomId}>
              <header>
                <strong>{room.roomName}</strong>
                <span>{room.occupancyRate}%</span>
              </header>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
