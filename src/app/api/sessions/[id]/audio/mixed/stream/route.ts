import { apiHandler } from "@/lib/api-handler";
import { dataApiClient } from "@/lib/data-api-client";
import { requireSessionAccess, requireUser } from "@/lib/server-auth";

/**
 * Stream the mixed audio for a session. Proxies Range headers through so
 * HTML5 <audio> scrubbing works; copies Content-Type + Content-Range
 * back to the browser.
 */
export const GET = apiHandler<{ id: string }>(
  "api.sessions.audio.mixed.stream",
  async (req, { params }) => {
    const { id } = await params;
    const user = await requireUser();
    await requireSessionAccess(user, id);

    const upstream = await dataApiClient.streamMixedAudio(
      id,
      req.headers.get("range"),
    );

    const headers = new Headers();
    const passthru = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "cache-control",
    ];
    for (const h of passthru) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
    if (!headers.has("content-type")) {
      headers.set("content-type", "audio/ogg");
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  },
);
