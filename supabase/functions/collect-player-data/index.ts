import { createCollectionHandler } from "../../../src/lib/edge-collection-handler";

// This entrypoint is bundled for the hosted Deno runtime by scripts/supabase-collector.ts.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

Deno.serve(createCollectionHandler(Deno.env.get("COLLECTION_CRON_SECRET")));
