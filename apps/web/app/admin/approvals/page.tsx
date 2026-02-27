"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { useAuth } from "../../../components/auth-context";
import { getSocket } from "../../../components/socket";

interface ApprovalItem {
  id: string;
  stepOrder: number;
  status: "pending" | "approved" | "rejected";
  decisionNote: string | null;
  decidedAt: string | null;
  approverUserId: string;
  approverUser: {
    id: string;
    displayName: string;
    email: string;
    role: "admin" | "staff" | "viewer";
  };
  flow: {
    id: string;
    status: "pending" | "approved" | "rejected";
    request: {
      id: string;
      type: "schedule_change" | "room_booking";
      title: string;
      description: string | null;
      status: "draft" | "submitted" | "pending_approval" | "approved" | "rejected" | "blocked";
      requestedById: string;
      requestedBy: {
        id: string;
        displayName: string;
        email: string;
      };
      impactSnapshots: Array<{
        id: string;
        riskScore: number;
        blockingIssues: number;
        warningIssues: number;
        impactSummaryJson: Record<string, unknown>;
      }>;
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
    };
  };
}

function toLabel(value: string): string {
  return value
    .split("_")
    .map((entry) => `${entry[0]?.toUpperCase() ?? ""}${entry.slice(1)}`)
    .join(" ");
}

export default function AdminApprovalsPage() {
  const { token } = useAuth();
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [loading, setLoading] = useState(false);

  const loadApprovals = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    const data = await apiFetch<ApprovalItem[]>(`/admin/approvals?status=${filter}`, { token });
    setApprovals(data);
    setActiveId((previous) => previous ?? data[0]?.id ?? null);
    setLoading(false);
  }, [token, filter]);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const socket = getSocket(token);
    socket.emit("subscribe.governance");

    const refresh = () => {
      loadApprovals();
    };

    socket.on("approval.pending", refresh);
    socket.on("approval.decided", refresh);
    socket.on("policy.violation", refresh);

    return () => {
      socket.off("approval.pending", refresh);
      socket.off("approval.decided", refresh);
      socket.off("policy.violation", refresh);
    };
  }, [token, loadApprovals]);

  const activeApproval = useMemo(
    () => approvals.find((item) => item.id === activeId) ?? null,
    [approvals, activeId]
  );

  const decide = useCallback(
    async (decision: "approve" | "reject") => {
      if (!token || !activeApproval) {
        return;
      }

      await apiFetch(`/admin/approvals/${activeApproval.id}/${decision}`, {
        token,
        method: "POST",
        body: JSON.stringify({ note: decisionNote || undefined })
      });

      setDecisionNote("");
      await loadApprovals();
    },
    [token, activeApproval, decisionNote, loadApprovals]
  );

  return (
    <section>
      <h3>Approval Queue</h3>
      <p className="subtitle">Review impact, policy traces, and decide governed changes with a clear audit trail.</p>

      <div className="controls">
        <label>
          Filter
          <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
        <button type="button" onClick={loadApprovals} aria-label="Refresh approval queue">
          Refresh
        </button>
      </div>

      <section className="governance-layout">
        <article className="governance-table-card">
          <header className="governance-card-header">
            <h4>Approval Steps</h4>
            <span>{approvals.length} items</span>
          </header>

          <div className="table-wrap">
            <table aria-label="Approval steps table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Type</th>
                  <th>Step</th>
                  <th>Status</th>
                  <th>Approver</th>
                </tr>
              </thead>
              <tbody>
                {approvals.map((item) => (
                  <tr
                    key={item.id}
                    tabIndex={0}
                    className={item.id === activeApproval?.id ? "active-row" : ""}
                    onClick={() => setActiveId(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setActiveId(item.id);
                      }
                    }}
                    aria-label={`Approval step for ${item.flow.request.title}`}
                  >
                    <td>{item.flow.request.title}</td>
                    <td>{toLabel(item.flow.request.type)}</td>
                    <td>{item.stepOrder}</td>
                    <td>
                      <span className={`status-badge status-${item.status === "pending" ? "warn" : item.status === "approved" ? "good" : "bad"}`}>
                        {toLabel(item.status)}
                      </span>
                    </td>
                    <td>{item.approverUser.displayName}</td>
                  </tr>
                ))}
                {approvals.length === 0 ? (
                  <tr>
                    <td colSpan={5}>{loading ? "Loading approvals..." : "No approval steps found."}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <article className="governance-detail-card">
          <header className="governance-card-header">
            <h4>Approval Action Panel</h4>
          </header>

          {!activeApproval ? <p>Select an approval item to continue.</p> : null}

          {activeApproval ? (
            <div className="detail-stack">
              <div>
                <p className="kicker">{toLabel(activeApproval.flow.request.type)}</p>
                <h4>{activeApproval.flow.request.title}</h4>
                <p>{activeApproval.flow.request.description ?? "No request description."}</p>
              </div>

              <div className="kpi-grid">
                <article>
                  <h4>Status</h4>
                  <p>{toLabel(activeApproval.status)}</p>
                </article>
                <article>
                  <h4>Risk</h4>
                  <p>{activeApproval.flow.request.impactSnapshots[0]?.riskScore ?? 0}</p>
                </article>
                <article>
                  <h4>Blocking</h4>
                  <p>{activeApproval.flow.request.impactSnapshots[0]?.blockingIssues ?? 0}</p>
                </article>
                <article>
                  <h4>Warnings</h4>
                  <p>{activeApproval.flow.request.impactSnapshots[0]?.warningIssues ?? 0}</p>
                </article>
              </div>

              <label>
                Decision Note
                <textarea
                  value={decisionNote}
                  onChange={(event) => setDecisionNote(event.target.value)}
                  rows={3}
                  aria-label="Decision note"
                />
              </label>

              <div className="inline-actions">
                <button
                  type="button"
                  onClick={() => decide("approve")}
                  disabled={activeApproval.status !== "pending"}
                  aria-label="Approve selected request"
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="button-danger"
                  onClick={() => decide("reject")}
                  disabled={activeApproval.status !== "pending"}
                  aria-label="Reject selected request"
                >
                  Reject
                </button>
              </div>

              <div>
                <h4>Policy Explanations</h4>
                <div className="panel-list">
                  {activeApproval.flow.request.policyEvaluations.length === 0 ? (
                    <article>No policy logs found for this request yet.</article>
                  ) : null}

                  {activeApproval.flow.request.policyEvaluations.map((entry) => (
                    <article key={entry.id}>
                      <header>
                        <strong>{entry.policy?.name ?? "Unknown policy"}</strong>
                        <span className={entry.allowed ? "ok" : "error"}>{entry.allowed ? "Allowed" : "Denied"}</span>
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
