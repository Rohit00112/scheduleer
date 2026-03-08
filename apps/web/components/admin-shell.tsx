"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./auth-context";

const ADMIN_LINKS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/board", label: "Weekly Board" },
  { href: "/admin/imports", label: "Imports" },
  { href: "/admin/versions", label: "Versions" },
  { href: "/admin/conflicts", label: "Conflicts" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/mappings", label: "Mappings" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/notifications", label: "Alerts" }
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div className="workspace workspace-admin">
      <aside className="workspace-sidebar">
        <div className="brand">
          <h1>Schedule Hub</h1>
          <p>Admin Command Center</p>
        </div>

        <nav className="workspace-nav">
          {ADMIN_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href ? "active" : ""}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>

      <section className="workspace-main">
        <header className="workspace-header">
          <div>
            <p className="kicker">Operations</p>
            <h2>Admin Workspace</h2>
          </div>

          <div className="workspace-user">
            <span>{user?.displayName}</span>
            <small>{user?.email}</small>
            <button onClick={logout}>Logout</button>
          </div>
        </header>

        <main className="workspace-content">{children}</main>
      </section>
    </div>
  );
}
