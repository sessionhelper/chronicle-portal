/**
 * Prometheus scrape endpoint. No auth; expected to be reached via the
 * deploy's private network / loopback only (same posture as
 * chronicle-data-api `/metrics`).
 */

import { NextResponse } from "next/server";

import { metrics } from "@/lib/metrics";

export async function GET() {
  const body = await metrics.registry.metrics();
  return new NextResponse(body, {
    status: 200,
    headers: { "Content-Type": metrics.registry.contentType },
  });
}
