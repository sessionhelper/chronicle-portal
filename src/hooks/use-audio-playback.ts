"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TranscriptSegment } from "@/lib/types";

const BASE = "/api/v1";

export interface UseAudioPlayback {
  playingSegId: string | null;
  sessionPlaying: boolean;
  playClip: (segment: TranscriptSegment) => void;
  playSession: (startTime?: number) => void;
  stopAll: () => void;
}

export function useAudioPlayback(
  sessionId: string,
  segments: TranscriptSegment[]
): UseAudioPlayback {
  const [playingSegId, setPlayingSegId] = useState<string | null>(null);
  const [sessionPlaying, setSessionPlaying] = useState(false);
  const audioMapRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const sessionAudioRef = useRef<HTMLAudioElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAll = useCallback(() => {
    audioMapRef.current.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    if (sessionAudioRef.current) {
      sessionAudioRef.current.pause();
      sessionAudioRef.current.currentTime = 0;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setPlayingSegId(null);
    setSessionPlaying(false);
  }, []);

  const playClip = useCallback(
    (segment: TranscriptSegment) => {
      stopAll();

      let audio = audioMapRef.current.get(segment.id);
      if (!audio) {
        audio = new Audio(
          `${BASE}/sessions/${sessionId}/audio/clip?speaker=${encodeURIComponent(segment.speaker_label)}&start=${segment.start_time}&end=${segment.end_time}`
        );
        audioMapRef.current.set(segment.id, audio);
      }

      audio.currentTime = 0;
      audio.play();
      setPlayingSegId(segment.id);

      audio.onended = () => {
        setPlayingSegId(null);
      };
    },
    [sessionId, stopAll]
  );

  const playSession = useCallback(
    (startTime?: number) => {
      stopAll();

      if (!sessionAudioRef.current) {
        sessionAudioRef.current = new Audio(
          `${BASE}/sessions/${sessionId}/audio/combined`
        );
      }

      const audio = sessionAudioRef.current;
      audio.currentTime = startTime ?? 0;
      audio.play();
      setSessionPlaying(true);

      // Poll to sync current segment highlight
      pollRef.current = setInterval(() => {
        const t = audio.currentTime;
        const current = segments.find(
          (s) => t >= s.start_time && t < s.end_time
        );
        setPlayingSegId(current?.id ?? null);
      }, 200);

      audio.onended = () => {
        stopAll();
      };
    },
    [sessionId, segments, stopAll]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioMapRef.current.forEach((audio) => {
        audio.pause();
      });
      if (sessionAudioRef.current) {
        sessionAudioRef.current.pause();
      }
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, []);

  return { playingSegId, sessionPlaying, playClip, playSession, stopAll };
}
