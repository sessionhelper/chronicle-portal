import { NextResponse } from "next/server";
import { dataApi } from "@/lib/data-api";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;
    const sessions = await dataApi.listSessions(status);
    return NextResponse.json(sessions);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch sessions";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
