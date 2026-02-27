"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../components/auth-context";
import { ApiError, apiFetch } from "../../../lib/api";

interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  channelInApp: boolean;
  channelEmail: boolean;
}

export default function AdminNotificationsPage() {
  const { token } = useAuth();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [message, setMessage] = useState<string>("");

  async function loadRules() {
    if (!token) {
      return;
    }

    const data = await apiFetch<AlertRule[]>("/admin/notifications/rules", { token });
    setRules(data);
  }

  useEffect(() => {
    loadRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function updateRule(rule: AlertRule, field: "enabled" | "channelInApp" | "channelEmail", value: boolean) {
    if (!token) {
      return;
    }

    await apiFetch(`/admin/notifications/rules/${rule.id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({
        [field]: value
      })
    });

    await loadRules();
  }

  async function sendTestEmail() {
    if (!token) {
      return;
    }

    try {
      await apiFetch("/alerts/test-email", {
        method: "POST",
        token
      });
      setMessage("Test email notification queued.");
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(`Unable to send test email: ${JSON.stringify(error.data)}`);
        return;
      }
      setMessage("Unable to send test email.");
    }
  }

  return (
    <section>
      <h3>Alerts and Notifications</h3>
      <button onClick={sendTestEmail}>Send Test Email</button>
      {message ? <p>{message}</p> : null}

      <div className="table-wrap section-gap">
        <table>
          <thead>
            <tr>
              <th>Rule</th>
              <th>Enabled</th>
              <th>In-App</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td>{rule.name}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(event) => updateRule(rule, "enabled", event.target.checked)}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={rule.channelInApp}
                    onChange={(event) => updateRule(rule, "channelInApp", event.target.checked)}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={rule.channelEmail}
                    onChange={(event) => updateRule(rule, "channelEmail", event.target.checked)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
