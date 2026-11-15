"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  ArrowUpRight,
  Crown,
  Grid2X2,
  Layers3,
  RefreshCw,
  Swords,
  Users,
} from "lucide-react";

const navigation = [
  { href: "/", label: "Overview", icon: Grid2X2 },
  { href: "/matches", label: "Matches", icon: Swords },
  { href: "/decks", label: "Decks", icon: Layers3 },
  { href: "/players", label: "Players", icon: Users },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const section = navigation.find((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="Rivalry home">
          <span className="brand-mark">
            <Crown size={24} strokeWidth={1.8} />
          </span>
          <span>
            <strong>RIVALRY</strong>
            <small>CLASH ROYALE</small>
          </span>
        </Link>
        <div className="nav-label">YOUR ARENA</div>
        <nav aria-label="Main navigation">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                href={href}
                key={href}
                className={`nav-link ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={19} />
                <span>{label}</span>
                {active && <span className="nav-dot" />}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/#data-notes">
            Data & methodology <ArrowUpRight size={14} />
          </Link>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <Link className="mobile-brand" href="/" aria-label="Rivalry home">
            <Crown size={22} />
          </Link>
          <div className="breadcrumb">
            <span>Rivalry</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{section?.label ?? "Match details"}</strong>
          </div>
          <span className="topbar-note">
            <span className="status-dot" /> Stored match data
          </span>
          <RefreshButton />
        </header>
        <main id="main-content" className="main-content">
          {children}
        </main>
        <footer className="app-footer">
          <span>
            RIVALRY <span className="footer-divider">/</span> Clash Royale
            tracker
          </span>
          <span>All times Europe/Berlin</span>
        </footer>
      </div>
    </div>
  );
}

export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="button button-secondary refresh-button"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
      title="Reload stored data without running collection"
    >
      <RefreshCw size={15} className={pending ? "spinning" : ""} />
      <span>{pending ? "Refreshing…" : "Refresh view"}</span>
    </button>
  );
}
