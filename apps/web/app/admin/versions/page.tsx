"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../components/auth-context";
import { apiFetch } from "../../../lib/api";

interface VersionItem {
  id: string;
  sourceFileName: string;
  status: string;
  createdAt: string;
  activatedAt: string | null;
  _count: {
    weeklySessions: number;
    exceptionSessions: number;
    conflicts: number;
  };
}

interface IssueItem {
  id: string;
  type: string;
  severity: string;
  entityKey: string;
  detailsJson: { message?: string } | null;
}

export default function AdminVersionsPage() {
  const { token } = useAuth();
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [issues, setIssues] = useState<IssueItem[]>([]);

  async function loadVersions() {
    if (!token) {
      return;
    }

    const data = await apiFetch<VersionItem[]>("/schedule-versions", { token });
    setVersions(data);

    if (data[0] && !selectedVersion) {
      setSelectedVersion(data[0].id);
    }
  }

  async function loadIssues(versionId: string) {
    if (!token || !versionId) {
      return;
    }

    const data = await apiFetch<IssueItem[]>(`/schedule-versions/${versionId}/issues`, { token });
    setIssues(data);
  }

  useEffect(() => {
    loadVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (selectedVersion) {
      loadIssues(selectedVersion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVersion, token]);

  return (
    <section>
      <h3>Version Control</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Version</th>
              <th>File</th>
              <th>Status</th>
              <th>Weekly</th>
              <th>Exceptions</th>
              <th>Conflicts</th>
              <th>Activated</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((version) => (
              <tr
                key={version.id}
                className={selectedVersion === version.id ? "active-row" : ""}
                onClick={() => setSelectedVersion(version.id)}
              >
                <td>{version.id.slice(0, 8)}</td>
                <td>{version.sourceFileName}</td>
                <td>{version.status}</td>
                <td>{version._count.weeklySessions}</td>
                <td>{version._count.exceptionSessions}</td>
                <td>{version._count.conflicts}</td>
                <td>{version.activatedAt ? new Date(version.activatedAt).toLocaleString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="section-gap">
        <h3>Selected Version Issues</h3>
        <div className="panel-list">
          {issues.map((issue) => (
            <article key={issue.id}>
              <header>
                <strong>{issue.type}</strong>
                <span>{issue.severity}</span>
              </header>
              <p>{issue.detailsJson?.message ?? issue.entityKey}</p>
            </article>
          ))}
          {issues.length === 0 ? <p>No issues.</p> : null}
        </div>
      </section>
    </section>
  );
}
