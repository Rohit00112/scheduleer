"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../components/auth-context";
import { apiFetch } from "../../../lib/api";

interface LecturerItem {
  lecturerId: string;
  lecturerName: string;
  sessionCount: number;
  totalHours: number;
  peakWindow: string | null;
}

interface RoomItem {
  roomId: string;
  roomName: string;
  occupancyRate: number;
  occupiedHours: number;
  idleHours: number;
}

export default function AdminAnalyticsPage() {
  const { token } = useAuth();
  const [lecturers, setLecturers] = useState<LecturerItem[]>([]);
  const [rooms, setRooms] = useState<RoomItem[]>([]);

  useEffect(() => {
    if (!token) {
      return;
    }

    Promise.all([
      apiFetch<{ items: LecturerItem[] }>("/admin/analytics/lecturers", { token }),
      apiFetch<{ items: RoomItem[] }>("/admin/analytics/rooms", { token })
    ]).then(([lecturerData, roomData]) => {
      setLecturers(lecturerData.items);
      setRooms(roomData.items);
    });
  }, [token]);

  return (
    <section>
      <h3>Analytics</h3>
      <div className="analytics-grid">
        <article>
          <h4>Lecturer Load</h4>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Lecturer</th>
                  <th>Sessions</th>
                  <th>Hours</th>
                  <th>Peak</th>
                </tr>
              </thead>
              <tbody>
                {lecturers.map((item) => (
                  <tr key={item.lecturerId}>
                    <td>{item.lecturerName}</td>
                    <td>{item.sessionCount}</td>
                    <td>{item.totalHours}</td>
                    <td>{item.peakWindow ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article>
          <h4>Room Utilization</h4>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Occupancy %</th>
                  <th>Occupied Hrs</th>
                  <th>Idle Hrs</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((item) => (
                  <tr key={item.roomId}>
                    <td>{item.roomName}</td>
                    <td>{item.occupancyRate}</td>
                    <td>{item.occupiedHours}</td>
                    <td>{item.idleHours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}
