"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDuration, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChevronLeftIcon } from "lucide-react";
import type {
  DataApiSession,
  DataApiSegment,
  DataApiBeat,
  DataApiScene,
  DataApiParticipant,
} from "@/lib/data-api";

type Tab = "transcript" | "beats" | "scenes" | "participants" | "raw";

const TABS: { key: Tab; label: string }[] = [
  { key: "transcript", label: "Transcript" },
  { key: "beats", label: "Beats" },
  { key: "scenes", label: "Scenes" },
  { key: "participants", label: "Participants" },
  { key: "raw", label: "Raw Data" },
];

/** Deterministic color for a speaker pseudo_id. */
const SPEAKER_COLORS = [
  "text-[#8b4513]",
  "text-[#2e6b3a]",
  "text-[#4a3b8f]",
  "text-[#8f3b5e]",
  "text-[#3b6e8f]",
  "text-[#8f6e3b]",
  "text-[#3b8f7a]",
  "text-[#6e3b8f]",
];

function speakerColor(pseudoId: string, speakers: string[]): string {
  const idx = speakers.indexOf(pseudoId);
  return SPEAKER_COLORS[idx >= 0 ? idx % SPEAKER_COLORS.length : 0];
}

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [activeTab, setActiveTab] = useState<Tab>("transcript");
  const [session, setSession] = useState<DataApiSession | null>(null);
  const [segments, setSegments] = useState<DataApiSegment[]>([]);
  const [beats, setBeats] = useState<DataApiBeat[]>([]);
  const [scenes, setScenes] = useState<DataApiScene[]>([]);
  const [participants, setParticipants] = useState<DataApiParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchJson<T>(path: string): Promise<T> {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return res.json();
    }

    async function load() {
      try {
        const [s, seg, b, sc, p] = await Promise.all([
          fetchJson<DataApiSession>(`/api/sessions/${id}`),
          fetchJson<DataApiSegment[]>(`/api/sessions/${id}/segments`),
          fetchJson<DataApiBeat[]>(`/api/sessions/${id}/beats`),
          fetchJson<DataApiScene[]>(`/api/sessions/${id}/scenes`),
          fetchJson<DataApiParticipant[]>(`/api/sessions/${id}/participants`),
        ]);
        if (!cancelled) {
          setSession(s);
          seg.sort((a, b) => a.segment_index - b.segment_index);
          setSegments(seg);
          beats.sort((a, b) => a.start_time - b.start_time);
          setBeats(b);
          setScenes(sc);
          setParticipants(p);
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load session");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const duration =
    session?.ended_at
      ? (new Date(session.ended_at).getTime() -
          new Date(session.started_at).getTime()) /
        1000
      : 0;

  const speakers = Array.from(
    new Set(segments.map((s) => s.speaker_pseudo_id))
  );

  // Build beat/scene lookup for transcript markers
  const beatById = new Map(beats.map((b) => [b.id, b]));
  const sceneById = new Map(scenes.map((s) => [s.id, s]));

  return (
    <AppShell>
      {/* Back link */}
      <Link
        href="/sessions"
        className="inline-flex items-center gap-1 font-sans text-sm text-ink-faint hover:text-ink-light transition-colors duration-100"
      >
        <ChevronLeftIcon className="size-3.5" />
        Back to sessions
      </Link>

      {loading ? (
        <p className="mt-4 font-sans text-sm text-ink-faint">Loading...</p>
      ) : error ? (
        <div className="mt-4 rounded border border-danger/20 bg-danger/5 px-4 py-3">
          <p className="font-sans text-sm text-danger">{error}</p>
        </div>
      ) : session ? (
        <>
          {/* Header */}
          <div className="mt-4 rounded border border-rule bg-card-surface p-4">
            <div className="flex items-start justify-between gap-4">
              <h1 className="font-serif text-lg font-semibold text-ink">
                Session {formatDate(session.started_at)}
              </h1>
              <Badge variant="secondary" className="font-sans text-[10px]">
                {session.status}
              </Badge>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 font-sans text-sm sm:grid-cols-4">
              <div>
                <span className="text-ink-faint">Date</span>
                <p className="text-ink">{formatDate(session.started_at)}</p>
              </div>
              <div>
                <span className="text-ink-faint">Duration</span>
                <p className="text-ink">
                  {session.ended_at ? formatDuration(duration) : "In progress"}
                </p>
              </div>
              <div>
                <span className="text-ink-faint">Participants</span>
                <p className="text-ink">{session.participant_count}</p>
              </div>
              <div>
                <span className="text-ink-faint">Segments</span>
                <p className="text-ink">{session.segment_count}</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-0 border-b border-rule">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "px-3 py-2 font-sans text-sm transition-colors duration-100",
                  activeTab === tab.key
                    ? "border-b-2 border-accent-brown text-ink font-medium"
                    : "text-ink-faint hover:text-ink-light"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="mt-4">
            {activeTab === "transcript" && (
              <TranscriptTab
                segments={segments}
                speakers={speakers}
                beatById={beatById}
                sceneById={sceneById}
              />
            )}
            {activeTab === "beats" && <BeatsTab beats={beats} />}
            {activeTab === "scenes" && <ScenesTab scenes={scenes} />}
            {activeTab === "participants" && (
              <ParticipantsTab participants={participants} />
            )}
            {activeTab === "raw" && (
              <RawDataTab session={session} segments={segments} />
            )}
          </div>
        </>
      ) : null}
    </AppShell>
  );
}

// --- Tab Components ---

function TranscriptTab({
  segments,
  speakers,
  beatById,
  sceneById,
}: {
  segments: DataApiSegment[];
  speakers: string[];
  beatById: Map<string, DataApiBeat>;
  sceneById: Map<string, DataApiScene>;
}) {
  if (segments.length === 0) {
    return (
      <p className="font-sans text-sm text-ink-light">
        No transcript segments available.
      </p>
    );
  }

  // Track which beats/scenes we've already rendered markers for
  const renderedBeats = new Set<string>();
  const renderedScenes = new Set<string>();

  return (
    <div className="rounded border border-rule bg-card-surface">
      {segments.map((seg) => {
        const markers: React.ReactNode[] = [];

        // Scene marker
        if (seg.scene_id && !renderedScenes.has(seg.scene_id)) {
          const scene = sceneById.get(seg.scene_id);
          if (scene) {
            renderedScenes.add(seg.scene_id);
            markers.push(
              <div
                key={`scene-${scene.id}`}
                className="border-b border-rule bg-parchment-dark px-4 py-1.5"
              >
                <span className="font-sans text-xs font-medium text-ink-light">
                  Scene: {scene.title}
                </span>
              </div>
            );
          }
        }

        // Beat marker
        if (seg.beat_id && !renderedBeats.has(seg.beat_id)) {
          const beat = beatById.get(seg.beat_id);
          if (beat) {
            renderedBeats.add(seg.beat_id);
            markers.push(
              <div
                key={`beat-${beat.id}`}
                className="border-b border-rule/50 bg-parchment px-4 py-1"
              >
                <span className="font-sans text-[11px] text-ink-faint">
                  Beat: {beat.title}
                </span>
              </div>
            );
          }
        }

        return (
          <div key={seg.id}>
            {markers}
            <div className="flex gap-3 border-b border-rule/30 px-4 py-2">
              <span className="shrink-0 font-sans text-[11px] text-ink-faint tabular-nums">
                {formatTime(seg.start_time)}
              </span>
              <span
                className={cn(
                  "shrink-0 font-sans text-xs font-medium w-20 truncate",
                  speakerColor(seg.speaker_pseudo_id, speakers)
                )}
                title={seg.speaker_pseudo_id}
              >
                {seg.speaker_pseudo_id}
              </span>
              <p className="font-serif text-sm text-ink leading-relaxed">
                {seg.text}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BeatsTab({ beats }: { beats: DataApiBeat[] }) {
  if (beats.length === 0) {
    return (
      <p className="font-sans text-sm text-ink-light">
        No beats available for this session.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {beats.map((beat) => (
        <div
          key={beat.id}
          className="rounded border border-rule bg-card-surface p-3"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-serif text-sm font-medium text-ink">
              {beat.title}
            </h3>
            <Badge variant="secondary" className="font-sans text-[10px]">
              {beat.segment_count} segments
            </Badge>
          </div>
          <p className="mt-1 font-sans text-xs text-ink-faint">
            {formatTime(beat.start_time)} &ndash; {formatTime(beat.end_time)}
          </p>
        </div>
      ))}
    </div>
  );
}

function ScenesTab({ scenes }: { scenes: DataApiScene[] }) {
  if (scenes.length === 0) {
    return (
      <p className="font-sans text-sm text-ink-light">
        No scenes available for this session.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {scenes.map((scene) => (
        <div
          key={scene.id}
          className="rounded border border-rule bg-card-surface p-3"
        >
          <h3 className="font-serif text-sm font-medium text-ink">
            {scene.title}
          </h3>
          <div className="mt-1 flex gap-4 font-sans text-xs text-ink-faint">
            <span>
              {formatTime(scene.start_time)} &ndash;{" "}
              {formatTime(scene.end_time)}
            </span>
            <span>
              Beats {scene.beat_start_index}&ndash;{scene.beat_end_index}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ParticipantsTab({
  participants,
}: {
  participants: DataApiParticipant[];
}) {
  if (participants.length === 0) {
    return (
      <p className="font-sans text-sm text-ink-light">
        No participant data available.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-rule font-sans text-xs text-ink-faint">
            <th className="pb-2 pr-4 font-medium">Pseudo ID</th>
            <th className="pb-2 pr-4 font-medium">Consent</th>
            <th className="pb-2 pr-4 font-medium">Joined</th>
            <th className="pb-2 pr-4 font-medium">Left</th>
            <th className="pb-2 font-medium">Flags</th>
          </tr>
        </thead>
        <tbody>
          {participants.map((p) => (
            <tr
              key={p.id}
              className="border-b border-rule/50 transition-colors duration-100 hover:bg-parchment-dark"
            >
              <td className="py-2.5 pr-4 font-sans text-sm font-medium text-ink">
                {p.pseudo_id}
              </td>
              <td className="py-2.5 pr-4 font-sans text-sm text-ink-light">
                {p.consent_scope ?? "---"}
              </td>
              <td className="py-2.5 pr-4 font-sans text-sm text-ink-light">
                {formatDate(p.joined_at)}
              </td>
              <td className="py-2.5 pr-4 font-sans text-sm text-ink-light">
                {p.left_at ? formatDate(p.left_at) : "---"}
              </td>
              <td className="py-2.5">
                {p.flags.length > 0 ? (
                  <div className="flex gap-1">
                    {p.flags.map((flag) => (
                      <Badge
                        key={flag}
                        variant="outline"
                        className="font-sans text-[10px]"
                      >
                        {flag}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="font-sans text-sm text-ink-faint">---</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RawDataTab({
  session,
  segments,
}: {
  session: DataApiSession;
  segments: DataApiSegment[];
}) {
  const raw = JSON.stringify({ session, segments }, null, 2);

  return (
    <div className="rounded border border-rule bg-card-surface">
      <pre className="max-h-[600px] overflow-auto p-4 font-mono text-xs text-ink-light leading-relaxed">
        {raw}
      </pre>
    </div>
  );
}
