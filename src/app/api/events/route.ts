/**
 * SSE endpoint that bridges data-api WebSocket events to the browser.
 *
 * The browser opens an EventSource to `/api/events?session_id=<uuid>`.
 * This route connects to the data-api WebSocket, subscribes to the
 * requested session's events, and forwards them as SSE messages.
 *
 * Using SSE instead of WebSocket for the browser connection because:
 * - SSE works natively with Next.js API routes (no upgrade needed)
 * - The browser only needs one-way streaming (server -> client)
 * - Mutations go through regular REST calls
 */

import WebSocket from "ws";

const DATA_API_WS_URL =
  process.env.DATA_API_WS_URL || "ws://localhost:8001/ws";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return new Response("session_id query parameter required", { status: 400 });
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
        ws = new WebSocket(DATA_API_WS_URL);
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
