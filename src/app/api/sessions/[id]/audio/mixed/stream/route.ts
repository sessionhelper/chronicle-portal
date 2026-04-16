import { apiHandler } from "@/lib/api-handler";
import { assembleMixedOrFallback } from "@/lib/audio-assembler";
import { dataApiClient } from "@/lib/data-api-client";
import { requireSessionAccess, requireUser } from "@/lib/server-auth";

/**
 * Stream the mixed audio for a session as a WAV with byte-range support.
 * Range requests are what lets HTML5 <audio> seek without downloading
 * the whole file first — without it, per-segment play silently snaps
 * to the beginning.
 */
export const GET = apiHandler<{ id: string }>(
  "api.sessions.audio.mixed.stream",
  async (req, { params }) => {
    const { id } = await params;
    const user = await requireUser();
    await requireSessionAccess(user, id);

    const participants = await dataApiClient.listParticipants(id);
    const pids = participants
      .map((p) => p.user_pseudo_id ?? p.pseudo_id)
      .filter((p): p is string => !!p);

    const wav = await assembleMixedOrFallback(id, pids, req.headers.get("range"));
    if (!wav) {
      return new Response("no audio chunks for session", { status: 404 });
    }
    return wav;
  },
);
