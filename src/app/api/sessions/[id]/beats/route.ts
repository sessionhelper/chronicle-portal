import { NextResponse } from "next/server";
import { dataApi } from "@/lib/data-api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const beats = await dataApi.getBeats(id);
    return NextResponse.json(beats);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch beats";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
