"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../../../components/auth-context";
import { apiFetch } from "../../../lib/api";

interface MappingItem {
  id: string;
  isPrimary: boolean;
  user: {
    id: string;
    displayName: string;
    email: string;
    role: string;
  };
  lecturer: {
    id: string;
    name: string;
  };
}

interface MappingOptions {
  users: Array<{ id: string; displayName: string; email: string }>;
  lecturers: Array<{ id: string; name: string }>;
}

export default function AdminMappingsPage() {
  const { token } = useAuth();
  const [mappings, setMappings] = useState<MappingItem[]>([]);
  const [options, setOptions] = useState<MappingOptions>({ users: [], lecturers: [] });
  const [userId, setUserId] = useState("");
  const [lecturerId, setLecturerId] = useState("");
  const [isPrimary, setIsPrimary] = useState(true);

  async function load() {
    if (!token) {
      return;
    }

    const [mappingItems, mappingOptions] = await Promise.all([
      apiFetch<MappingItem[]>("/admin/mappings", { token }),
      apiFetch<MappingOptions>("/admin/mappings/options", { token })
    ]);

    setMappings(mappingItems);
    setOptions(mappingOptions);

    if (!userId && mappingOptions.users[0]) {
      setUserId(mappingOptions.users[0].id);
    }

    if (!lecturerId && mappingOptions.lecturers[0]) {
      setLecturerId(mappingOptions.lecturers[0].id);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function createMapping(event: FormEvent) {
    event.preventDefault();
    if (!token || !userId || !lecturerId) {
      return;
    }

    await apiFetch("/admin/mappings", {
      method: "POST",
      token,
      body: JSON.stringify({
        userId,
        lecturerId,
        isPrimary
      })
    });

    await load();
  }

  async function removeMapping(mappingId: string) {
    if (!token) {
      return;
    }

    await apiFetch(`/admin/mappings/${mappingId}`, {
      method: "DELETE",
      token
    });

    await load();
  }

  return (
    <section>
      <h3>User-Lecturer Mapping</h3>
      <form className="controls" onSubmit={createMapping}>
        <label>
          User
          <select value={userId} onChange={(event) => setUserId(event.target.value)}>
            {options.users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName} ({user.email})
              </option>
            ))}
          </select>
        </label>

        <label>
          Lecturer
          <select value={lecturerId} onChange={(event) => setLecturerId(event.target.value)}>
            {options.lecturers.map((lecturer) => (
              <option key={lecturer.id} value={lecturer.id}>
                {lecturer.name}
              </option>
            ))}
          </select>
        </label>

        <label className="inline-check">
          <input type="checkbox" checked={isPrimary} onChange={(event) => setIsPrimary(event.target.checked)} />
          Primary
        </label>

        <button type="submit">Add Mapping</button>
      </form>

      <div className="table-wrap section-gap">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Lecturer</th>
              <th>Primary</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((mapping) => (
              <tr key={mapping.id}>
                <td>
                  {mapping.user.displayName} ({mapping.user.role})
                </td>
                <td>{mapping.lecturer.name}</td>
                <td>{mapping.isPrimary ? "Yes" : "No"}</td>
                <td>
                  <button onClick={() => removeMapping(mapping.id)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
