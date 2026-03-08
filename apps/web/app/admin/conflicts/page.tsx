"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../components/auth-context";
import { apiFetch } from "../../../lib/api";

interface ConflictItem {
  id: string;
  type: string;
  severity: string;
  entityKey: string;
  detailsJson: {
    message?: string;
  } | null;
  sourceSheet: string | null;
  sourceRow: number | null;
}

export default function AdminConflictsPage() {
  const { token } = useAuth();
  const [severity, setSeverity] = useState("");
  const [type, setType] = useState("");
  const [items, setItems] = useState<ConflictItem[]>([]);

  async function load() {
    if (!token) {
      return;
    }

    const params = new URLSearchParams();
    if (severity) {
      params.set("severity", severity);
    }
    if (type) {
      params.set("type", type);
    }

    const data = await apiFetch<ConflictItem[]>(`/conflicts?${params.toString()}`, { token });
    setItems(data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <section>
      <h3>Conflict Center</h3>
      <div className="controls">
        <label>
          Severity
          <select value={severity} onChange={(event) => setSeverity(event.target.value)}>
            <option value="">All</option>
            <option value="error">Error</option>
            <option value="warning">Warning</option>
          </select>
        </label>

        <label>
          Type
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">All</option>
            <option value="room">Room</option>
            <option value="lecturer">Lecturer</option>
            <option value="group">Group</option>
            <option value="invalid">Invalid</option>
          </select>
        </label>

        <button onClick={load}>Apply</button>
      </div>

      <div className="panel-list">
        {items.map((item) => (
          <article key={item.id}>
            <header>
              <strong>{item.type}</strong>
              <span className={item.severity === "error" ? "warn" : "ok"}>{item.severity}</span>
            </header>
            <p>{item.detailsJson?.message ?? item.entityKey}</p>
            <small>
              Source: {item.sourceSheet ?? "N/A"} {item.sourceRow ? `row ${item.sourceRow}` : ""}
            </small>
          </article>
        ))}
        {items.length === 0 ? <p>No conflicts found.</p> : null}
      </div>
    </section>
  );
}
