import { NextResponse } from "next/server";

import { apiHandler, parseJson } from "@/lib/api-handler";
import { dataApiClient } from "@/lib/data-api-client";
import { ConsentPatchBodySchema } from "@/lib/schemas/bff";
import { AuthError, requireSessionAccess, requireUser } from "@/lib/server-auth";

/** Update my own consent scope for a session I participated in. */
export const PATCH = apiHandler<{ id: string }>(
  "api.me.sessions.consent.patch",
  async (req, { params }) => {
    const { id } = await params;
    const user = await requireUser();
    const body = await parseJson(req, ConsentPatchBodySchema);
    const decision = await requireSessionAccess(user, id);
    if (!decision.participantId) {
      // Admins/GMs who were not participants cannot touch consent
      // records — that's a personal action.
      throw new AuthError(403, "forbidden");
    }
    const updated = await dataApiClient.patchParticipantConsent(
      decision.participantId,
      body,
    );
    return NextResponse.json(updated);
  },
);
