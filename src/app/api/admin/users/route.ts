import { NextResponse } from "next/server";

import { apiHandler } from "@/lib/api-handler";
import { dataApiClient } from "@/lib/data-api-client";
import { requireAdmin } from "@/lib/server-auth";

export const GET = apiHandler("api.admin.users.list", async () => {
  await requireAdmin();
  const users = await dataApiClient.listUsers();
  return NextResponse.json(users);
});
