"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { useAuth } from "../../../components/auth-context";

interface PolicyItem {
  id: string;
  name: string;
  description: string | null;
  target: "request_create" | "request_submit" | "approval_decide";
  effect: "allow" | "deny";
  enabled: boolean;
  active: boolean;
  priority: number;
  conditionsJson: Record<string, unknown>;
  createdAt: string;
  createdBy: {
    id: string;
    displayName: string;
    email: string;
  } | null;
  _count: {
    evaluations: number;
  };
}

interface SimulationResult {
  policyId: string;
  policyName: string;
  target: string;
  allowed: boolean;
  reasons: string[];
  decisions: Array<{
    policyId: string;
    policyName: string;
    effect: string;
    matched: boolean;
    allowed: boolean;
    reason: string;
  }>;
}

function toLabel(value: string): string {
  return value
    .split("_")
    .map((entry) => `${entry[0]?.toUpperCase() ?? ""}${entry.slice(1)}`)
    .join(" ");
}

export default function AdminPoliciesPage() {
  const { token } = useAuth();
  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState<PolicyItem["target"]>("request_submit");
  const [priority, setPriority] = useState(100);
  const [effect, setEffect] = useState<PolicyItem["effect"]>("deny");
  const [maxRiskScore, setMaxRiskScore] = useState(70);
  const [maxBlockingIssues, setMaxBlockingIssues] = useState(0);

  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [simRequestType, setSimRequestType] = useState<"schedule_change" | "room_booking">("schedule_change");
  const [simRiskScore, setSimRiskScore] = useState(50);
  const [simBlocking, setSimBlocking] = useState(0);
  const [simWarning, setSimWarning] = useState(0);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);

  const loadPolicies = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    const data = await apiFetch<PolicyItem[]>("/admin/policies", { token });
    setPolicies(data);
    setSelectedPolicyId((previous) => previous ?? data[0]?.id ?? null);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    loadPolicies();
  }, [loadPolicies]);

  const selectedPolicy = useMemo(
    () => policies.find((item) => item.id === selectedPolicyId) ?? null,
    [policies, selectedPolicyId]
  );

  const createPolicy = useCallback(async () => {
    if (!token || !name.trim()) {
      return;
    }

    await apiFetch("/admin/policies", {
      token,
      method: "POST",
      body: JSON.stringify({
        name,
        description: description || undefined,
        target,
        effect,
        priority,
        conditionsJson: {
          maxRiskScore,
          maxBlockingIssues
        },
        enabled: true,
        active: false
      })
    });

    setName("");
    setDescription("");
    await loadPolicies();
  }, [token, name, description, target, effect, priority, maxRiskScore, maxBlockingIssues, loadPolicies]);

  const activatePolicy = useCallback(
    async (policyId: string) => {
      if (!token) {
        return;
      }

      await apiFetch(`/admin/policies/${policyId}/activate`, {
        token,
        method: "POST"
      });

      await loadPolicies();
    },
    [token, loadPolicies]
  );

  const simulatePolicy = useCallback(async () => {
    if (!token || !selectedPolicyId) {
      return;
    }

    const result = await apiFetch<SimulationResult>(`/admin/policies/${selectedPolicyId}/simulate`, {
      token,
      method: "POST",
      body: JSON.stringify({
        requestType: simRequestType,
        riskScore: simRiskScore,
        blockingIssues: simBlocking,
        warningIssues: simWarning,
        actorRole: "admin"
      })
    });

    setSimResult(result);
  }, [token, selectedPolicyId, simRequestType, simRiskScore, simBlocking, simWarning]);

  return (
    <section>
      <h3>Policy Studio</h3>
      <p className="subtitle">Create and activate governance rules, then simulate decisions before rolling out changes.</p>

      <section className="section-gap governance-form-panel">
        <header>
          <h4>Create Policy Rule</h4>
        </header>

        <div className="controls">
          <label>
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Description
            <input value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <label>
            Target
            <select value={target} onChange={(event) => setTarget(event.target.value as PolicyItem["target"])}>
              <option value="request_create">Request Create</option>
              <option value="request_submit">Request Submit</option>
              <option value="approval_decide">Approval Decide</option>
            </select>
          </label>
          <label>
            Effect
            <select value={effect} onChange={(event) => setEffect(event.target.value as PolicyItem["effect"])}>
              <option value="deny">Deny</option>
              <option value="allow">Allow</option>
            </select>
          </label>
          <label>
            Priority
            <input type="number" min={1} max={999} value={priority} onChange={(event) => setPriority(Number(event.target.value))} />
          </label>
          <label>
            Max Risk Score
            <input
              type="number"
              min={0}
              max={100}
              value={maxRiskScore}
              onChange={(event) => setMaxRiskScore(Number(event.target.value))}
            />
          </label>
          <label>
            Max Blocking Issues
            <input
              type="number"
              min={0}
              max={100}
              value={maxBlockingIssues}
              onChange={(event) => setMaxBlockingIssues(Number(event.target.value))}
            />
          </label>
          <button type="button" onClick={createPolicy} disabled={!name.trim()} aria-label="Create governance policy">
            Save Policy
          </button>
        </div>
      </section>

      <section className="section-gap governance-layout">
        <article className="governance-table-card">
          <header className="governance-card-header">
            <h4>Policy Registry</h4>
            <button type="button" onClick={loadPolicies} aria-label="Refresh policy list">
              Refresh
            </button>
          </header>

          <div className="table-wrap">
            <table aria-label="Policy registry table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Target</th>
                  <th>Effect</th>
                  <th>Priority</th>
                  <th>Active</th>
                  <th>Evaluations</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((policy) => (
                  <tr
                    key={policy.id}
                    tabIndex={0}
                    className={policy.id === selectedPolicy?.id ? "active-row" : ""}
                    onClick={() => setSelectedPolicyId(policy.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedPolicyId(policy.id);
                      }
                    }}
                    aria-label={`Policy ${policy.name}`}
                  >
                    <td>{policy.name}</td>
                    <td>{toLabel(policy.target)}</td>
                    <td>{toLabel(policy.effect)}</td>
                    <td>{policy.priority}</td>
                    <td>
                      <span className={`status-badge status-${policy.active ? "good" : "neutral"}`}>
                        {policy.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>{policy._count.evaluations}</td>
                  </tr>
                ))}

                {policies.length === 0 ? (
                  <tr>
                    <td colSpan={6}>{loading ? "Loading policies..." : "No policy rules yet."}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <article className="governance-detail-card">
          <header className="governance-card-header">
            <h4>Rule Simulator</h4>
            {selectedPolicy ? (
              <button type="button" onClick={() => activatePolicy(selectedPolicy.id)} aria-label="Activate selected policy">
                Activate
              </button>
            ) : null}
          </header>

          {!selectedPolicy ? <p>Select a policy to simulate.</p> : null}

          {selectedPolicy ? (
            <div className="detail-stack">
              <div>
                <p className="kicker">{toLabel(selectedPolicy.target)}</p>
                <h4>{selectedPolicy.name}</h4>
                <p>{selectedPolicy.description ?? "No description."}</p>
              </div>

              <div className="controls">
                <label>
                  Request Type
                  <select
                    value={simRequestType}
                    onChange={(event) => setSimRequestType(event.target.value as "schedule_change" | "room_booking")}
                  >
                    <option value="schedule_change">Schedule Change</option>
                    <option value="room_booking">Room Booking</option>
                  </select>
                </label>
                <label>
                  Risk Score
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={simRiskScore}
                    onChange={(event) => setSimRiskScore(Number(event.target.value))}
                  />
                </label>
                <label>
                  Blocking Issues
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={simBlocking}
                    onChange={(event) => setSimBlocking(Number(event.target.value))}
                  />
                </label>
                <label>
                  Warning Issues
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={simWarning}
                    onChange={(event) => setSimWarning(Number(event.target.value))}
                  />
                </label>
                <button type="button" onClick={simulatePolicy} aria-label="Run policy simulation">
                  Simulate
                </button>
              </div>

              <div>
                <h4>Policy Conditions</h4>
                <pre className="json-panel" aria-label="Policy conditions JSON">
                  {JSON.stringify(selectedPolicy.conditionsJson, null, 2)}
                </pre>
              </div>

              {simResult ? (
                <div>
                  <h4>Simulation Result</h4>
                  <article className="panel-list">
                    <article>
                      <header>
                        <strong>Decision</strong>
                        <span className={simResult.allowed ? "ok" : "error"}>{simResult.allowed ? "Allowed" : "Denied"}</span>
                      </header>
                      <p>{simResult.reasons.length > 0 ? simResult.reasons.join("; ") : "No denial reason."}</p>
                    </article>
                  </article>
                </div>
              ) : null}
            </div>
          ) : null}
        </article>
      </section>
    </section>
  );
}
