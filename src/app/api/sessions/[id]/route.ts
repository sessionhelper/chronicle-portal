import { NextResponse } from "next/server";

import { apiHandler } from "@/lib/api-handler";
import { dataApiClient } from "@/lib/data-api-client";
import { requireSessionAccess, requireUser } from "@/lib/server-auth";

export const GET = apiHandler<{ id: string }>(
  "api.sessions.get",
  async (_req, { params }) => {
    const { id } = await params;
    const user = await requireUser();
    await requireSessionAccess(user, id);
    const [session, participants] = await Promise.all([
      dataApiClient.getSession(id),
      dataApiClient.listParticipants(id),
    ]);
    return NextResponse.json({ session, participants });
  },
);
