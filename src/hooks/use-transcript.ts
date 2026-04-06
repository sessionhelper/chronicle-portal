"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { TranscriptSegment } from "@/lib/types";

export function useTranscript(sessionId: string) {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      try {
        const data = await api.transcript.get(sessionId);
        if (!cancelled) {
          setSegments(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load transcript");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const flagSegment = useCallback(
    async (segmentId: string) => {
      // Optimistic update
      setSegments((prev) =>
        prev.map((s) =>
          s.id === segmentId
            ? { ...s, flagged: true, flagged_by_me: true, flag_reason: "private_info" }
            : s
        )
      );
      try {
        await api.segments.flag(segmentId, "private_info");
      } catch {
        // Revert on failure
        setSegments((prev) =>
          prev.map((s) =>
            s.id === segmentId
              ? { ...s, flagged: false, flagged_by_me: false, flag_reason: null }
              : s
          )
        );
        throw new Error("Failed to flag segment");
      }
    },
    []
  );

  const unflagSegment = useCallback(
    async (segmentId: string) => {
      // Optimistic update
      setSegments((prev) =>
        prev.map((s) =>
          s.id === segmentId
            ? { ...s, flagged: false, flagged_by_me: false, flag_reason: null }
            : s
        )
      );
      try {
        await api.segments.unflag(segmentId);
      } catch {
        // Revert on failure
        setSegments((prev) =>
          prev.map((s) =>
            s.id === segmentId
              ? { ...s, flagged: true, flagged_by_me: true, flag_reason: "private_info" }
              : s
          )
        );
        throw new Error("Failed to unflag segment");
      }
    },
    []
  );

  const editSegment = useCallback(
    async (segmentId: string, newText: string) => {
      await api.segments.edit(segmentId, newText);
      setSegments((prev) =>
        prev.map((s) =>
          s.id === segmentId ? { ...s, text: newText, edited: true } : s
        )
      );
    },
    []
  );

  return { segments, loading, error, flagSegment, unflagSegment, editSegment };
}
