"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/**
 * Audio playback hook for the transcript viewer.
 *
 * Drives a single `<audio ref={...}>` element. The BFF assembles the
 * full session as a WAV (see `src/lib/audio-assembler.ts`) so we don't
 * need chunk-windowing on the client — HTML5 handles the streaming.
 *
 * Adds what the plain element can't:
 * - `playSegment(start, end)`: play a clip and auto-pause at `end`.
 *   Implemented via `timeupdate` rather than a setTimeout so it stays
 *   correct across rate changes, pauses, and manual seeks.
 * - `currentTime` / `playing` exposed as reactive state so the viewer
 *   can highlight the active block.
 * - `playbackRate` with 0.5–2x presets.
 */

export type PlaybackRate = 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;

export interface UseAudioPlayback {
  playing: boolean;
  currentTimeMs: number;
  durationMs: number;
  playbackRate: PlaybackRate;
  seekMs: (ms: number) => void;
  playFromMs: (ms: number) => void;
  playSegmentMs: (startMs: number, endMs: number) => void;
  pause: () => void;
  togglePlay: () => void;
  setPlaybackRate: (rate: PlaybackRate) => void;
}

export function useAudioPlayback(
  audioRef: RefObject<HTMLAudioElement | null>,
): UseAudioPlayback {
  const [playing, setPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [playbackRate, setRateState] = useState<PlaybackRate>(1);

  // When set, pause playback as soon as currentTime crosses this mark.
  // Cleared on any manual seek or play action so user scrubbing isn't
  // unexpectedly snipped short.
  const clipEndRef = useRef<number | null>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onTime = () => {
      const ms = el.currentTime * 1000;
      setCurrentTimeMs(ms);
      if (clipEndRef.current !== null && ms >= clipEndRef.current) {
        el.pause();
        clipEndRef.current = null;
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      clipEndRef.current = null;
    };
    const onLoaded = () => {
      if (isFinite(el.duration)) setDurationMs(el.duration * 1000);
    };
    const onRate = () => setRateState(el.playbackRate as PlaybackRate);

    el.addEventListener("timeupdate", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("durationchange", onLoaded);
    el.addEventListener("ratechange", onRate);

    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("durationchange", onLoaded);
      el.removeEventListener("ratechange", onRate);
    };
  }, [audioRef]);

  const seekMs = useCallback(
    (ms: number) => {
      const el = audioRef.current;
      if (!el) return;
      clipEndRef.current = null;
      el.currentTime = ms / 1000;
    },
    [audioRef],
  );

  const playFromMs = useCallback(
    (ms: number) => {
      const el = audioRef.current;
      if (!el) return;
      clipEndRef.current = null;
      el.currentTime = ms / 1000;
      void el.play();
    },
    [audioRef],
  );

  const playSegmentMs = useCallback(
    (startMs: number, endMs: number) => {
      const el = audioRef.current;
      if (!el) return;
      clipEndRef.current = endMs;
      el.currentTime = startMs / 1000;
      void el.play();
    },
    [audioRef],
  );

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, [audioRef]);

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      clipEndRef.current = null;
      void el.play();
    } else {
      el.pause();
    }
  }, [audioRef]);

  const setPlaybackRate = useCallback(
    (rate: PlaybackRate) => {
      const el = audioRef.current;
      if (!el) return;
      el.playbackRate = rate;
    },
    [audioRef],
  );

  return {
    playing,
    currentTimeMs,
    durationMs,
    playbackRate,
    seekMs,
    playFromMs,
    playSegmentMs,
    pause,
    togglePlay,
    setPlaybackRate,
  };
}
