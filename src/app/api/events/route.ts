/**
 * SSE endpoint that bridges data-api WebSocket events to the browser.
 *
 * The browser opens an EventSource to `/api/events?session_id=<uuid>`.
 * This route connects to the data-api WebSocket (authenticated via the
 * server-side shared secret), subscribes to the requested session's
 * events, and forwards them as SSE messages.
 *
 * Using SSE instead of WebSocket for the browser connection because:
 * - SSE works natively with Next.js API routes (no upgrade needed)
 * - The browser only needs one-way streaming (server -> client)
 * - Mutations go through regular REST calls
 *
 * Filtered events:
 * - `chunk_uploaded` is internal-only and NOT forwarded to the browser.
 * - All other event types (session_status_changed, segment_added,
 *   segments_batch_added, transcription_progress, beat_detected,
 *   scene_detected) are forwarded.
 */

import WebSocket from "ws";

const DATA_API_URL = process.env.DATA_API_URL || "http://localhost:8001";
const SHARED_SECRET = process.env.DATA_API_SHARED_SECRET || "";

/** Events that should NOT be forwarded to the browser. */
const INTERNAL_ONLY_EVENTS = new Set(["chunk_uploaded"]);

export const dynamic = "force-dynamic";

/**
 * Authenticate with the data-api and return the WS URL with token.
 * Uses the same shared-secret auth as `src/lib/data-api.ts`.
 */
async function getAuthenticatedWsUrl(): Promise<string> {
  const res = await fetch(`${DATA_API_URL}/internal/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      shared_secret: SHARED_SECRET,
      service_name: "ttrpg-collector-frontend",
    }),
  });

  if (!res.ok) {
    throw new Error(`Data API auth failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const token = data.session_token;

  // Convert http(s) base URL to ws(s) for the WebSocket connection
  const wsBase = DATA_API_URL.replace(/^http/, "ws");
  return `${wsBase}/ws?token=${encodeURIComponent(token)}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return new Response("session_id query parameter required", { status: 400 });
  }

  // Get an authenticated WS URL before setting up the stream
  let wsUrl: string;
  try {
    wsUrl = await getAuthenticatedWsUrl();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "auth failed";
    return new Response(JSON.stringify({ error: msg }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let ws: WebSocket | null = null;
      let closed = false;

      function cleanup() {
        closed = true;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      }

      // Listen for client disconnect via the abort signal
      request.signal.addEventListener("abort", cleanup);

      try {
        ws = new WebSocket(wsUrl);
      } catch {
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ error: "Failed to connect to event bus" })}\n\n`
          )
        );
        controller.close();
        return;
      }

      ws.on("open", () => {
        if (closed) return;
        // Subscribe to the specific session's events
        ws!.send(JSON.stringify({ subscribe: `sessions/${sessionId}` }));

        // Send initial connection event so the client knows the stream is live
        controller.enqueue(
          encoder.encode(
            `event: connected\ndata: ${JSON.stringify({ session_id: sessionId })}\n\n`
          )
        );
      });

      ws.on("message", (data: WebSocket.RawData) => {
        if (closed) return;
        try {
          const event = JSON.parse(data.toString());
          const eventType = event.event || "unknown";

          // Don't forward internal-only events to the browser
          if (INTERNAL_ONLY_EVENTS.has(eventType)) return;

          controller.enqueue(
            encoder.encode(
              `event: ${eventType}\ndata: ${JSON.stringify(event)}\n\n`
            )
          );
        } catch {
          // Malformed message from data-api — skip
        }
      });

      ws.on("close", () => {
        if (!closed) {
          controller.enqueue(
            encoder.encode(
              `event: disconnected\ndata: ${JSON.stringify({ reason: "upstream closed" })}\n\n`
            )
          );
          try {
            controller.close();
          } catch {
            // Stream may already be closed
          }
        }
      });

      ws.on("error", (err: Error) => {
        if (!closed) {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`
            )
          );
          try {
            controller.close();
          } catch {
            // Stream may already be closed
          }
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
