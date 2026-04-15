"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { Participant, Segment } from "@/lib/schemas/data-api";
import { formatTime } from "@/lib/utils";

/**
 * Per-segment display + inline editor. The `canEdit` flag is computed
 * server-side and passed down — never derive edit permission in the
 * client.
 */
export function SegmentList({
  segments: initial,
  participants,
  canEdit,
}: {
  segments: Segment[];
  participants: Participant[];
  /** Map of segment id → edit permission (server-derived). */
  canEdit: Record<string, boolean>;
}) {
  const [segments, setSegments] = useState(initial);
  const speakerLookup = new Map<string, string>();
  for (const p of participants) {
    if (p.user_pseudo_id && p.display_name) {
      speakerLookup.set(p.user_pseudo_id, p.display_name);
    }
  }

  if (segments.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        No transcript segments yet.
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {segments.map((seg) => (
        <SegmentRow
          key={seg.id}
          segment={seg}
          speakerLabel={
            speakerLookup.get(seg.pseudo_id ?? seg.speaker_pseudo_id ?? "") ??
            (seg.pseudo_id ?? seg.speaker_pseudo_id ?? "unknown").slice(0, 8)
          }
          canEdit={!!canEdit[seg.id]}
          onSave={(updated) =>
            setSegments((prev) =>
              prev.map((s) => (s.id === updated.id ? updated : s)),
            )
          }
        />
      ))}
    </div>
  );
}

function SegmentRow({
  segment,
  speakerLabel,
  canEdit,
  onSave,
}: {
  segment: Segment;
  speakerLabel: string;
  canEdit: boolean;
  onSave: (segment: Segment) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(segment.text ?? "");
  const [isPending, startTransition] = useTransition();

  const startMs = segment.start_ms ?? Math.round((segment.start_time ?? 0) * 1000);

  const save = () => {
    startTransition(async () => {
      const res = await fetch(`/api/segments/${segment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        toast.error("Couldn't save segment");
        return;
      }
      const updated = (await res.json()) as Segment;
      onSave(updated);
      setEditing(false);
      toast.success("Saved");
    });
  };

  return (
    <Card className="p-3">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-xs text-muted-foreground">
            {formatTime(startMs / 1000)}
          </span>
          <span className="font-medium">{speakerLabel}</span>
        </div>
        {canEdit && !editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>
      {editing ? (
        <div className="mt-2 space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={Math.max(3, Math.ceil(text.length / 60))}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={isPending}>
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setText(segment.text ?? "");
                setEditing(false);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-1 whitespace-pre-wrap">
          {segment.text || <em className="text-muted-foreground">(empty)</em>}
        </p>
      )}
    </Card>
  );
}
