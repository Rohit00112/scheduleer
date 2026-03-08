"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./auth-context";

const PORTAL_LINKS = [
  { href: "/portal/my-week", label: "My Week" },
  { href: "/portal/today", label: "Today" },
  { href: "/portal/rooms", label: "Rooms" },
  { href: "/portal/notifications", label: "Notifications" },
  { href: "/portal/calendar", label: "Calendar" },
  { href: "/portal/profile", label: "Profile" }
];

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div className="workspace workspace-portal">
      <aside className="workspace-sidebar">
        <div className="brand">
          <h1>Schedule Hub</h1>
          <p>Lecturer Workspace</p>
        </div>

        <nav className="workspace-nav">
          {PORTAL_LINKS.map((link) => (
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
            <p className="kicker">Personal Ops</p>
            <h2>{user?.displayName}</h2>
          </div>

          <div className="workspace-user">
            <span>{user?.role}</span>
            <small>{user?.timezone ?? "Asia/Kathmandu"}</small>
            <button onClick={logout}>Logout</button>
          </div>
        </header>

        <main className="workspace-content">{children}</main>
      </section>
    </div>
  );
}
