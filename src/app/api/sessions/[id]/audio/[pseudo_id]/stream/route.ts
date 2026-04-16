import { apiHandler } from "@/lib/api-handler";
import { assembleWavResponse } from "@/lib/audio-assembler";
import { AuthError, requireSessionAccess, requireUser } from "@/lib/server-auth";

/**
 * Per-speaker audio stream — assembles raw PCM chunks into a WAV with
 * byte-range support. Admin + GM can fetch any participant; players
 * are restricted to their own pseudo_id.
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

    const wav = await assembleWavResponse(id, pseudo_id, req.headers.get("range"));
    if (!wav) {
      return new Response("no audio chunks for participant", { status: 404 });
    }
    return wav;
  },
);
