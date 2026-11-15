import Link from "next/link";
import { Swords } from "lucide-react";

export default function NotFound() {
  return (
    <section className="panel error-state">
      <span className="empty-icon">
        <Swords size={28} />
      </span>
      <h1>This record isn’t in the arena</h1>
      <p>The player, match, or page could not be found in this tracker.</p>
      <Link className="button button-primary" href="/">
        Back to overview
      </Link>
    </section>
  );
}
