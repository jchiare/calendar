import Link from "next/link";
import type { ReactNode } from "react";

const links = [
  { href: "/dashboard", label: "Overview", icon: "⌂" },
  { href: "/calendar", label: "Calendar", icon: "□" },
  { href: "/clients", label: "Clients", icon: "◎" },
  { href: "/sessions/demo", label: "Session notes", icon: "≡" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export function AppShell({
  title,
  eyebrow,
  action,
  children,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="app-frame">
      <aside className="app-nav">
        <Link className="brand simple" href="/dashboard">
          <span className="brand-mark">s</span>
          <span>sayso</span>
        </Link>
        <div className="workspace compact">
          <div className="clinic-icon">BP</div>
          <div>
            <strong>Bright Path</strong>
            <small>Speech Therapy</small>
          </div>
        </div>
        <nav>
          {links.map((link) => (
            <Link href={link.href} key={link.href}>
              <span>{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="app-person">
          <span>AJ</span>
          <div>
            <strong>Alex Johnson</strong>
            <small>Therapist</small>
          </div>
        </div>
      </aside>
      <main className="app-main">
        <header className="app-top">
          <label className="search-lite">
            ⌕ <input placeholder="Search clients…" />
          </label>
          <span className="secure">● Clinic workspace</span>
        </header>
        <div className="app-content">
          <div className="page-title">
            <div>
              {eyebrow && <p className="eyebrow">{eyebrow}</p>}
              <h1>{title}</h1>
            </div>
            {action}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

export function StatusBadge({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: "green" | "orange" | "gray" | "purple";
}) {
  return <span className={`status-badge ${tone}`}>{children}</span>;
}
export function Avatar({ initials, tone = "mint" }: { initials: string; tone?: string }) {
  return <span className={`avatar ${tone}`}>{initials}</span>;
}
