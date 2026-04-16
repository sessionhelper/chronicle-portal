import { NextResponse } from "next/server";

import { apiHandler } from "@/lib/api-handler";
import { dataApiClient } from "@/lib/data-api-client";
import { requireSessionAccess, requireUser } from "@/lib/server-auth";

export const GET = apiHandler<{ id: string }>(
  "api.sessions.participants.list",
  async (_req, { params }) => {
    const { id } = await params;
    const user = await requireUser();
    await requireSessionAccess(user, id);
    const participants = await dataApiClient.listParticipants(id);
    return NextResponse.json(participants);
  },
);
