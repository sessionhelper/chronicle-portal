import { NextResponse } from "next/server";

import { apiHandler } from "@/lib/api-handler";
import { dataApiClient } from "@/lib/data-api-client";
import { filterSegmentsForRole } from "@/lib/filters";
import { requireSessionAccess, requireUser } from "@/lib/server-auth";

export const GET = apiHandler<{ id: string }>(
  "api.sessions.segments.list",
  async (_req, { params }) => {
    const { id } = await params;
    const user = await requireUser();
    const { role } = await requireSessionAccess(user, id);
    const segments = await dataApiClient.listSegments(id);
    return NextResponse.json(filterSegmentsForRole(user, role, segments));
  },
);
