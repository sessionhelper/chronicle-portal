import { apiHandler } from "@/lib/api-handler";
import { assembleMixedOrFallback } from "@/lib/audio-assembler";
import { dataApiClient } from "@/lib/data-api-client";
import { requireSessionAccess, requireUser } from "@/lib/server-auth";

/**
 * Stream the mixed audio for a session.
 *
 * The data-api stores raw 48kHz stereo s16le PCM chunks per speaker;
 * "mixed" is a synthetic track produced by the worker after transcription.
 * We assemble those chunks into a WAV server-side. If no mixed track exists
 * (e.g. on a freshly-injected demo session before the worker ran), we fall
 * back to the first participant's stream so the player isn't broken.
 */
export const GET = apiHandler<{ id: string }>(
  "api.sessions.audio.mixed.stream",
  async (_req, { params }) => {
    const { id } = await params;
    const user = await requireUser();
    await requireSessionAccess(user, id);

    const participants = await dataApiClient.listParticipants(id);
    const pids = participants
      .map((p) => p.user_pseudo_id ?? p.pseudo_id)
      .filter((p): p is string => !!p);

    const wav = await assembleMixedOrFallback(id, pids);
    if (!wav) {
      return new Response("no audio chunks for session", { status: 404 });
    }
    return wav;
  },
);
