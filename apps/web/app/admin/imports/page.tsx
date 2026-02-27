"use client";

import { useEffect, useState } from "react";
import { getSocket } from "../../../components/socket";
import { API_BASE_URL, apiFetch } from "../../../lib/api";
import { useAuth } from "../../../components/auth-context";

interface VersionItem {
  id: string;
  sourceFileName: string;
  status: string;
  createdAt: string;
  _count: {
    weeklySessions: number;
    exceptionSessions: number;
    conflicts: number;
  };
}

export default function AdminImportsPage() {
  const { token } = useAuth();
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [progress, setProgress] = useState<string>("Idle");
  const [uploading, setUploading] = useState(false);

  async function loadVersions() {
    if (!token) {
      return;
    }

    const data = await apiFetch<VersionItem[]>("/schedule-versions", { token });
    setVersions(data);
  }

  useEffect(() => {
    loadVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const socket = getSocket(token);

    socket.on("import.progress", (payload: { percent: number; phase: string }) => {
      setProgress(`${payload.percent}% - ${payload.phase}`);
    });

    socket.on("import.completed", () => {
      setUploading(false);
      setProgress("Completed");
      loadVersions();
    });

    socket.on("import.failed", (payload: { message: string }) => {
      setUploading(false);
      setProgress(`Failed: ${payload.message}`);
    });

    return () => {
      socket.off("import.progress");
      socket.off("import.completed");
      socket.off("import.failed");
    };
  }, [token]);

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    if (!token) {
      return;
    }

    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    setProgress("Queued");

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE_URL}/imports/schedules`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      setUploading(false);
      setProgress(`Failed: ${await response.text()}`);
      return;
    }

    const data = (await response.json()) as { importJobId: string };
    const socket = getSocket(token);
    socket.emit("subscribe.import", { importJobId: data.importJobId });
  }

  async function activate(versionId: string) {
    if (!token) {
      return;
    }

    await apiFetch(`/schedule-versions/${versionId}/activate`, {
      method: "POST",
      token
    });

    await loadVersions();
  }

  return (
    <section>
      <h3>Imports and Validation</h3>
      <p className="subtitle">Upload XLSX, validate draft, then activate the version.</p>

      <label className="file-upload">
        Upload Schedule Workbook
        <input type="file" accept=".xlsx" onChange={upload} disabled={uploading} />
      </label>
      <p>Job State: {progress}</p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>File</th>
              <th>Status</th>
              <th>Weekly</th>
              <th>Exceptions</th>
              <th>Conflicts</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((version) => (
              <tr key={version.id}>
                <td>{version.sourceFileName}</td>
                <td>{version.status}</td>
                <td>{version._count.weeklySessions}</td>
                <td>{version._count.exceptionSessions}</td>
                <td>{version._count.conflicts}</td>
                <td>
                  {version.status === "validated" ? (
                    <button onClick={() => activate(version.id)}>Activate</button>
                  ) : (
                    <span>-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
