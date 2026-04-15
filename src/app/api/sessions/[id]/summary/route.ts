import { NextResponse } from "next/server";

import { apiHandler } from "@/lib/api-handler";
import { dataApiClient } from "@/lib/data-api-client";
import { requireSessionAccess, requireUser } from "@/lib/server-auth";

export const GET = apiHandler<{ id: string }>(
  "api.sessions.summary",
  async (_req, { params }) => {
    const { id } = await params;
    const user = await requireUser();
    await requireSessionAccess(user, id);
    const summary = await dataApiClient.getSessionSummary(id);
    return NextResponse.json(summary);
  },
);
