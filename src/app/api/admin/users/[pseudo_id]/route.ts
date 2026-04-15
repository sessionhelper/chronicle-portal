import { NextResponse } from "next/server";

import { apiHandler, parseJson } from "@/lib/api-handler";
import { dataApiClient } from "@/lib/data-api-client";
import { AdminUserPatchBodySchema } from "@/lib/schemas/bff";
import { requireAdmin } from "@/lib/server-auth";

export const PATCH = apiHandler<{ pseudo_id: string }>(
  "api.admin.users.patch",
  async (req, { params }) => {
    const { pseudo_id } = await params;
    await requireAdmin();
    const body = await parseJson(req, AdminUserPatchBodySchema);
    const updated = await dataApiClient.setUserAdmin(pseudo_id, body.is_admin);
    return NextResponse.json(updated);
  },
);
