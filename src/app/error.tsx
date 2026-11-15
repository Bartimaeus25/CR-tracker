"use client";

import { DatabaseZap } from "lucide-react";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <section className="panel error-state" role="alert">
      <span className="empty-icon">
        <DatabaseZap size={28} />
      </span>
      <h1>Rivalry data is unavailable</h1>
      <p>
        The stored data could not be loaded. Check the connection and try again.
      </p>
      <button
        type="button"
        className="button button-primary"
        onClick={() => retry()}
      >
        Try again
      </button>
    </section>
  );
}
