"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useAudioPlayback,
  type PlaybackRate,
} from "@/hooks/use-audio-playback";
import type { Participant, Segment } from "@/lib/schemas/data-api";

/* ---------------- Speaker labels + colors ---------------- */

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

/* ---------------- Block grouping ---------------- */

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

/* ---------------- Helpers ---------------- */

async function patchSegment(segmentId: string, text: string): Promise<Segment> {
  const res = await fetch(`/api/segments/${segmentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`PATCH segment ${res.status}`);
  return (await res.json()) as Segment;
}

const RATE_PRESETS: PlaybackRate[] = [0.5, 0.75, 1, 1.25, 1.5, 2];

function findActiveSegmentIdx(segments: Segment[], timeMs: number): number {
  // Linear scan is fine for typical session size (few hundred segments).
  // The worst-case is O(n) per timeupdate tick (~4 per second); still
  // cheap. Switch to bisection if sessions ever run into the thousands.
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (timeMs >= s.start_ms && timeMs < s.end_ms) return i;
    if (s.start_ms > timeMs) return Math.max(0, i - 1);
  }
  return segments.length - 1;
}

/* ---------------- Component ---------------- */

interface Props {
  sessionId: string;
  initialSegments: Segment[];
  initialParticipants: Participant[];
  audioSrc: string;
  canEdit: Record<string, boolean>;
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
  const segmentRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const audio = useAudioPlayback(audioRef);

  const { byPid, gmPid } = useMemo(
    () => buildSpeakerMap(segments, initialParticipants),
    [segments, initialParticipants],
  );

  const blocks = useMemo(() => buildBlocks(segments), [segments]);

  // Track the segment whose time window contains currentTime for
  // active-block highlighting. Updates as playback progresses.
  const activeSegmentIdx = useMemo(
    () => (audio.playing ? findActiveSegmentIdx(segments, audio.currentTimeMs) : -1),
    [segments, audio.currentTimeMs, audio.playing],
  );
  const activeSegmentId =
    activeSegmentIdx >= 0 ? segments[activeSegmentIdx]?.id ?? null : null;

  // When the active block leaves the viewport, auto-scroll it back in.
  // Keep the scroll cheap: only fire when id changes, and use smooth
  // scroll only if the element is noticeably off-screen.
  const lastScrolledIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeSegmentId || activeSegmentId === lastScrolledIdRef.current) return;
    const el = segmentRefs.current[activeSegmentId];
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    if (r.bottom < 80 || r.top > vh - 80) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    lastScrolledIdRef.current = activeSegmentId;
  }, [activeSegmentId]);

  const startEdit = useCallback(
    (seg: Segment) => {
      if (!canEdit[seg.id]) return;
      setEditingId(seg.id);
      setEditText(seg.text ?? "");
    },
    [canEdit],
  );

  const saveEdit = useCallback(
    async (seg: Segment) => {
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
    },
    [editText],
  );

  const playSegment = useCallback(
    (seg: Segment) => audio.playSegmentMs(seg.start_ms, seg.end_ms),
    [audio],
  );

  // Keyboard shortcuts — disabled while typing into an input/textarea
  // so the user can still edit. Shortcuts:
  //   space   play/pause
  //   j / k   prev / next segment (seek)
  //   .       replay current segment
  //   e       edit the currently-active segment (if editable)
  //   + / -   bump playback rate up / down through presets
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const tgt = ev.target as HTMLElement | null;
      const typing =
        tgt &&
        (tgt.tagName === "INPUT" ||
          tgt.tagName === "TEXTAREA" ||
          tgt.isContentEditable);
      if (typing) return;

      const curIdx = findActiveSegmentIdx(segments, audio.currentTimeMs);

      if (ev.code === "Space") {
        ev.preventDefault();
        audio.togglePlay();
      } else if (ev.key === "j") {
        ev.preventDefault();
        const prev = segments[Math.max(0, curIdx - 1)];
        if (prev) audio.playFromMs(prev.start_ms);
      } else if (ev.key === "k") {
        ev.preventDefault();
        const nxt = segments[Math.min(segments.length - 1, curIdx + 1)];
        if (nxt) audio.playFromMs(nxt.start_ms);
      } else if (ev.key === ".") {
        ev.preventDefault();
        const cur = segments[curIdx];
        if (cur) playSegment(cur);
      } else if (ev.key === "e") {
        ev.preventDefault();
        const cur = segments[curIdx];
        if (cur && canEdit[cur.id]) startEdit(cur);
      } else if (ev.key === "+" || ev.key === "=") {
        ev.preventDefault();
        const i = RATE_PRESETS.indexOf(audio.playbackRate);
        if (i < RATE_PRESETS.length - 1) audio.setPlaybackRate(RATE_PRESETS[i + 1]);
      } else if (ev.key === "-") {
        ev.preventDefault();
        const i = RATE_PRESETS.indexOf(audio.playbackRate);
        if (i > 0) audio.setPlaybackRate(RATE_PRESETS[i - 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [audio, segments, canEdit, playSegment, startEdit]);

  if (segments.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
        No transcript segments yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-2 z-10 space-y-2 rounded bg-background/95 p-2 shadow">
        <audio
          ref={audioRef}
          controls
          className="w-full"
          src={audioSrc}
          preload="metadata"
        />
        <PlaybackToolbar audio={audio} segments={segments} />
      </div>

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
              activeSegmentId={activeSegmentId}
              segmentRefs={segmentRefs}
              seekTo={audio.seekMs}
              playSegment={playSegment}
            />
          ) : (
            <OverlapBlock
              key={`o-${block.startMs}-${idx}`}
              block={block}
              byPid={byPid}
              gmPid={gmPid}
              activeSegmentId={activeSegmentId}
              segmentRefs={segmentRefs}
              seekTo={audio.seekMs}
              playSegment={playSegment}
            />
          ),
        )}
      </div>
    </div>
  );
}

/* ---------------- PlaybackToolbar — rate control + shortcut hint ---------------- */

function PlaybackToolbar({
  audio,
  segments,
}: {
  audio: ReturnType<typeof useAudioPlayback>;
  segments: Segment[];
}) {
  const activeIdx = audio.playing
    ? findActiveSegmentIdx(segments, audio.currentTimeMs)
    : -1;
  const total = segments.length;

  return (
    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-3">
        <span>
          {audio.playing
            ? activeIdx >= 0
              ? `Segment ${activeIdx + 1} / ${total}`
              : "Playing"
            : "Paused"}
        </span>
        <span className="opacity-70">
          <kbd className="rounded border px-1">Space</kbd> play ·{" "}
          <kbd className="rounded border px-1">j</kbd>/<kbd className="rounded border px-1">k</kbd>{" "}
          prev/next · <kbd className="rounded border px-1">.</kbd> replay ·{" "}
          <kbd className="rounded border px-1">e</kbd> edit ·{" "}
          <kbd className="rounded border px-1">+</kbd>/<kbd className="rounded border px-1">-</kbd>{" "}
          speed
        </span>
      </div>
      <div className="flex items-center gap-1">
        <span className="mr-1">speed</span>
        {RATE_PRESETS.map((r) => (
          <button
            key={r}
            onClick={() => audio.setPlaybackRate(r)}
            className={
              "rounded px-1.5 py-0.5 text-[11px] " +
              (audio.playbackRate === r
                ? "bg-primary text-primary-foreground"
                : "border hover:bg-accent")
            }
            title={`Set playback rate to ${r}x`}
          >
            {r}×
          </button>
        ))}
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
  activeSegmentId,
  segmentRefs,
  seekTo,
  playSegment,
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
  canEdit: Record<string, boolean>;
  activeSegmentId: string | null;
  segmentRefs: React.RefObject<Record<string, HTMLDivElement | null>>;
  seekTo: (ms: number) => void;
  playSegment: (seg: Segment) => void;
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
          const editable = canEdit[seg.id] ?? false;
          const isActive = activeSegmentId === seg.id;
          return (
            <div
              key={seg.id}
              ref={(el) => {
                segmentRefs.current[seg.id] = el;
              }}
              className={
                "group relative flex gap-2 rounded px-1 transition-colors " +
                (isActive ? "bg-accent/60" : "")
              }
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
                <>
                  <p
                    className={
                      "flex-1 text-sm leading-relaxed " +
                      (editable ? "cursor-text hover:bg-accent/30 rounded" : "")
                    }
                    title={editable ? "Double-click to edit" : undefined}
                  >
                    {seg.text ?? <em className="text-muted-foreground">(no text)</em>}
                  </p>
                  <button
                    className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
                    onClick={() => playSegment(seg)}
                    title="Play this segment (.)"
                  >
                    ▶
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- OverlapBlock ---------------- */

function OverlapBlock({
  block,
  byPid,
  gmPid,
  activeSegmentId,
  segmentRefs,
  seekTo,
  playSegment,
}: {
  block: Extract<Block, { type: "overlap" }>;
  byPid: Record<string, SpeakerMeta>;
  gmPid: string;
  activeSegmentId: string | null;
  segmentRefs: React.RefObject<Record<string, HTMLDivElement | null>>;
  seekTo: (ms: number) => void;
  playSegment: (seg: Segment) => void;
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
          {segs.map((seg) => {
            const isActive = activeSegmentId === seg.id;
            return (
              <div
                key={seg.id}
                ref={(el) => {
                  segmentRefs.current[seg.id] = el;
                }}
                className={
                  "group relative flex gap-2 rounded px-1 transition-colors " +
                  (isActive ? "bg-accent/60" : "")
                }
              >
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
                <button
                  className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
                  onClick={() => playSegment(seg)}
                  title="Play this segment (.)"
                >
                  ▶
                </button>
              </div>
            );
          })}
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
