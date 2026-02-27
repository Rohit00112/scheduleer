"use client";

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { apiFetch } from "../../../lib/api";
import { useAuth } from "../../../components/auth-context";
import { getSocket } from "../../../components/socket";

type RequestType = "schedule_change" | "room_booking";
type RequestStatus = "draft" | "submitted" | "pending_approval" | "approved" | "rejected" | "blocked";

interface ChangeRequestItem {
  id: string;
  type: RequestType;
  status: RequestStatus;
  title: string;
  description: string | null;
  createdAt: string;
  requestedById: string;
  requestedBy: {
    id: string;
    displayName: string;
    email: string;
    role: "admin" | "staff" | "viewer";
  };
  submittedAt: string | null;
  impactSnapshots: Array<{
    id: string;
    riskScore: number;
    blockingIssues: number;
    warningIssues: number;
    impactSummaryJson: Record<string, unknown>;
    createdAt: string;
  }>;
  approvalFlow: {
    id: string;
    status: "pending" | "approved" | "rejected";
    currentStepOrder: number;
    steps: Array<{
      id: string;
      stepOrder: number;
      status: "pending" | "approved" | "rejected";
      approverUser: {
        id: string;
        displayName: string;
        email: string;
      };
    }>;
  } | null;
  policyEvaluations: Array<{
    id: string;
    allowed: boolean;
    reason: string;
    createdAt: string;
    policy: {
      id: string;
      name: string;
      target: string;
      effect: string;
    } | null;
  }>;
}

function statusTone(status: RequestStatus): "good" | "warn" | "bad" | "neutral" {
  if (status === "approved") {
    return "good";
  }

  if (status === "draft" || status === "submitted" || status === "pending_approval") {
    return "warn";
  }

  if (status === "blocked" || status === "rejected") {
    return "bad";
  }

  return "neutral";
}

function toLabel(value: string): string {
  return value
    .split("_")
    .map((entry) => `${entry[0]?.toUpperCase() ?? ""}${entry.slice(1)}`)
    .join(" ");
}

export default function AdminRequestsPage() {
  const { token } = useAuth();
  const [requests, setRequests] = useState<ChangeRequestItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formType, setFormType] = useState<RequestType>("schedule_change");

  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleDescription, setScheduleDescription] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");

  const [roomTitle, setRoomTitle] = useState("");
  const [roomDescription, setRoomDescription] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomDate, setRoomDate] = useState(new Date().toISOString().slice(0, 10));
  const [startMinute, setStartMinute] = useState(480);
  const [endMinute, setEndMinute] = useState(570);
  const [purpose, setPurpose] = useState("");

  const loadRequests = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<ChangeRequestItem[]>("/admin/requests", { token });
      setRequests(data);
      setActiveId((previous) => previous ?? data[0]?.id ?? null);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const socket = getSocket(token);
    socket.emit("subscribe.governance");

    const refresh = () => {
      loadRequests();
    };

    socket.on("request.created", refresh);
    socket.on("request.submitted", refresh);
    socket.on("approval.pending", refresh);
    socket.on("approval.decided", refresh);
    socket.on("policy.violation", refresh);

    return () => {
      socket.off("request.created", refresh);
      socket.off("request.submitted", refresh);
      socket.off("approval.pending", refresh);
      socket.off("approval.decided", refresh);
      socket.off("policy.violation", refresh);
    };
  }, [token, loadRequests]);

  const selected = useMemo(
    () => requests.find((item) => item.id === activeId) ?? null,
    [requests, activeId]
  );

  const createScheduleRequest = useCallback(async () => {
    if (!token) {
      return;
    }

    await apiFetch("/admin/requests/schedule-change", {
      token,
      method: "POST",
      body: JSON.stringify({
        title: scheduleTitle,
        description: scheduleDescription || undefined,
        effectiveDate: effectiveDate || undefined,
        changeItems: []
      })
    });

    setScheduleTitle("");
    setScheduleDescription("");
    setEffectiveDate("");
    await loadRequests();
  }, [token, scheduleTitle, scheduleDescription, effectiveDate, loadRequests]);

  const createRoomRequest = useCallback(async () => {
    if (!token) {
      return;
    }

    await apiFetch("/admin/requests/room-booking", {
      token,
      method: "POST",
      body: JSON.stringify({
        title: roomTitle,
        description: roomDescription || undefined,
        roomName,
        date: roomDate,
        startMinute,
        endMinute,
        purpose: purpose || undefined
      })
    });

    setRoomTitle("");
    setRoomDescription("");
    setRoomName("");
    setPurpose("");
    await loadRequests();
  }, [token, roomTitle, roomDescription, roomName, roomDate, startMinute, endMinute, purpose, loadRequests]);

  const submitRequest = useCallback(async () => {
    if (!token || !selected) {
      return;
    }

    await apiFetch(`/admin/requests/${selected.id}/submit`, {
      token,
      method: "POST",
      body: JSON.stringify({ note: "Submitted from admin request board" })
    });

    await loadRequests();
  }, [token, selected, loadRequests]);

  const onRowKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTableRowElement>, index: number, id: string) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setActiveId(id);
        return;
      }

      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
        return;
      }

      event.preventDefault();
      const nextIndex = event.key === "ArrowDown" ? Math.min(index + 1, requests.length - 1) : Math.max(index - 1, 0);
      const nextRow = document.querySelector<HTMLTableRowElement>(`tr[data-request-row=\"${nextIndex}\"]`);
      nextRow?.focus();
      setActiveId(requests[nextIndex]?.id ?? id);
    },
    [requests]
  );

  return (
    <section>
      <h3>Governed Change Requests</h3>
      <p className="subtitle">Create schedule and room changes, inspect impact, and submit through approval flow.</p>

      <section className="section-gap governance-form-panel">
        <header>
          <h4>New Request</h4>
          <div className="segmented">
            <button
              type="button"
              className={formType === "schedule_change" ? "active" : ""}
              onClick={() => setFormType("schedule_change")}
              aria-label="Switch to schedule change request form"
            >
              Schedule Change
            </button>
            <button
              type="button"
              className={formType === "room_booking" ? "active" : ""}
              onClick={() => setFormType("room_booking")}
              aria-label="Switch to room booking request form"
            >
              Room Booking
            </button>
          </div>
        </header>

        {formType === "schedule_change" ? (
          <div className="controls">
            <label>
              Title
              <input value={scheduleTitle} onChange={(event) => setScheduleTitle(event.target.value)} />
            </label>
            <label>
              Description
              <input value={scheduleDescription} onChange={(event) => setScheduleDescription(event.target.value)} />
            </label>
            <label>
              Effective Date
              <input type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} />
            </label>
            <button
              type="button"
              onClick={createScheduleRequest}
              disabled={!scheduleTitle.trim()}
              aria-label="Create schedule change request"
            >
              Create Schedule Request
            </button>
          </div>
        ) : (
          <div className="controls">
            <label>
              Title
              <input value={roomTitle} onChange={(event) => setRoomTitle(event.target.value)} />
            </label>
            <label>
              Description
              <input value={roomDescription} onChange={(event) => setRoomDescription(event.target.value)} />
            </label>
            <label>
              Room
              <input value={roomName} onChange={(event) => setRoomName(event.target.value)} />
            </label>
            <label>
              Date
              <input type="date" value={roomDate} onChange={(event) => setRoomDate(event.target.value)} />
            </label>
            <label>
              Start Minute
              <input
                type="number"
                min={0}
                max={1439}
                value={startMinute}
                onChange={(event) => setStartMinute(Number(event.target.value))}
              />
            </label>
            <label>
              End Minute
              <input
                type="number"
                min={1}
                max={1440}
                value={endMinute}
                onChange={(event) => setEndMinute(Number(event.target.value))}
              />
            </label>
            <label>
              Purpose
              <input value={purpose} onChange={(event) => setPurpose(event.target.value)} />
            </label>
            <button
              type="button"
              onClick={createRoomRequest}
              disabled={!roomTitle.trim() || !roomName.trim()}
              aria-label="Create room booking request"
            >
              Create Room Request
            </button>
          </div>
        )}
      </section>

      <section className="section-gap governance-layout">
        <article className="governance-table-card">
          <header className="governance-card-header">
            <h4>Request Queue</h4>
            <button type="button" onClick={loadRequests} aria-label="Refresh change requests">
              Refresh
            </button>
          </header>

          <div className="table-wrap">
            <table aria-label="Governed change request table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Risk</th>
                  <th>Owner</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((item, index) => {
                  const latestImpact = item.impactSnapshots[0];
                  return (
                    <tr
                      key={item.id}
                      tabIndex={0}
                      data-request-row={index}
                      className={item.id === selected?.id ? "active-row" : ""}
                      onClick={() => setActiveId(item.id)}
                      onKeyDown={(event) => onRowKeyDown(event, index, item.id)}
                      aria-label={`Request ${item.title}`}
                    >
                      <td>{item.title}</td>
                      <td>{toLabel(item.type)}</td>
                      <td>
                        <span className={`status-badge status-${statusTone(item.status)}`} aria-label={`Status ${item.status}`}>
                          {toLabel(item.status)}
                        </span>
                      </td>
                      <td>{latestImpact ? latestImpact.riskScore : "-"}</td>
                      <td>{item.requestedBy.displayName}</td>
                      <td>{new Date(item.createdAt).toLocaleString()}</td>
                    </tr>
                  );
                })}

                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={6}>{loading ? "Loading requests..." : "No requests yet."}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {error ? <p className="error">{error}</p> : null}
        </article>

        <article className="governance-detail-card">
          <header className="governance-card-header">
            <h4>Request Detail</h4>
            {selected?.status === "draft" ? (
              <button type="button" onClick={submitRequest} aria-label="Submit selected request for approval">
                Submit for Approval
              </button>
            ) : null}
          </header>

          {!selected ? <p>Select a request to inspect impact and policy traces.</p> : null}

          {selected ? (
            <div className="detail-stack">
              <div>
                <p className="kicker">{toLabel(selected.type)}</p>
                <h4>{selected.title}</h4>
                <p>{selected.description ?? "No description provided."}</p>
              </div>

              <div className="kpi-grid">
                <article>
                  <h4>Status</h4>
                  <p>{toLabel(selected.status)}</p>
                </article>
                <article>
                  <h4>Risk</h4>
                  <p>{selected.impactSnapshots[0]?.riskScore ?? 0}</p>
                </article>
                <article>
                  <h4>Blocking</h4>
                  <p>{selected.impactSnapshots[0]?.blockingIssues ?? 0}</p>
                </article>
                <article>
                  <h4>Warnings</h4>
                  <p>{selected.impactSnapshots[0]?.warningIssues ?? 0}</p>
                </article>
              </div>

              <div>
                <h4>Impact Summary</h4>
                <pre className="json-panel" aria-label="Impact summary JSON">
                  {JSON.stringify(selected.impactSnapshots[0]?.impactSummaryJson ?? {}, null, 2)}
                </pre>
              </div>

              <div>
                <h4>Policy Trace</h4>
                <div className="panel-list">
                  {selected.policyEvaluations.length === 0 ? <article>No policy evaluations yet.</article> : null}
                  {selected.policyEvaluations.map((entry) => (
                    <article key={entry.id}>
                      <header>
                        <strong>{entry.policy?.name ?? "Unknown policy"}</strong>
                        <span className={entry.allowed ? "ok" : "error"} aria-label={entry.allowed ? "Allowed" : "Denied"}>
                          {entry.allowed ? "Allowed" : "Denied"}
                        </span>
                      </header>
                      <p>{entry.reason}</p>
                      <small>{new Date(entry.createdAt).toLocaleString()}</small>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </article>
      </section>
    </section>
  );
}
