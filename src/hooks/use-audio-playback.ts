"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Audio playback hook — chunk-on-demand approach.
 *
 * Instead of downloading the entire session's audio upfront, fetches
 * small mixed segments from the BFF on demand:
 *
 *   GET /api/sessions/{id}/audio?start=0&end=30&format=opus
 *
 * Supports two playback modes:
 * - Segment playback: fetch and play a specific [start, end] range
 * - Continuous playback: fetch 30s windows, pre-fetch the next window
 *   when nearing the end of the current one
 */

const WINDOW_SIZE = 30; // seconds per fetch window
const PREFETCH_LEAD = 5; // seconds before window end to start pre-fetching

export interface UseAudioPlayback {
  /** Whether audio is currently playing */
  playing: boolean;
  /** Current playback position in session time (seconds) */
  currentTime: number;
  /** Total session duration in seconds (set externally via setDuration) */
  duration: number;
  /** Whether audio data is being fetched */
  loading: boolean;
  /** Error message if audio failed to load */
  error: string | null;
  /** Play a specific segment [start, end] — e.g. clicking a transcript line */
  playSegment: (startTime: number, endTime: number) => void;
  /** Start/resume continuous playback from a point in session time */
  playFrom: (startTime: number) => void;
  /** Seek to a session time */
  seek: (time: number) => void;
  /** Pause playback */
  pause: () => void;
  /** Stop and reset */
  stop: () => void;
  /** Toggle play/pause — resumes from currentTime */
  togglePlay: () => void;
  /** Set the total session duration (from metadata) */
  setDuration: (d: number) => void;
}

interface AudioWindow {
  startTime: number;
  endTime: number;
  blobUrl: string;
}

export function useAudioPlayback(sessionId: string): UseAudioPlayback {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Current and next audio windows
  const currentWindowRef = useRef<AudioWindow | null>(null);
  const nextWindowRef = useRef<AudioWindow | null>(null);
  const prefetchingRef = useRef(false);

  // Whether we're in continuous playback mode (vs segment-only)
  const continuousRef = useRef(false);
  // Session-time offset of the currently playing window
  const windowOffsetRef = useRef(0);

  // --- Helpers ---

  const revokeBlobUrl = useCallback((url: string | null) => {
    if (url) URL.revokeObjectURL(url);
  }, []);

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.ontimeupdate = null;
      audioRef.current = null;
    }
  }, []);

  const cleanupWindows = useCallback(() => {
    if (currentWindowRef.current) {
      revokeBlobUrl(currentWindowRef.current.blobUrl);
      currentWindowRef.current = null;
    }
    if (nextWindowRef.current) {
      revokeBlobUrl(nextWindowRef.current.blobUrl);
      nextWindowRef.current = null;
    }
    prefetchingRef.current = false;
  }, [revokeBlobUrl]);

  const stopTimeLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startTimeLoop = useCallback(() => {
    stopTimeLoop();
    const tick = () => {
      if (audioRef.current && currentWindowRef.current) {
        const offset = windowOffsetRef.current;
        setCurrentTime(offset + audioRef.current.currentTime);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopTimeLoop]);

  /** Fetch audio for a time range and return a blob URL */
  const fetchAudioWindow = useCallback(
    async (start: number, end: number): Promise<AudioWindow> => {
      const res = await fetch(
        `/api/sessions/${sessionId}/audio?start=${start}&end=${end}&format=opus`
      );
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Audio fetch failed: ${res.status} ${body}`);
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      return { startTime: start, endTime: end, blobUrl };
    },
    [sessionId]
  );

  /** Create an HTMLAudioElement from a window, wait for metadata, return it */
  const createAudioElement = useCallback(
    async (window: AudioWindow): Promise<HTMLAudioElement> => {
      const audio = new Audio(window.blobUrl);
      await new Promise<void>((resolve, reject) => {
        audio.addEventListener("loadedmetadata", () => resolve(), {
          once: true,
        });
        audio.addEventListener(
          "error",
          () => reject(new Error("Audio decode error")),
          { once: true }
        );
      });
      return audio;
    },
    []
  );

  /** Pre-fetch the next window if we're in continuous mode */
  const maybePrefetch = useCallback(
    async (currentEnd: number) => {
      if (
        prefetchingRef.current ||
        nextWindowRef.current ||
        !continuousRef.current
      )
        return;
      if (duration > 0 && currentEnd >= duration) return; // at session end

      prefetchingRef.current = true;
      const nextEnd = Math.min(currentEnd + WINDOW_SIZE, duration || currentEnd + WINDOW_SIZE);
      try {
        const win = await fetchAudioWindow(currentEnd, nextEnd);
        nextWindowRef.current = win;
      } catch {
        // Prefetch failure is non-fatal; we'll try again or stop at window end
      }
      prefetchingRef.current = false;
    },
    [duration, fetchAudioWindow]
  );

  /** Switch to the next pre-fetched window for continuous playback */
  const switchToNextWindow = useCallback(async () => {
    if (!nextWindowRef.current || !continuousRef.current) {
      // No next window or not in continuous mode — stop
      setPlaying(false);
      stopTimeLoop();
      return;
    }

    // Swap: next becomes current
    const oldCurrent = currentWindowRef.current;
    const nextWin = nextWindowRef.current;
    nextWindowRef.current = null;

    cleanupAudio();
    if (oldCurrent) revokeBlobUrl(oldCurrent.blobUrl);

    currentWindowRef.current = nextWin;
    windowOffsetRef.current = nextWin.startTime;

    try {
      const audio = await createAudioElement(nextWin);
      audioRef.current = audio;

      // Set up ended handler for the next transition
      audio.onended = () => switchToNextWindow();

      // Set up timeupdate for prefetching
      audio.ontimeupdate = () => {
        const remaining = audio.duration - audio.currentTime;
        if (remaining < PREFETCH_LEAD) {
          maybePrefetch(nextWin.endTime);
        }
      };

      await audio.play();
      startTimeLoop();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Playback failed";
      setError(msg);
      setPlaying(false);
      stopTimeLoop();
    }
  }, [
    cleanupAudio,
    createAudioElement,
    maybePrefetch,
    revokeBlobUrl,
    startTimeLoop,
    stopTimeLoop,
  ]);

  /** Load and play a window, starting at an offset within it */
  const loadAndPlay = useCallback(
    async (windowStart: number, windowEnd: number, offsetInWindow: number) => {
      setLoading(true);
      setError(null);

      // Clean up previous state
      cleanupAudio();
      cleanupWindows();
      stopTimeLoop();

      try {
        const win = await fetchAudioWindow(windowStart, windowEnd);
        currentWindowRef.current = win;
        windowOffsetRef.current = windowStart;

        const audio = await createAudioElement(win);
        audioRef.current = audio;

        if (offsetInWindow > 0) {
          audio.currentTime = offsetInWindow;
        }

        if (continuousRef.current) {
          audio.onended = () => switchToNextWindow();
          audio.ontimeupdate = () => {
            const remaining = audio.duration - audio.currentTime;
            if (remaining < PREFETCH_LEAD) {
              maybePrefetch(win.endTime);
            }
          };
        } else {
          // Segment playback — just stop when done
          audio.onended = () => {
            setPlaying(false);
            stopTimeLoop();
          };
        }

        await audio.play();
        setPlaying(true);
        setLoading(false);
        startTimeLoop();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load audio";
        setError(msg);
        setLoading(false);
      }
    },
    [
      cleanupAudio,
      cleanupWindows,
      createAudioElement,
      fetchAudioWindow,
      maybePrefetch,
      startTimeLoop,
      stopTimeLoop,
      switchToNextWindow,
    ]
  );

  // --- Public methods ---

  const playSegment = useCallback(
    (startTime: number, endTime: number) => {
      continuousRef.current = false;
      loadAndPlay(startTime, endTime, 0);
    },
    [loadAndPlay]
  );

  const playFrom = useCallback(
    (startTime: number) => {
      continuousRef.current = true;
      const windowEnd = Math.min(
        startTime + WINDOW_SIZE,
        duration || startTime + WINDOW_SIZE
      );
      loadAndPlay(startTime, windowEnd, 0);
    },
    [duration, loadAndPlay]
  );

  const seek = useCallback(
    (time: number) => {
      // Calculate which window contains the target time
      const windowStart =
        Math.floor(time / WINDOW_SIZE) * WINDOW_SIZE;
      const windowEnd = Math.min(
        windowStart + WINDOW_SIZE,
        duration || windowStart + WINDOW_SIZE
      );
      const offsetInWindow = time - windowStart;

      // If the current window already covers this time, just seek within it
      const cw = currentWindowRef.current;
      if (cw && time >= cw.startTime && time < cw.endTime && audioRef.current) {
        const localOffset = time - cw.startTime;
        audioRef.current.currentTime = localOffset;
        windowOffsetRef.current = cw.startTime;
        setCurrentTime(time);
        return;
      }

      // Otherwise fetch a new window
      continuousRef.current = true;
      loadAndPlay(windowStart, windowEnd, offsetInWindow);
    },
    [duration, loadAndPlay]
  );

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setPlaying(false);
    stopTimeLoop();
  }, [stopTimeLoop]);

  const stop = useCallback(() => {
    cleanupAudio();
    cleanupWindows();
    stopTimeLoop();
    setPlaying(false);
    setCurrentTime(0);
  }, [cleanupAudio, cleanupWindows, stopTimeLoop]);

  const togglePlay = useCallback(() => {
    if (playing) {
      pause();
    } else if (audioRef.current && currentWindowRef.current) {
      // Resume from where we paused
      audioRef.current.play().then(() => {
        setPlaying(true);
        startTimeLoop();
      }).catch(() => {
        setError("Playback blocked. Click play to start.");
      });
    } else {
      // No audio loaded — start continuous play from currentTime
      playFrom(currentTime);
    }
  }, [playing, pause, startTimeLoop, playFrom, currentTime]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current.ontimeupdate = null;
        audioRef.current = null;
      }
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      if (currentWindowRef.current) {
        URL.revokeObjectURL(currentWindowRef.current.blobUrl);
      }
      if (nextWindowRef.current) {
        URL.revokeObjectURL(nextWindowRef.current.blobUrl);
      }
    };
  }, []);

  // Reset when session changes
  useEffect(() => {
    cleanupAudio();
    cleanupWindows();
    stopTimeLoop();
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setLoading(false);
    setError(null);
  }, [sessionId, cleanupAudio, cleanupWindows, stopTimeLoop]);

  return {
    playing,
    currentTime,
    duration,
    loading,
    error,
    playSegment,
    playFrom,
    seek,
    pause,
    stop,
    togglePlay,
    setDuration,
  };
}
