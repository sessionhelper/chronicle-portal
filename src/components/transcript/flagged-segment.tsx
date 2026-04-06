"use client";

import { Button } from "@/components/ui/button";

interface FlaggedSegmentProps {
  flaggedByMe: boolean;
  onUndo: () => void;
}

export function FlaggedSegment({ flaggedByMe, onUndo }: FlaggedSegmentProps) {
  return (
    <div className="flex items-center gap-3 rounded bg-parchment-dark px-3 py-2">
      <div className="h-3 flex-1 rounded-sm bg-rule" />
      <span className="font-sans text-xs text-ink-faint">
        {flaggedByMe ? (
          <>
            Flagged by you{" "}
            <Button
              variant="link"
              size="xs"
              className="text-accent-brown px-0"
              onClick={onUndo}
            >
              Undo
            </Button>
          </>
        ) : (
          "Flagged"
        )}
      </span>
    </div>
  );
}
