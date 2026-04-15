"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";

/**
 * Subscribes to `/api/sessions/:id/events?events=session_state_changed`
 * and flips the badge when the session's state changes. If the initial
 * status is already `recording`, the badge renders immediately; the SSE
 * stream only downgrades it.
 */
export function SessionLiveBadge({
  sessionId,
  initialStatus,
}: {
  sessionId: string;
  initialStatus: string;
}) {
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    const url = `/api/sessions/${sessionId}/events?events=session_state_changed`;
    const src = new EventSource(url);
    src.addEventListener("session_state_changed", (raw) => {
      try {
        const parsed = JSON.parse((raw as MessageEvent).data) as {
          session_id: string;
          new: string;
        };
        if (parsed.session_id === sessionId) setStatus(parsed.new);
      } catch {
        // ignore malformed
      }
    });
    return () => src.close();
  }, [sessionId]);

  if (status === "recording") {
    return (
      <Badge variant="destructive">
        <span className="mr-1">🔴</span> recording
      </Badge>
    );
  }
  return <Badge variant="secondary">{status}</Badge>;
}
