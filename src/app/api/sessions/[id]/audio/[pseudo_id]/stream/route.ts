import { apiHandler } from "@/lib/api-handler";
import { dataApiClient } from "@/lib/data-api-client";
import { AuthError, requireSessionAccess, requireUser } from "@/lib/server-auth";

/**
 * Per-speaker audio stream. Admin + GM can fetch any participant;
 * players are restricted to their own pseudo_id.
 */
export const GET = apiHandler<{ id: string; pseudo_id: string }>(
  "api.sessions.audio.participant.stream",
  async (req, { params }) => {
    const { id, pseudo_id } = await params;
    const user = await requireUser();
    const { role } = await requireSessionAccess(user, id);

    if (role === "player" && pseudo_id !== user.pseudo_id) {
      throw new AuthError(403, "forbidden");
    }

    const upstream = await dataApiClient.streamParticipantAudio(
      id,
      pseudo_id,
      req.headers.get("range"),
    );

    const headers = new Headers();
    for (const h of [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "cache-control",
    ]) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
    if (!headers.has("content-type")) headers.set("content-type", "audio/ogg");

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  },
);
