import { apiHandler } from "@/lib/api-handler";
import { dataApiClient } from "@/lib/data-api-client";
import { requireAdmin } from "@/lib/server-auth";

// Stubbed for MVP: proxies to worker admin but does not expose UI yet.
export const POST = apiHandler<{ id: string }>(
  "api.sessions.rerun",
  async (_req, { params }) => {
    const { id } = await params;
    await requireAdmin();
    const res = await dataApiClient.triggerRerun(id);
    return new Response(
      JSON.stringify({ ok: res.ok, upstream_status: res.status }),
      {
        status: res.ok ? 202 : 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  },
);
