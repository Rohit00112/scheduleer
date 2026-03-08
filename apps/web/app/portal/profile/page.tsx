"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../components/auth-context";
import { apiFetch } from "../../../lib/api";

interface ProfileData {
  id: string;
  email: string;
  role: string;
  displayName: string;
  lecturerAliases: string[];
  preferredWorkspace: string | null;
  timezone: string;
  mappings: Array<{
    id: string;
    lecturerId: string;
    lecturerName: string;
    isPrimary: boolean;
  }>;
}

export default function PortalProfilePage() {
  const { token } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    apiFetch<ProfileData>("/portal/profile", { token }).then(setProfile);
  }, [token]);

  return (
    <section>
      <h3>Profile</h3>
      {profile ? (
        <div className="panel-list">
          <article>
            <p>
              <strong>{profile.displayName}</strong>
            </p>
            <p>{profile.email}</p>
            <p>{profile.role}</p>
            <p>Timezone: {profile.timezone}</p>
          </article>

          <article>
            <h4>Lecturer Aliases</h4>
            <p>{profile.lecturerAliases.length > 0 ? profile.lecturerAliases.join(", ") : "None"}</p>
          </article>

          <article>
            <h4>Mapped Lecturers</h4>
            {profile.mappings.length === 0 ? <p>No explicit mappings.</p> : null}
            {profile.mappings.map((mapping) => (
              <p key={mapping.id}>
                {mapping.lecturerName} {mapping.isPrimary ? "(Primary)" : ""}
              </p>
            ))}
          </article>
        </div>
      ) : (
        <p className="loading">Loading profile...</p>
      )}
    </section>
  );
}
