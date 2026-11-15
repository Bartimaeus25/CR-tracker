export default function Loading() {
  return (
    <div
      className="dashboard-loading"
      role="status"
      aria-label="Loading stored rivalry data"
    >
      <span className="sr-only">Loading rivalry data…</span>
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-subtitle" />
      <div className="skeleton skeleton-hero" />
      <div className="two-column">
        <div className="skeleton skeleton-panel" />
        <div className="skeleton skeleton-panel" />
      </div>
    </div>
  );
}
