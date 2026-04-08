import { NextResponse } from "next/server";
import { dataApi } from "@/lib/data-api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const participants = await dataApi.getParticipants(id);
    return NextResponse.json(participants);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to fetch participants";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
