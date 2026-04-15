import { randomUUID } from "crypto";

import { apiHandler } from "@/lib/api-handler";
import { eventBus } from "@/lib/event-bus";
import { requireSessionAccess, requireUser } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SSE stream scoped to a single session the caller has access to.
 * Query: `?events=type1,type2` — optional comma-separated type filter.
 */
export const GET = apiHandler<{ id: string }>(
  "api.sessions.events",
  async (req, { params }) => {
    const { id } = await params;
    const user = await requireUser();
    await requireSessionAccess(user, id);

    const url = new URL(req.url);
    const wanted = new Set(
      (url.searchParams.get("events") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );

    await eventBus.ensureConnected();

    const encoder = new TextEncoder();
    let send: (event: { type: string; data?: unknown }) => void = () => {};
    let unsubscribe = () => {};
    const stream = new ReadableStream({
      start(controller) {
        send = (event) => {
          const chunk = `event: ${event.type}\ndata: ${JSON.stringify(event.data ?? {})}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        };
        send({ type: "ready", data: { session_id: id } });

        unsubscribe = eventBus.subscribe({
          id: `${user.pseudo_id}:${id}:${randomUUID()}`,
          filter: (event) => {
            if (wanted.size > 0 && !wanted.has(event.type)) return false;
            const sessionId = event.data?.session_id;
            return typeof sessionId === "string" ? sessionId === id : true;
          },
          onEvent: (event) => send({ type: event.type, data: event.data }),
          onClose: () => controller.close(),
        });

        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: keep-alive\n\n`));
          } catch {
            clearInterval(heartbeat);
          }
        }, 25_000);

        (stream as unknown as { _cleanup: () => void })._cleanup = () => {
          clearInterval(heartbeat);
          unsubscribe();
        };
      },
      cancel() {
        unsubscribe();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  },
);
