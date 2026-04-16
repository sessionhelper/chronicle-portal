"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";

import type { Participant, Segment } from "@/lib/schemas/data-api";

/* ---------------- Speaker labels + colors ---------------- */

// 6 stable hues — GM gets warm brown (30°), others rotate.
const ACCENT_HUES = [30, 210, 140, 270, 350, 50];

interface SpeakerMeta {
  label: string;
  hue: number;
}

function buildSpeakerMap(
  segments: Segment[],
  participants: Participant[],
): { byPid: Record<string, SpeakerMeta>; gmPid: string } {
  const seen: string[] = [];
  for (const s of segments) {
    if (!seen.includes(s.pseudo_id)) seen.push(s.pseudo_id);
  }
  const counts: Record<string, number> = {};
  for (const s of segments) counts[s.pseudo_id] = (counts[s.pseudo_id] || 0) + 1;
  const ordered = [...seen].sort((a, b) => (counts[b] || 0) - (counts[a] || 0));
  const gmPid = ordered[0] || "";

  const metaByPid = new Map<string, Participant>();
  for (const p of participants) {
    const key = p.user_pseudo_id ?? p.pseudo_id;
    if (key) metaByPid.set(key, p);
  }

  const byPid: Record<string, SpeakerMeta> = {};
  for (let i = 0; i < ordered.length; i++) {
    const pid = ordered[i];
    const meta = metaByPid.get(pid);
    let label = pid.slice(0, 8);
    if (meta?.character_name && meta.display_name) {
      label = `${meta.character_name} (${meta.display_name})`;
    } else if (meta?.character_name) {
      label = meta.character_name;
    } else if (meta?.display_name) {
      label = meta.display_name;
    }
    byPid[pid] = { label, hue: ACCENT_HUES[i % ACCENT_HUES.length] };
  }
  return { byPid, gmPid };
}

function speakerColor(meta: SpeakerMeta | undefined): string {
  if (!meta) return "hsl(0, 0%, 60%)";
  return `hsl(${meta.hue}, 55%, 45%)`;
}

function fmtTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function confDot(conf: number | null | undefined): string {
  if (conf === null || conf === undefined) return "transparent";
  if (conf > -0.25) return "#22c55e";
  if (conf > -0.5) return "#a3a3a3";
  if (conf > -0.75) return "#f59e0b";
  return "#ef4444";
}

/* ---------------- Block grouping with overlap detection ---------------- */

type Block =
  | { type: "single"; pid: string; segments: Segment[]; startMs: number; endMs: number }
  | { type: "overlap"; segments: Segment[]; startMs: number; endMs: number };

function segmentsOverlap(a: Segment, b: Segment): boolean {
  return a.start_ms < b.end_ms && b.start_ms < a.end_ms;
}

function buildBlocks(segments: Segment[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  while (i < segments.length) {
    const seg = segments[i];
    const batch = [seg];
    let j = i + 1;
    while (j < segments.length) {
      const cand = segments[j];
      const overlaps = batch.some(
        (b) => segmentsOverlap(cand, b) && cand.pseudo_id !== b.pseudo_id,
      );
      if (overlaps) {
        batch.push(cand);
        j++;
      } else break;
    }
    const speakers = new Set(batch.map((s) => s.pseudo_id));
    if (speakers.size > 1) {
      blocks.push({
        type: "overlap",
        segments: batch,
        startMs: Math.min(...batch.map((s) => s.start_ms)),
        endMs: Math.max(...batch.map((s) => s.end_ms)),
      });
      i = j;
    } else {
      const pid = seg.pseudo_id;
      const group: Segment[] = [seg];
      let k = j;
      while (k < segments.length && segments[k].pseudo_id === pid) {
        const nxt = segments[k];
        let breakHere = false;
        for (let look = k + 1; look < Math.min(k + 3, segments.length); look++) {
          if (
            segments[look].pseudo_id !== pid &&
            segmentsOverlap(nxt, segments[look])
          ) {
            breakHere = true;
            break;
          }
        }
        if (breakHere) break;
        group.push(segments[k]);
        k++;
      }
      blocks.push({
        type: "single",
        pid,
        segments: group,
        startMs: group[0].start_ms,
        endMs: group[group.length - 1].end_ms,
      });
      i = k;
    }
  }
  return blocks;
}

/* ---------------- Edit handling ---------------- */

async function patchSegment(segmentId: string, text: string): Promise<Segment> {
  const res = await fetch(`/api/segments/${segmentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`PATCH segment ${res.status}`);
  return (await res.json()) as Segment;
}

/* ---------------- Component ---------------- */

interface Props {
  sessionId: string;
  initialSegments: Segment[];
  initialParticipants: Participant[];
  audioSrc: string;
  canEdit: (seg: Segment) => boolean;
}

export function TranscriptViewer({
  sessionId: _sessionId,
  initialSegments,
  initialParticipants,
  audioSrc,
  canEdit,
}: Props) {
  const [segments, setSegments] = useState<Segment[]>(() =>
    [...initialSegments].sort((a, b) => a.start_ms - b.start_ms),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const { byPid, gmPid } = useMemo(
    () => buildSpeakerMap(segments, initialParticipants),
    [segments, initialParticipants],
  );

  const blocks = useMemo(() => buildBlocks(segments), [segments]);

  const seekTo = useCallback((ms: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = ms / 1000;
    void a.play();
  }, []);

  const startEdit = (seg: Segment) => {
    if (!canEdit(seg)) return;
    setEditingId(seg.id);
    setEditText(seg.text ?? "");
  };

  const saveEdit = async (seg: Segment) => {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === (seg.text ?? "")) {
      setEditingId(null);
      return;
    }
    setSavingId(seg.id);
    try {
      const updated = await patchSegment(seg.id, trimmed);
      setSegments((prev) =>
        prev.map((s) => (s.id === seg.id ? { ...s, ...updated } : s)),
      );
      setEditingId(null);
    } catch (err) {
      console.error("save edit failed", err);
    } finally {
      setSavingId(null);
    }
  };

  if (segments.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
        No transcript segments yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <audio
        ref={audioRef}
        controls
        className="sticky top-2 z-10 w-full rounded bg-background/95 shadow"
        src={audioSrc}
        preload="metadata"
      />

      <div className="space-y-3">
        {blocks.map((block, idx) =>
          block.type === "single" ? (
            <SingleBlock
              key={`s-${block.startMs}-${idx}`}
              block={block}
              speaker={byPid[block.pid]}
              isGM={block.pid === gmPid}
              editingId={editingId}
              editText={editText}
              setEditText={setEditText}
              startEdit={startEdit}
              saveEdit={saveEdit}
              cancelEdit={() => setEditingId(null)}
              savingId={savingId}
              canEdit={canEdit}
              seekTo={seekTo}
            />
          ) : (
            <OverlapBlock
              key={`o-${block.startMs}-${idx}`}
              block={block}
              byPid={byPid}
              gmPid={gmPid}
              seekTo={seekTo}
            />
          ),
        )}
      </div>
    </div>
  );
}

/* ---------------- SingleBlock ---------------- */

function SingleBlock({
  block,
  speaker,
  isGM,
  editingId,
  editText,
  setEditText,
  startEdit,
  saveEdit,
  cancelEdit,
  savingId,
  canEdit,
  seekTo,
}: {
  block: Extract<Block, { type: "single" }>;
  speaker: SpeakerMeta | undefined;
  isGM: boolean;
  editingId: string | null;
  editText: string;
  setEditText: (s: string) => void;
  startEdit: (seg: Segment) => void;
  saveEdit: (seg: Segment) => Promise<void>;
  cancelEdit: () => void;
  savingId: string | null;
  canEdit: (seg: Segment) => boolean;
  seekTo: (ms: number) => void;
}) {
  const accent = speakerColor(speaker);
  return (
    <div
      className="rounded-md border p-3 transition-shadow hover:shadow-sm"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold" style={{ color: accent }}>
            {speaker?.label ?? block.pid.slice(0, 8)}
          </span>
          {isGM && (
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              GM
            </span>
          )}
        </div>
        <button
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() => seekTo(block.startMs)}
          title="Jump to this point in the audio"
        >
          {fmtTime(block.startMs / 1000)}
        </button>
      </div>
      <div className="space-y-1.5">
        {block.segments.map((seg) => {
          const isEditing = editingId === seg.id;
          const editable = canEdit(seg);
          return (
            <div
              key={seg.id}
              className="group flex gap-2"
              onDoubleClick={() => editable && startEdit(seg)}
            >
              <button
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full opacity-60 hover:opacity-100"
                style={{ backgroundColor: confDot(seg.confidence) }}
                title={
                  seg.confidence !== null && seg.confidence !== undefined
                    ? `confidence ${seg.confidence.toFixed(2)}`
                    : "confidence unknown"
                }
                onClick={() => seekTo(seg.start_ms)}
              />
              {isEditing ? (
                <div className="flex-1 space-y-2">
                  <textarea
                    className="w-full rounded border bg-background p-2 text-sm"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={Math.max(2, Math.ceil(editText.length / 80))}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
                      disabled={savingId === seg.id}
                      onClick={() => void saveEdit(seg)}
                    >
                      {savingId === seg.id ? "Saving…" : "Save"}
                    </button>
                    <button
                      className="rounded border px-2 py-1 text-xs"
                      onClick={cancelEdit}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p
                  className={
                    "flex-1 text-sm leading-relaxed " +
                    (editable
                      ? "cursor-text rounded px-1 hover:bg-accent/30"
                      : "")
                  }
                  title={editable ? "Double-click to edit" : undefined}
                >
                  {seg.text ?? <em className="text-muted-foreground">(no text)</em>}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- OverlapBlock — side-by-side columns ---------------- */

function OverlapBlock({
  block,
  byPid,
  gmPid,
  seekTo,
}: {
  block: Extract<Block, { type: "overlap" }>;
  byPid: Record<string, SpeakerMeta>;
  gmPid: string;
  seekTo: (ms: number) => void;
}) {
  const groups = new Map<string, Segment[]>();
  for (const s of block.segments) {
    const arr = groups.get(s.pseudo_id) ?? [];
    arr.push(s);
    groups.set(s.pseudo_id, arr);
  }
  const speakers = [...groups.keys()];
  const left = speakers.includes(gmPid) ? gmPid : speakers[0];
  const rights = speakers.filter((s) => s !== left);

  const Column = ({ pid }: { pid: string }) => {
    const meta = byPid[pid];
    const accent = speakerColor(meta);
    const segs = groups.get(pid) ?? [];
    return (
      <div
        className="flex-1 rounded-md border p-3"
        style={{ borderLeft: `3px solid ${accent}` }}
      >
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className="font-semibold" style={{ color: accent }}>
            {meta?.label ?? pid.slice(0, 8)}
          </span>
          <button
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => seekTo(segs[0].start_ms)}
          >
            {fmtTime(segs[0].start_ms / 1000)}
          </button>
        </div>
        <div className="space-y-1.5">
          {segs.map((seg) => (
            <div key={seg.id} className="flex gap-2">
              <button
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full opacity-60"
                style={{ backgroundColor: confDot(seg.confidence) }}
                onClick={() => seekTo(seg.start_ms)}
              />
              <p className="flex-1 text-sm leading-relaxed">
                {seg.text ?? (
                  <em className="text-muted-foreground">(no text)</em>
                )}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        ↔ Concurrent
      </div>
      <div className="flex flex-col gap-2 md:flex-row">
        <Column pid={left} />
        {rights.map((pid) => (
          <Column key={pid} pid={pid} />
        ))}
      </div>
    </div>
  );
}
