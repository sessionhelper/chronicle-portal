import { NextResponse } from "next/server";
import { dataApi } from "@/lib/data-api";

export async function GET() {
  const result = await dataApi.healthCheck();
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
