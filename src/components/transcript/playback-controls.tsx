"use client";

import { PlayIcon, SquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PlaybackControlsProps {
  sessionPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
}

export function PlaybackControls({
  sessionPlaying,
  onPlay,
  onStop,
}: PlaybackControlsProps) {
  return (
    <div className="flex items-center gap-2 border-b border-rule bg-card-surface px-4 py-2">
      {sessionPlaying ? (
        <Button variant="ghost" size="sm" onClick={onStop} className="gap-1.5 font-sans text-xs">
          <SquareIcon className="size-3.5" />
          Stop
        </Button>
      ) : (
        <Button variant="ghost" size="sm" onClick={onPlay} className="gap-1.5 font-sans text-xs">
          <PlayIcon className="size-3.5" />
          Play session
        </Button>
      )}
      {sessionPlaying && (
        <span className="font-sans text-xs text-ink-faint">Playing...</span>
      )}
    </div>
  );
}
