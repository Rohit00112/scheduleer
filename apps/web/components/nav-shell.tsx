"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./auth-context";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/my-schedule", label: "My Schedule" },
  { href: "/rooms", label: "Rooms" },
  { href: "/imports", label: "Imports" },
  { href: "/conflicts", label: "Conflicts" },
  { href: "/admin/users", label: "Users" }
];

export function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const visibleLinks = links.filter((link) => {
    if (link.href.startsWith("/admin") && user?.role !== "admin") {
      return false;
    }
    return true;
  });

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <h1>Schedule Hub</h1>
          <p className="subtitle">Realtime timetable operations</p>
        </div>
        {user ? (
          <div className="userbox">
            <span>
              {user.displayName} <em>{user.role}</em>
            </span>
            <button onClick={logout}>Logout</button>
          </div>
        ) : null}
      </header>
      <nav className="navgrid">
        {visibleLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={pathname === link.href ? "active" : ""}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <main className="content">{children}</main>
    </div>
  );
}
