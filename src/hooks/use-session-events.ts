"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Hook that subscribes to real-time session events via SSE.
 *
 * Opens an EventSource to `/api/events?session_id=<id>` and dispatches
 * incoming events to the provided callbacks. Automatically reconnects
 * on disconnect with a 3-second backoff.
 *
 * The caller provides callbacks for each event type they care about.
 * Callbacks are stable refs (wrapped in useRef internally) so changing
 * them doesn't cause reconnection.
 */
export interface SessionEventCallbacks {
  onSegmentAdded?: (data: { session_id: string; segment: Record<string, unknown> }) => void;
  onSegmentsBatchAdded?: (data: { session_id: string; count: number }) => void;
  onStatusChanged?: (data: { session_id: string; status: string }) => void;
  onChunkUploaded?: (data: { session_id: string; pseudo_id: string; seq: number; size: number }) => void;
  onBeatDetected?: (data: { session_id: string; beat: Record<string, unknown> }) => void;
  onSceneDetected?: (data: { session_id: string; scene: Record<string, unknown> }) => void;
  onTranscriptionProgress?: (data: { session_id: string; stage: string; detail: string }) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

export function useSessionEvents(
  sessionId: string | null,
  callbacks: SessionEventCallbacks
) {
  // Stable ref for callbacks to avoid reconnecting on every render
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  useEffect(() => {
    if (!sessionId) return;

    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    function connect() {
      if (disposed) return;

      eventSource = new EventSource(`/api/events?session_id=${sessionId}`);

      eventSource.addEventListener("connected", () => {
        cbRef.current.onConnected?.();
      });

      eventSource.addEventListener("segment_added", (e) => {
        try {
          cbRef.current.onSegmentAdded?.(JSON.parse(e.data));
        } catch { /* malformed data */ }
      });

      eventSource.addEventListener("segments_batch_added", (e) => {
        try {
          cbRef.current.onSegmentsBatchAdded?.(JSON.parse(e.data));
        } catch { /* malformed data */ }
      });

      eventSource.addEventListener("session_status_changed", (e) => {
        try {
          cbRef.current.onStatusChanged?.(JSON.parse(e.data));
        } catch { /* malformed data */ }
      });

      eventSource.addEventListener("chunk_uploaded", (e) => {
        try {
          cbRef.current.onChunkUploaded?.(JSON.parse(e.data));
        } catch { /* malformed data */ }
      });

      eventSource.addEventListener("beat_detected", (e) => {
        try {
          cbRef.current.onBeatDetected?.(JSON.parse(e.data));
        } catch { /* malformed data */ }
      });

      eventSource.addEventListener("scene_detected", (e) => {
        try {
          cbRef.current.onSceneDetected?.(JSON.parse(e.data));
        } catch { /* malformed data */ }
      });

      eventSource.addEventListener("transcription_progress", (e) => {
        try {
          cbRef.current.onTranscriptionProgress?.(JSON.parse(e.data));
        } catch { /* malformed data */ }
      });

      eventSource.addEventListener("disconnected", () => {
        cbRef.current.onDisconnected?.();
        scheduleReconnect();
      });

      eventSource.onerror = () => {
        cbRef.current.onDisconnected?.();
        eventSource?.close();
        scheduleReconnect();
      };
    }

    function scheduleReconnect() {
      if (disposed) return;
      reconnectTimer = setTimeout(connect, 3000);
    }

    connect();

    return () => {
      disposed = true;
      eventSource?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [sessionId]);
}
