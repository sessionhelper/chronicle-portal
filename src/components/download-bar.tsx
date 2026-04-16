"use client";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
import type { Segment, Participant } from "@/lib/schemas/data-api";

function formatTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function segmentsToText(
  segments: Segment[],
  participants: Participant[],
): string {
  const nameMap = new Map<string, string>();
  for (const p of participants) {
    if (p.user_pseudo_id) {
      nameMap.set(p.user_pseudo_id, p.display_name || p.user_pseudo_id);
    }
  }
  return segments
    .map((s) => {
      const speaker = s.pseudo_id
        ? (nameMap.get(s.pseudo_id) ?? s.pseudo_id)
        : s.speaker_pseudo_id
          ? (nameMap.get(s.speaker_pseudo_id) ?? s.speaker_pseudo_id)
          : "Unknown";
      return `[${formatTimestamp(s.start_ms ?? 0)} - ${formatTimestamp(s.end_ms ?? 0)}] ${speaker}: ${s.text ?? ""}`;
    })
    .join("\n");
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DownloadBar({
  sessionId,
  sessionName,
  segments,
  participants,
  userPseudoId,
  isAdmin,
}: {
  sessionId: string;
  sessionName: string;
  segments: Segment[];
  participants: Participant[];
  userPseudoId: string;
  isAdmin: boolean;
}) {
  const [downloading, setDownloading] = useState(false);
  const safeName = sessionName.replace(/[^a-zA-Z0-9-_ ]/g, "").slice(0, 40) || sessionId.slice(0, 8);

  function handleTranscriptJson() {
    downloadBlob(
      JSON.stringify(segments, null, 2),
      `${safeName}-transcript.json`,
      "application/json",
    );
    toast.success("Transcript downloaded (JSON)");
  }

  function handleTranscriptText() {
    downloadBlob(
      segmentsToText(segments, participants),
      `${safeName}-transcript.txt`,
      "text/plain",
    );
    toast.success("Transcript downloaded (text)");
  }

  async function handleAudioDownload(pseudoId: string, label: string) {
    setDownloading(true);
    try {
      const res = await fetch(
        `/api/sessions/${sessionId}/audio/${pseudoId}/stream`,
      );
      if (!res.ok) {
        toast.error(`Audio download failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}-${label}.wav`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${label} audio downloaded`);
    } catch {
      toast.error("Network error during download");
    } finally {
      setDownloading(false);
    }
  }

  const visibleParticipants = isAdmin
    ? participants
    : participants.filter((p) => p.user_pseudo_id === userPseudoId);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" onClick={handleTranscriptJson}>
        Transcript (JSON)
      </Button>
      <Button variant="secondary" size="sm" onClick={handleTranscriptText}>
        Transcript (text)
      </Button>
      {visibleParticipants.map((p) => (
        <Button
          key={p.user_pseudo_id ?? "unknown"}
          variant="secondary"
          size="sm"
          disabled={downloading}
          onClick={() =>
            handleAudioDownload(
              p.user_pseudo_id ?? "",
              p.display_name || p.user_pseudo_id || "audio",
            )
          }
        >
          {p.display_name || p.user_pseudo_id?.slice(0, 8) || "Audio"} (WAV)
        </Button>
      ))}
      <Button
        variant="secondary"
        size="sm"
        disabled={downloading}
        onClick={() => handleAudioDownload("mixed", "mixed")}
      >
        Mixed audio (WAV)
      </Button>
    </div>
  );
}
