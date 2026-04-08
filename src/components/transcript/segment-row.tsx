"use client";

import { useState } from "react";
import { FlagIcon, PencilIcon, PlayIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatTime } from "@/lib/format";
import type { TranscriptSegment } from "@/lib/types";
import { SegmentEditor } from "./segment-editor";
import { FlaggedSegment } from "./flagged-segment";

interface SegmentRowProps {
  segment: TranscriptSegment;
  isPlaying: boolean;
  onPlayClip: () => void;
  onPlayFrom: () => void;
  onFlag: () => void;
  onUnflag: () => void;
  onEdit: (newText: string) => void;
}

export function SegmentRow({
  segment,
  isPlaying,
  onPlayClip,
  onPlayFrom,
  onFlag,
  onUnflag,
  onEdit,
}: SegmentRowProps) {
  const [editing, setEditing] = useState(false);

  if (segment.flagged) {
    return (
      <FlaggedSegment flaggedByMe={segment.flagged_by_me} onUndo={onUnflag} />
    );
  }

  return (
    <div
      className={`group flex items-start gap-2 rounded px-3 py-1.5 transition-colors duration-100 ${
        isPlaying
          ? "border-l-2 border-accent-brown bg-card-surface"
          : "hover:bg-parchment-dark"
      }`}
    >
      {/* Play button */}
      <button
        onClick={onPlayClip}
        className={`mt-0.5 flex-none transition-opacity duration-100 ${
          isPlaying
            ? "text-accent-brown opacity-100 animate-pulse"
            : "text-ink-faint opacity-0 group-hover:opacity-100"
        }`}
        aria-label="Play clip"
      >
        <PlayIcon className="size-3.5" />
      </button>

      {/* Timestamp */}
      <button
        onClick={onPlayFrom}
        className="mt-0.5 flex-none font-mono text-xs text-ink-faint hover:text-ink-light transition-colors duration-100"
      >
        {formatTime(segment.start_time)}
      </button>

      {/* Speaker */}
      <span
        className={`mt-0.5 flex-none font-sans text-xs font-medium ${
          segment.is_own_line ? "text-accent-brown" : "text-ink-light"
        }`}
      >
        {segment.is_own_line ? "YOU" : segment.speaker_label}
      </span>

      {/* Text / editor */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <SegmentEditor
            initialText={segment.text ?? ""}
            onSave={(newText) => {
              onEdit(newText);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <span
            className={`font-serif text-sm text-ink ${
              segment.edited ? "underline decoration-dashed decoration-rule underline-offset-2" : ""
            }`}
          >
            {segment.text}
            {segment.edited && (
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="secondary" className="ml-1.5 text-[10px] font-sans">
                    edited
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <span className="font-sans text-xs">Original: {segment.original_text}</span>
                </TooltipContent>
              </Tooltip>
            )}
          </span>
        )}
      </div>

      {/* Actions */}
      {!editing && (
        <div className="flex flex-none items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
          {segment.can_edit && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setEditing(true)}
              aria-label="Edit"
            >
              <PencilIcon className="size-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onFlag}
            aria-label="Flag as private info"
          >
            <FlagIcon className="size-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
