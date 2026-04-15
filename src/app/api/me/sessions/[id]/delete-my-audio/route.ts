import { NextResponse } from "next/server";

import { apiHandler, parseJson } from "@/lib/api-handler";
import { dataApiClient } from "@/lib/data-api-client";
import { DeleteMyAudioBodySchema } from "@/lib/schemas/bff";
import { AuthError, requireSessionAccess, requireUser } from "@/lib/server-auth";

/**
 * Permanently delete the caller's audio from a session. Requires the
 * confirmation phrase in the body — even though the UI will already
 * have shown a dialog, the BFF double-checks so curl can't accidentally
 * wipe data.
 */
export const POST = apiHandler<{ id: string }>(
  "api.me.sessions.delete_my_audio",
  async (req, { params }) => {
    const { id } = await params;
    const user = await requireUser();
    await parseJson(req, DeleteMyAudioBodySchema);
    const decision = await requireSessionAccess(user, id);
    if (decision.role !== "player" && decision.role !== "gm") {
      throw new AuthError(403, "forbidden");
    }
    await dataApiClient.deleteParticipantAudio(id, user.pseudo_id);
    return NextResponse.json({ ok: true });
  },
);
