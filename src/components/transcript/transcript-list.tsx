"use client";

import type { TranscriptSegment } from "@/lib/types";
import { SegmentRow } from "./segment-row";

interface TranscriptListProps {
  segments: TranscriptSegment[];
  playingSegId: string | null;
  onPlayClip: (segment: TranscriptSegment) => void;
  onPlayFrom: (startTime: number) => void;
  onFlag: (segmentId: string) => void;
  onUnflag: (segmentId: string) => void;
  onEdit: (segmentId: string, newText: string) => void;
}

export function TranscriptList({
  segments,
  playingSegId,
  onPlayClip,
  onPlayFrom,
  onFlag,
  onUnflag,
  onEdit,
}: TranscriptListProps) {
  if (segments.length === 0) {
    return (
      <p className="px-4 py-8 text-center font-sans text-sm text-ink-faint">
        No transcript segments found.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 overflow-y-auto px-1 py-2">
      {segments.map((segment) => (
        <SegmentRow
          key={segment.id}
          segment={segment}
          isPlaying={playingSegId === segment.id}
          onPlayClip={() => onPlayClip(segment)}
          onPlayFrom={() => onPlayFrom(segment.start_time)}
          onFlag={() => onFlag(segment.id)}
          onUnflag={() => onUnflag(segment.id)}
          onEdit={(newText) => onEdit(segment.id, newText)}
        />
      ))}
    </div>
  );
}
