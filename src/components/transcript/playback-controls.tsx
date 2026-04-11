"use client";

import { PauseIcon, PlayIcon, SquareIcon, Loader2Icon } from "lucide-react";

interface PlaybackControlsProps {
  playing: boolean;
  currentTime: number;
  /** Total session duration from metadata — not the audio element's duration */
  duration: number;
  loading: boolean;
  error: string | null;
  onTogglePlay: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
}

function formatTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PlaybackControls({
  playing,
  currentTime,
  duration,
  loading,
  error,
  onTogglePlay,
  onStop,
  onSeek,
}: PlaybackControlsProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Play/Pause */}
      <button
        onClick={onTogglePlay}
        disabled={loading}
        className="px-3 py-1 rounded font-sans text-sm bg-accent-brown text-card-surface hover:bg-accent-light transition-colors disabled:opacity-50 flex items-center gap-1.5"
      >
        {loading ? (
          <>
            <Loader2Icon className="size-3.5 animate-spin" />
            Loading...
          </>
        ) : playing ? (
          <>
            <PauseIcon className="size-3.5" />
            Pause
          </>
        ) : (
          <>
            <PlayIcon className="size-3.5" />
            Play
          </>
        )}
      </button>

      {/* Stop */}
      {(playing || currentTime > 0) && (
        <button
          onClick={onStop}
          className="px-2 py-1 rounded font-sans text-sm text-ink-faint hover:text-ink transition-colors"
          title="Stop and reset"
        >
          <SquareIcon className="size-3.5" />
        </button>
      )}

      {/* Seek bar — maps to the full session duration */}
      <input
        type="range"
        min={0}
        max={duration || 1}
        step={0.1}
        value={currentTime}
        onChange={(e) => onSeek(parseFloat(e.target.value))}
        className="flex-1 min-w-[120px] accent-[#8b4513]"
        disabled={duration === 0}
      />

      {/* Time display */}
      <span className="font-mono text-xs text-ink-faint tabular-nums">
        {formatTime(currentTime)}
        {duration > 0 && <> / {formatTime(duration)}</>}
      </span>

      {/* Error display */}
      {error && (
        <span className="font-sans text-xs text-danger">{error}</span>
      )}
    </div>
  );
}
