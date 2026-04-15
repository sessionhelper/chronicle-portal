import { NextResponse } from "next/server";

import { apiHandler, parseJson } from "@/lib/api-handler";
import { dataApiClient } from "@/lib/data-api-client";
import { LicensePatchBodySchema } from "@/lib/schemas/bff";
import { AuthError, requireSessionAccess, requireUser } from "@/lib/server-auth";

export const PATCH = apiHandler<{ id: string }>(
  "api.me.sessions.license.patch",
  async (req, { params }) => {
    const { id } = await params;
    const user = await requireUser();
    const body = await parseJson(req, LicensePatchBodySchema);
    const decision = await requireSessionAccess(user, id);
    if (!decision.participantId) throw new AuthError(403, "forbidden");
    const updated = await dataApiClient.patchParticipantLicense(
      decision.participantId,
      body,
    );
    return NextResponse.json(updated);
  },
);
