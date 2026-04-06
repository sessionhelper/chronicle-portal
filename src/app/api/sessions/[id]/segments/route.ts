import { NextResponse } from "next/server";
import { dataApi } from "@/lib/data-api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const segments = await dataApi.getSegments(id);
    return NextResponse.json(segments);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch segments";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
