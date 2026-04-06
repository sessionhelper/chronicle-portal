import { NextResponse } from "next/server";
import { dataApi } from "@/lib/data-api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await dataApi.getSession(id);
    return NextResponse.json(session);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch session";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
