import { NextResponse } from "next/server";
import { dataApi } from "@/lib/data-api";

/**
 * GET /api/sessions/:id/audio?start=0&end=30&format=opus
 *
 * Proxies to the data-api mixed audio endpoint which returns
 * pre-mixed OGG/Opus (or WAV fallback) for the requested time range.
 * Replaces the old approach of downloading all per-speaker PCM chunks
 * and mixing in the BFF.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const start = url.searchParams.get("start") ?? "0";
    const end = url.searchParams.get("end");

    if (!end) {
      return NextResponse.json(
        { error: "end parameter required" },
        { status: 400 }
      );
    }

    const format = url.searchParams.get("format") ?? "opus";

    const audioData = await dataApi.getMixedAudio(
      id,
      parseFloat(start),
      parseFloat(end),
      format
    );

    const contentType = format === "opus" ? "audio/ogg" : "audio/wav";
    return new Response(audioData, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to fetch audio";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
