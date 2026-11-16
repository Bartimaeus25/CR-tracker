"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { refreshPlayerData } from "@/app/actions";
import { ComparisonSelector } from "./comparison-selector";
import {
  ArrowUpRight,
  Crown,
  Grid2X2,
  Layers3,
  RefreshCw,
  Swords,
  Users,
  X,
  ChartNoAxesCombined,
} from "lucide-react";

const navigation = [
  { href: "/", label: "Overview", icon: Grid2X2 },
  { href: "/stats", label: "Stats", icon: ChartNoAxesCombined },
  { href: "/matches", label: "Matches", icon: Swords },
  { href: "/decks", label: "Decks", icon: Layers3 },
  { href: "/players", label: "Players", icon: Users },
];

export function DashboardShell({ children, comparison }: {
  children: React.ReactNode;
  comparison: string[];
}) {
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
          <Link href="/reports">
            Email reports <ArrowUpRight size={14} />
          </Link>
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
          <div className="topbar-actions">
            <ComparisonSelector pair={comparison} />
            <RefreshButton />
          </div>
        </header>
        <main id="main-content" className="main-content">
          {children}
        </main>
        <footer className="app-footer">
          <Link href="/reports">Email reports</Link>
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
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const handleRefresh = () => {
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await refreshPlayerData();
        setFeedback({ ok: result.ok, message: result.message });
      } catch {
        setFeedback({
          ok: false,
          message: "Refresh failed. Check your connection and try again.",
        });
      }
    });
  };
  return (
    <div className="refresh-control">
      <button
        type="button"
        className="button button-secondary refresh-button"
        disabled={pending}
        onClick={handleRefresh}
        aria-busy={pending}
        title="Fetch all tracked players from the Clash Royale API and update the dashboard"
      >
        <RefreshCw size={15} className={pending ? "spinning" : ""} />
        <span>{pending ? "Fetching data…" : "Refresh data"}</span>
      </button>
      {feedback && (
        <div
          className={`refresh-feedback ${feedback.ok ? "success" : "error"}`}
          role={feedback.ok ? "status" : "alert"}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            aria-label="Dismiss refresh message"
            onClick={() => setFeedback(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
