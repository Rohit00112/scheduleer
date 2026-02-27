"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/auth-context";
import { workspaceHome } from "../../lib/workspace";

export default function LoginPage() {
  const router = useRouter();
  const { login, token, user } = useAuth();

  const [email, setEmail] = useState("admin@schedule.local");
  const [password, setPassword] = useState("admin12345");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token && user) {
      router.replace(workspaceHome(user));
    }
  }, [token, user, router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      router.replace("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="login-wrap">
      <div className="login-card">
        <h1>Schedule Hub</h1>
        <p>Sign in to enter your Admin or Lecturer workspace.</p>
        <form onSubmit={onSubmit} className="form-grid">
          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </label>
          <label>
            Password
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </section>
  );
}
