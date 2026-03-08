"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../../../components/auth-context";
import { apiFetch } from "../../../lib/api";

interface UserItem {
  id: string;
  email: string;
  role: "admin" | "staff" | "viewer";
  displayName: string;
  lecturerAliases: string[];
  preferredWorkspace: string | null;
  timezone: string | null;
  active: boolean;
}

export default function AdminUsersPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "staff" | "viewer">("viewer");
  const [preferredWorkspace, setPreferredWorkspace] = useState<"admin" | "portal">("portal");
  const [timezone, setTimezone] = useState("Asia/Kathmandu");

  async function loadUsers() {
    if (!token) {
      return;
    }

    const data = await apiFetch<UserItem[]>("/users", { token });
    setUsers(data);
  }

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token) {
      return;
    }

    await apiFetch("/users", {
      method: "POST",
      token,
      body: JSON.stringify({
        displayName,
        email,
        password,
        role,
        preferredWorkspace,
        timezone
      })
    });

    setDisplayName("");
    setEmail("");
    setPassword("");
    setRole("viewer");
    setPreferredWorkspace("portal");
    setTimezone("Asia/Kathmandu");

    await loadUsers();
  }

  return (
    <section>
      <h3>User Administration</h3>
      <form className="form-grid" onSubmit={onSubmit}>
        <label>
          Display Name
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
        </label>

        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <label>
          Role
          <select value={role} onChange={(event) => setRole(event.target.value as "admin" | "staff" | "viewer") }>
            <option value="admin">admin</option>
            <option value="staff">staff</option>
            <option value="viewer">viewer</option>
          </select>
        </label>

        <label>
          Preferred Workspace
          <select
            value={preferredWorkspace}
            onChange={(event) => setPreferredWorkspace(event.target.value as "admin" | "portal")}
          >
            <option value="admin">admin</option>
            <option value="portal">portal</option>
          </select>
        </label>

        <label>
          Timezone
          <input value={timezone} onChange={(event) => setTimezone(event.target.value)} />
        </label>

        <button type="submit">Create User</button>
      </form>

      <section className="section-gap">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Workspace</th>
                <th>Timezone</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.displayName}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{user.preferredWorkspace ?? "-"}</td>
                  <td>{user.timezone ?? "-"}</td>
                  <td>{user.active ? "active" : "inactive"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
