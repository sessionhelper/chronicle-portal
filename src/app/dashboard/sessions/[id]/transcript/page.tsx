"use client";

import { useCallback, useEffect, useState, useMemo, use } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { formatDate, formatDuration } from "@/lib/format";
import { useTranscript } from "@/hooks/use-transcript";
import { useAudioPlayback } from "@/hooks/use-audio-playback";
import { PlaybackControls } from "@/components/transcript/playback-controls";
import { TranscriptList } from "@/components/transcript/transcript-list";
import type { SessionDetail, TranscriptSegment } from "@/lib/types";

export default function TranscriptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  const { segments, loading, error, flagSegment, unflagSegment, editSegment } =
    useTranscript(id);
  const audio = useAudioPlayback(id);

  // Derive which segment is playing based on currentTime
  const playingSegId = useMemo(() => {
    if (!audio.playing) return null;
    const t = audio.currentTime;
    const seg = segments.find((s) => t >= s.start_time && t < s.end_time);
    return seg?.id ?? null;
  }, [audio.playing, audio.currentTime, segments]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api.sessions.get(id);
        if (!cancelled) setSession(data);
      } catch {
        // Session metadata is non-critical for transcript viewing
      } finally {
        if (!cancelled) setSessionLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleFlag(segmentId: string) {
    try {
      await flagSegment(segmentId);
      toast.success("Segment flagged as private info");
    } catch {
      toast.error("Failed to flag segment");
    }
  }

  async function handleUnflag(segmentId: string) {
    try {
      await unflagSegment(segmentId);
      toast.success("Flag removed");
    } catch {
      toast.error("Failed to remove flag");
    }
  }

  async function handleEdit(segmentId: string, newText: string) {
    try {
      await editSegment(segmentId, newText);
      toast.success("Segment updated");
    } catch {
      toast.error("Failed to update segment");
    }
  }

  const durationSeconds = useCallback((): number => {
    if (!session?.ended_at) return 0;
    return (
      (new Date(session.ended_at).getTime() -
        new Date(session.started_at).getTime()) /
      1000
    );
  }, [session]);

  // Set session duration on the audio hook from session metadata
  useEffect(() => {
    const dur = durationSeconds();
    if (dur > 0) audio.setDuration(dur);
  }, [durationSeconds, audio]);

  if (loading || sessionLoading) {
    return (
      <p className="font-sans text-sm text-ink-faint">Loading transcript...</p>
    );
  }

  if (error) {
    return (
      <div className="rounded border border-danger/20 bg-danger/5 px-4 py-3">
        <p className="font-sans text-sm text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Session header */}
      {session && (
        <div className="flex items-baseline gap-4 font-sans text-sm">
          <span className="text-ink">{formatDate(session.started_at)}</span>
          {session.ended_at && (
            <span className="text-ink-faint">
              {formatDuration(durationSeconds())}
            </span>
          )}
          {session.game_system && (
            <span className="text-ink-faint">{session.game_system}</span>
          )}
          <span className="text-ink-faint">
            {session.participant_count} participants
          </span>
        </div>
      )}

      {/* Playback controls */}
      <PlaybackControls
        playing={audio.playing}
        currentTime={audio.currentTime}
        duration={durationSeconds() || audio.duration}
        loading={audio.loading}
        error={audio.error}
        onTogglePlay={audio.togglePlay}
        onStop={audio.stop}
        onSeek={audio.seek}
      />

      {/* Transcript */}
      <div className="rounded border border-rule bg-card-surface">
        <TranscriptList
          segments={segments}
          playingSegId={playingSegId}
          onPlayClip={(seg: TranscriptSegment) => audio.playSegment(seg.start_time, seg.end_time)}
          onPlayFrom={(startTime) => audio.playFrom(startTime)}
          onFlag={handleFlag}
          onUnflag={handleUnflag}
          onEdit={handleEdit}
        />
      </div>
    </div>
  );
}
