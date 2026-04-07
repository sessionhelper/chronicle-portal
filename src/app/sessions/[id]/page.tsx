"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Ghost, Flag, Pencil, UserRoundX, Volume2, User, ChevronLeft } from "lucide-react";
import { useSessionEvents } from "@/hooks/use-session-events";
import { AppShell } from "@/components/layout/app-shell";
import Link from "next/link";

interface Segment {
  id: string;
  session_id: string;
  segment_index: number;
  speaker_pseudo_id: string;
  start_time: number;
  end_time: number;
  text: string;
  original_text: string;
  confidence: number | null;
  chunk_group: number | null;
  excluded: boolean;
  exclude_reason: string | null;
}

interface CorrectionLayer {
  text: string;
  timestamp: number;  // Date.now()
  author: string;     // who made the edit
}

// Per-segment edit state: correction history stack
interface SegmentEdits {
  layers: CorrectionLayer[];  // [0] = original whisper, [1..n] = corrections
  activeLayer: number;        // which layer is currently displayed
}

interface PipelineResult {
  segments: Segment[];
  segments_produced: number;
  segments_excluded: number;
  scenes_detected: number;
  duration_processed: number;
}

interface Block {
  type: "single" | "overlap";
  segments: Segment[];
  startTime: number;
  endTime: number;
  showName: boolean;
  // Column layout context: if this block follows an overlap,
  // which column should it render in? null = full width.
  column: "left" | "right" | null;
  // The column layout speakers (set by the preceding overlap)
  columnSpeakers: [string, string] | null;
}

// Speaker names and colors are derived dynamically from the data.
// No hardcoded IDs — works with any session's participants.
const speakerNameCache: Record<string, string> = {};
const speakerAccentCache: Record<string, { light: string; dark: string }> = {};
let gmId = "";

// Accent hues: warm brown (GM), blue, green, purple, red, gold
const ACCENT_HUES = [30, 210, 140, 270, 350, 50];

function initSpeakers(segments: Segment[]) {
  const seen: string[] = [];
  for (const s of segments) {
    if (!seen.includes(s.speaker_pseudo_id)) seen.push(s.speaker_pseudo_id);
  }
  // First speaker with the most segments is likely the GM
  const counts: Record<string, number> = {};
  for (const s of segments) counts[s.speaker_pseudo_id] = (counts[s.speaker_pseudo_id] || 0) + 1;
  const sorted = [...seen].sort((a, b) => (counts[b] || 0) - (counts[a] || 0));
  gmId = sorted[0] || "";

  for (let i = 0; i < seen.length; i++) {
    const id = seen[i];
    // Use pseudo_id as display name, cleaned up
    speakerNameCache[id] = id.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    const hue = ACCENT_HUES[i % ACCENT_HUES.length];
    speakerAccentCache[id] = {
      light: `hsl(${hue}, 55%, 35%)`,
      dark: `hsl(${hue}, 55%, 70%)`,
    };
  }
}

function getSpeakerAccent(id: string): string {
  const colors = speakerAccentCache[id];
  if (!colors) return "#999";
  return colors.light;
}

function speakerName(id: string): string {
  return speakerNameCache[id] ?? id.substring(0, 12);
}

const GM_ID_REF = { get current() { return gmId; } };

function formatTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function confidenceDot(conf: number | null): string {
  if (conf === null) return "#888";
  if (conf > -0.25) return "#22c55e";
  if (conf > -0.5) return "#888";
  if (conf > -0.75) return "#f59e0b";
  return "#ef4444";
}

function segmentsOverlap(a: Segment, b: Segment): boolean {
  return a.start_time < b.end_time && b.start_time < a.end_time;
}

function buildBlocks(segments: Segment[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  let lastSpeaker: string | null = null;
  // Column context from the most recent overlap
  let columnCtx: [string, string] | null = null;

  while (i < segments.length) {
    const seg = segments[i];
    const batch = [seg];
    let j = i + 1;

    while (j < segments.length) {
      const candidate = segments[j];
      const overlaps = batch.some(
        (b) => segmentsOverlap(candidate, b) && candidate.speaker_pseudo_id !== b.speaker_pseudo_id
      );
      if (overlaps) { batch.push(candidate); j++; } else break;
    }

    const speakerSet = new Set(batch.map((s) => s.speaker_pseudo_id));

    if (speakerSet.size > 1) {
      const speakersInBatch: string[] = [];
      for (const s of batch) {
        if (!speakersInBatch.includes(s.speaker_pseudo_id)) speakersInBatch.push(s.speaker_pseudo_id);
      }

      // GM always left. Other speaker goes right.
      const hasGM = speakersInBatch.includes(GM_ID_REF.current);
      if (hasGM) {
        const other = speakersInBatch.find((s) => s !== GM_ID_REF.current) ?? speakersInBatch[0];
        columnCtx = [GM_ID_REF.current, other];
      } else {
        // No GM — preserve existing or use natural order
        const sameAsBefore = columnCtx &&
          speakersInBatch.length === 2 &&
          speakersInBatch.includes(columnCtx[0]) &&
          speakersInBatch.includes(columnCtx[1]);
        if (!sameAsBefore) {
          columnCtx = [speakersInBatch[0], speakersInBatch[1] ?? speakersInBatch[0]];
        }
      }

      blocks.push({
        type: "overlap", segments: batch,
        startTime: Math.min(...batch.map((s) => s.start_time)),
        endTime: Math.max(...batch.map((s) => s.end_time)),
        showName: true,
        column: null,
        columnSpeakers: columnCtx,
      });
      lastSpeaker = null;
    } else {
      const speaker = seg.speaker_pseudo_id;
      const group = [seg];
      let k = j;
      while (k < segments.length && segments[k].speaker_pseudo_id === speaker) {
        const next = segments[k];
        let hasOverlap = false;
        for (let look = k + 1; look < Math.min(k + 3, segments.length); look++) {
          if (segments[look].speaker_pseudo_id !== speaker && segmentsOverlap(next, segments[look])) {
            hasOverlap = true; break;
          }
        }
        if (hasOverlap) break;
        group.push(segments[k]); k++;
      }
      j = k;

      // Inherit column position from the most recent overlap.
      // Thread continues if:
      // 1. Speaker is from the overlap pair
      // 2. Time gap from previous block is < 5 seconds
      // 3. No scene break
      let column: "left" | "right" | null = null;
      if (columnCtx) {
        const prevBlock = blocks[blocks.length - 1];
        const timeSincePrev = prevBlock ? group[0].start_time - prevBlock.endTime : Infinity;
        const prevScene = prevBlock?.segments[0]?.chunk_group ?? null;
        const thisScene = group[0].chunk_group ?? 0;
        const sceneChanged = prevScene !== null && prevScene !== thisScene;

        if (sceneChanged || timeSincePrev > 5) {
          columnCtx = null;
        } else if (speaker === columnCtx[0] || speaker === columnCtx[1]) {
          column = speaker === columnCtx[0] ? "left" : "right";
        } else {
          // New speaker not in the pair — break context
          columnCtx = null;
        }
      }

      blocks.push({
        type: "single", segments: group,
        startTime: group[0].start_time, endTime: group[group.length - 1].end_time,
        showName: speaker !== lastSpeaker,
        column,
        columnSpeakers: column ? columnCtx : null,
      });
      lastSpeaker = speaker;
    }
    i = j;
  }
  // Lookahead pass: if a full-width single block's speaker appears in
  // a nearby overlap (within 5s), pre-assign the column so it aligns
  // with the upcoming overlap layout.
  for (let b = 0; b < blocks.length; b++) {
    const blk = blocks[b];
    if (blk.type === "single" && blk.column === null) {
      // Look ahead for a nearby overlap
      for (let look = b + 1; look < blocks.length && look <= b + 4; look++) {
        const next = blocks[look];
        if (next.startTime - blk.endTime > 5) break;
        if (next.type === "overlap" && next.columnSpeakers) {
          const spk = blk.segments[0].speaker_pseudo_id;
          if (spk === next.columnSpeakers[0]) {
            blk.column = "left";
            blk.columnSpeakers = next.columnSpeakers;
          } else if (spk === next.columnSpeakers[1]) {
            blk.column = "right";
            blk.columnSpeakers = next.columnSpeakers;
          }
          break;
        }
      }
    }
  }

  return blocks;
}

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = React.use(params);
  const [data, setData] = useState<PipelineResult | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedScene, setSelectedScene] = useState<number | null>(null);
  const [selection, setSelection] = useState<{ type: "line" | "block" | "scene"; blockIdx: number; segIdx?: number; scene?: number } | null>(null);
  const [flashingBlock, setFlashingBlock] = useState<number | null>(null);
  const [edits, setEdits] = useState<Record<string, SegmentEdits>>({});
  const [editingSegId, setEditingSegId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActiveBlock = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blockRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Real-time event subscription: append new segments as the worker
  // posts them to the data-api. The event bus broadcasts SegmentAdded
  // events progressively (in batches of 5) so the transcript renders
  // incrementally during transcription.
  useSessionEvents(sessionId, {
    onSegmentAdded: useCallback((event: { session_id: string; segment: Record<string, unknown> }) => {
      const seg = event.segment as unknown as Segment;
      if (!seg?.id) return;
      setData((prev) => {
        if (!prev) return prev;
        // Deduplicate: skip if we already have this segment
        if (prev.segments.some((s) => s.id === seg.id)) return prev;
        const updated = [...prev.segments, seg].sort(
          (a, b) => a.start_time - b.start_time
        );
        return {
          ...prev,
          segments: updated,
          segments_produced: updated.filter((s) => !s.excluded).length,
          segments_excluded: updated.filter((s) => s.excluded).length,
          duration_processed:
            updated.length > 0
              ? updated[updated.length - 1].end_time
              : 0,
        };
      });
    }, []),
    onStatusChanged: useCallback((event: { session_id: string; status: string }) => {
      // Could update a status indicator in the header
      if (event.status === "transcribed") {
        // Final state — could show a "transcription complete" toast
      }
    }, []),
  });

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}/segments`)
      .then((r) => r.json())
      .then((segments: Segment[]) => {
        // Wrap in PipelineResult shape
        const sorted = segments.sort((a, b) => a.start_time - b.start_time);
        initSpeakers(sorted);
        setData({
          segments: sorted,
          segments_produced: segments.filter(s => !s.excluded).length,
          segments_excluded: segments.filter(s => s.excluded).length,
          scenes_detected: 0,
          duration_processed: segments.length > 0 ? segments[segments.length - 1].end_time : 0,
        });
      });
  }, [sessionId]);

  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(() => setCurrentTime((prev) => prev + 0.1), 100);
    } else if (timerRef.current) { clearInterval(timerRef.current); }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing]);

  // Flash on block transition + scroll when active block leaves viewport
  useEffect(() => {
    if (!playing) return;
    let activeIdx: number | null = null;
    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].startTime <= currentTime && blocks[i].endTime > currentTime) {
        activeIdx = i;
        break;
      }
    }
    if (activeIdx !== null && activeIdx !== lastActiveBlock.current) {
      lastActiveBlock.current = activeIdx;
      setFlashingBlock(activeIdx);
      setTimeout(() => setFlashingBlock(null), 400);

      // Only scroll if the active block is below the viewport
      const el = blockRefs.current[activeIdx];
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.bottom > window.innerHeight) {
          window.scrollBy({ top: window.innerHeight * 0.7, behavior: "smooth" });
        }
      }
    }
  });

  const jumpTo = useCallback((time: number) => setCurrentTime(time), []);
  const playClip = useCallback((time: number) => {
    setCurrentTime(time);
    setPlaying(true);
  }, []);

  const startEdit = useCallback((blockSegments: Segment[]) => {
    setEditingSegId(blockSegments[0].id);
  }, []);

  const saveEditWithText = useCallback((blockSegments: Segment[], newText: string) => {
    const blockId = blockSegments[0].id;
    const originalText = blockSegments.map((s) => s.original_text).join(" ");
    setEditingSegId(null);
    const trimmed = newText.trim();
    if (trimmed === "" || trimmed === originalText) return;
    const currentDisplay = blockSegments.map((s) => getDisplayText(s.id, s.original_text)).join(" ");
    if (trimmed === currentDisplay) return;
    setEdits((prev) => {
      const existing = prev[blockId];
      const layers = existing
        ? [...existing.layers]
        : [{ text: originalText, timestamp: 0, author: "whisper" }];
      layers.push({ text: trimmed, timestamp: Date.now(), author: "you" });
      return { ...prev, [blockId]: { layers, activeLayer: layers.length - 1 } };
    });
  }, []);

  const revertTo = useCallback((segId: string, layerIdx: number) => {
    setEdits((prev) => {
      const existing = prev[segId];
      if (!existing) return prev;
      return { ...prev, [segId]: { ...existing, activeLayer: layerIdx } };
    });
  }, []);

  const getDisplayText = useCallback((segId: string, originalText: string): string => {
    const e = edits[segId];
    if (!e) return originalText;
    return e.layers[e.activeLayer].text;
  }, [edits]);

  const getPreviousText = useCallback((segId: string): string | null => {
    const e = edits[segId];
    if (!e || e.activeLayer === 0) return null;
    return e.layers[e.activeLayer - 1].text;
  }, [edits]);

  const hasEdits = useCallback((segId: string): boolean => {
    const e = edits[segId];
    return !!e && e.activeLayer > 0;
  }, [edits]);

  const filteredSegments = useMemo(() => {
    if (!data) return [];
    const kept = data.segments.filter((s) => !s.excluded).sort((a, b) => a.start_time - b.start_time);
    return selectedScene !== null ? kept.filter((s) => (s.chunk_group ?? 0) === selectedScene) : kept;
  }, [data, selectedScene]);

  const blocks = useMemo(() => buildBlocks(filteredSegments), [filteredSegments]);

  if (!data) return (
    <AppShell>
      <div className="flex items-center justify-center h-64 font-sans text-ink-faint">Loading...</div>
    </AppShell>
  );

  const scenes = [...new Set(data.segments.filter((s) => !s.excluded).map((s) => s.chunk_group ?? 0))].sort((a, b) => a - b);
  const maxTime = Math.max(...data.segments.filter((s) => !s.excluded).map((s) => s.end_time));
  const speakerCount = Object.keys(speakerNameCache).length;

  return (
    <AppShell>
      <style>{`
        .speaker-glow {
          text-shadow: 0 0 3px rgba(139, 69, 19, 0.52);
          transition: text-shadow 0.3s ease-in;
        }
        .speaker-dim {
          text-shadow: none;
          transition: text-shadow 0.8s ease-out;
        }
        .text-glow {
          text-shadow: 0 0 1px rgba(139, 69, 19, 0.18);
          transition: text-shadow 0.3s ease-in;
        }
        .text-dim {
          text-shadow: none;
          transition: text-shadow 0.8s ease-out;
        }
      `}</style>

      {/* Back link */}
      <Link href="/sessions" className="inline-flex items-center gap-1 font-sans text-sm text-ink-faint hover:text-ink transition-colors mb-4">
        <ChevronLeft size={14} />
        Back to sessions
      </Link>

      {/* Session info header */}
      <div className="mb-4">
        <h1 className="font-serif text-xl font-semibold text-ink">
          Session {sessionId.substring(0, 8)}
        </h1>
        <p className="font-sans text-sm text-ink-light mt-0.5">
          {speakerCount} speaker{speakerCount !== 1 ? "s" : ""}
          {data.duration_processed > 0 && <> &middot; {formatTime(data.duration_processed)}</>}
          {data.segments_produced > 0 && <> &middot; {data.segments_produced} segments</>}
        </p>
      </div>

      {/* Control strip: playback + scene filter */}
      <div className="border border-rule rounded bg-card-surface px-4 py-2.5 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => setPlaying(!playing)}
            className="px-3 py-1 rounded font-sans text-sm bg-accent-brown text-card-surface hover:bg-accent-light transition-colors">
            {playing ? "Pause" : "Play"}
          </button>
          <input type="range" min={0} max={maxTime} step={0.1} value={currentTime}
            onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
            className="flex-1 min-w-[120px] accent-[#8b4513]" />
          <span className="font-mono text-xs text-ink-faint">{formatTime(currentTime)}</span>
          {scenes.length > 1 && (
            <>
              <div className="w-px h-5 bg-rule mx-1" />
              <span className="font-sans text-xs text-ink-faint">Scene:</span>
              <div className="flex gap-1 flex-wrap">
                <button onClick={() => setSelectedScene(null)}
                  className={`px-2 py-0.5 rounded font-sans text-xs border transition-colors ${
                    selectedScene === null
                      ? "bg-accent-brown text-card-surface border-accent-brown"
                      : "bg-transparent text-ink-faint border-rule hover:border-ink-faint"
                  }`}>All</button>
                {scenes.map((s) => (
                  <button key={s} onClick={() => setSelectedScene(s)}
                    className={`px-2 py-0.5 rounded font-sans text-xs border transition-colors ${
                      selectedScene === s
                        ? "bg-accent-brown text-card-surface border-accent-brown"
                        : "bg-transparent text-ink-faint border-rule hover:border-ink-faint"
                    }`}>
                    {s + 1}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Transcript area */}
      <div className="max-w-[620px] pl-14 pr-4">
        {/* Speaker legend */}
        <div className="flex gap-4 mb-6 font-sans text-xs text-ink-light">
          {Object.entries(speakerNameCache).map(([id, name]) => (
            <div key={id} className="flex items-center gap-1.5">
              <User size={12} style={{ color: getSpeakerAccent(id) }} />
              <span className="font-serif italic">{name}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-rule mb-6" />

        {blocks.map((block, bi) => {
          const isActive = block.startTime <= currentTime && block.endTime > currentTime;
          const isPast = block.endTime <= currentTime;

          const prevBlock = bi > 0 ? blocks[bi - 1] : null;
          const thisScene = block.segments[0]?.chunk_group ?? 0;
          const prevScene = prevBlock?.segments[0]?.chunk_group ?? null;
          const sceneBreak = prevBlock !== null && prevScene !== null && thisScene !== prevScene;

          const isGM = block.type === "single" && block.segments[0]?.speaker_pseudo_id === GM_ID_REF.current;
          const isSelected = selection !== null && selection.blockIdx === bi;

          return (
            <div key={bi} ref={(el) => { blockRefs.current[bi] = el; }}
              style={{
                // Temporal whitespace: map silence gap to vertical margin.
                // Same speaker -> magnetic, pull tight regardless of gap.
                // Different speaker -> gap reflects the pause duration.
                marginTop: (() => {
                  if (!prevBlock || sceneBreak) return 0;
                  const sameSpeaker = prevBlock.type === "single" && block.type === "single" &&
                    prevBlock.segments[0]?.speaker_pseudo_id === block.segments[0]?.speaker_pseudo_id;
                  if (sameSpeaker) return 1;
                  const gap = block.startTime - prevBlock.endTime;
                  if (gap < 0.5) return 2;
                  if (gap < 2) return 6;
                  if (gap < 5) return 14;
                  return 24;
                })(),
              }}
            >
              {sceneBreak && (
                <div
                  className="my-8 flex items-center gap-3 group"
                  onClick={() => setSelection(
                    selection?.type === "scene" && selection.scene === thisScene
                      ? null
                      : { type: "scene", blockIdx: bi, scene: thisScene }
                  )}
                >
                  <div className="flex-1 h-px bg-rule" />
                  <span className="font-sans text-[10px] uppercase tracking-widest text-ink-faint group-hover:underline">
                    Scene {thisScene + 1}
                  </span>
                  <div className="flex-1 h-px bg-rule" />
                </div>
              )}

              <div
                className="relative group"
                style={{ opacity: playing && isPast && !isActive ? 0.4 : 1, transition: "opacity 150ms" }}
              >
                {/* Content -- click block-level */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    if (editingSegId) return;
                    // Delay single-click to not interfere with double-click
                    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
                    clickTimerRef.current = setTimeout(() => {
                      setSelection(isSelected ? null : { type: "block", blockIdx: bi });
                    }, 200);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
                    if (block.type === "single") {
                      setSelection({ type: "block", blockIdx: bi });
                      startEdit(block.segments);
                    }
                  }}
                >
                  {block.type === "overlap" ? (
                    <OverlapBlock block={block} playing={playing} currentTime={currentTime} onPlayClip={playClip} />
                  ) : block.column ? (
                    // Columned single block -- stays in its lane
                    <div className="grid grid-cols-2 gap-4">
                      {block.column === "left" ? (
                        <>
                          <SingleBlock block={block} isGM={isGM}
                            onLineClick={undefined}
                            selectedLine={undefined}
                            playing={playing} currentTime={currentTime} onPlayClip={playClip} isSelected={isSelected}
                            editingSegId={editingSegId} editText={editText} setEditText={setEditText}
                            startEdit={startEdit} saveEditWithText={saveEditWithText} getDisplayText={getDisplayText}
                            getPreviousText={getPreviousText} hasEdits={hasEdits} revertTo={revertTo} />
                          <div />
                        </>
                      ) : (
                        <>
                          <div />
                          <SingleBlock block={block} isGM={isGM}
                            onLineClick={undefined}
                            selectedLine={undefined}
                            playing={playing} currentTime={currentTime} onPlayClip={playClip} isSelected={isSelected}
                            editingSegId={editingSegId} editText={editText} setEditText={setEditText}
                            startEdit={startEdit} saveEditWithText={saveEditWithText} getDisplayText={getDisplayText}
                            getPreviousText={getPreviousText} hasEdits={hasEdits} revertTo={revertTo} />
                        </>
                      )}
                    </div>
                  ) : (
                    <SingleBlock block={block} isGM={isGM}
                      onLineClick={(segIdx) => setSelection({ type: "line", blockIdx: bi, segIdx })}
                      selectedLine={selection?.type === "line" && selection.blockIdx === bi ? selection.segIdx : undefined}
                      playing={playing} currentTime={currentTime} onPlayClip={playClip} isSelected={isSelected}
                            editingSegId={editingSegId} editText={editText} setEditText={setEditText}
                            startEdit={startEdit} saveEditWithText={saveEditWithText} getDisplayText={getDisplayText}
                            getPreviousText={getPreviousText} hasEdits={hasEdits} revertTo={revertTo} />
                  )}
                </div>

                {/* Right-edge toolbar -- appears on selection */}
              </div>
            </div>
          );
        })}
        <div className="h-[50vh]" />
      </div>
    </AppShell>
  );
}

function SingleBlock({ block, isGM, onLineClick, selectedLine, hideGutter, playing, currentTime, onPlayClip, isSelected, editingSegId, editText, setEditText, startEdit, saveEditWithText, getDisplayText, getPreviousText, hasEdits, revertTo }: {
  block: Block; isGM: boolean;
  onLineClick?: (segIdx: number) => void;
  selectedLine?: number;
  hideGutter?: boolean;
  playing?: boolean;
  currentTime?: number;
  onPlayClip?: (time: number) => void;
  isSelected?: boolean;
  editingSegId?: string | null;
  editText?: string;
  setEditText?: (v: string) => void;
  startEdit?: (segs: Segment[]) => void;
  saveEditWithText?: (segs: Segment[], text: string) => void;
  getDisplayText?: (id: string, original: string) => string;
  getPreviousText?: (id: string) => string | null;
  hasEdits?: (id: string) => boolean;
  revertTo?: (id: string, layer: number) => void;
}) {
  const accent = getSpeakerAccent(block.segments[0].speaker_pseudo_id);
  const confs = block.segments.map((s) => s.confidence).filter((c): c is number => c !== null);
  const avgConf = confs.length > 0 ? confs.reduce((a, b) => a + b, 0) / confs.length : null;
  const isEditing = editingSegId === block.segments[0].id;

  return (
    <div className="relative flex gap-0" style={{ paddingTop: block.showName ? 6 : 0, marginBottom: block.showName ? 1 : 0 }}>
      {/* Per-bar gutter -- hidden during edit to avoid clipping */}
      {!hideGutter && !isEditing && (
        <div className="absolute flex items-center gap-0.5" style={{ right: "calc(100% + 2px)", top: block.showName ? 7 : 1, whiteSpace: "nowrap" }}>
          <span className="font-mono text-[8px] text-ink-faint">{formatTime(block.startTime)}</span>
          <div className="w-1.5 flex items-center justify-center shrink-0">
            {avgConf !== null && avgConf < -0.5 && (
              <div className="w-1 h-1 rounded-full" style={{ background: confidenceDot(avgConf) }} />
            )}
          </div>
        </div>
      )}
      {!isEditing && <div className="w-[3px] shrink-0 self-stretch" style={{ background: accent, opacity: 0.7, marginTop: block.showName ? 0 : -1 }} />}
      <div className="pl-3 min-w-0">
        {block.showName && (() => {
          const isBlockPlaying = playing && currentTime !== undefined &&
            block.startTime <= currentTime && block.endTime > currentTime;
          return (
            <div className="flex items-center gap-1.5 -mb-0.5">
              <button
                className={`transition-all duration-300 hover:opacity-90 ${isBlockPlaying ? "speaker-glow" : ""}`}
                style={{ color: isBlockPlaying ? accent : undefined }}
                onClick={(e) => { e.stopPropagation(); onPlayClip?.(block.startTime); }}
                title="Play clip"
              >
                <Volume2 size={11} className={isBlockPlaying ? "" : "text-ink-faint"} />
              </button>
              <User size={12} style={{ color: accent }} />
              <div className={`font-serif text-[12px] italic ${isBlockPlaying ? "speaker-glow" : "speaker-dim"}`} style={{ color: accent }}>
                {speakerName(block.segments[0].speaker_pseudo_id)}
              </div>
            </div>
          );
        })()}
        {(() => {
          const blockId = block.segments[0].id;
          const isEditing = editingSegId === blockId;
          const blockEdited = hasEdits ? hasEdits(blockId) : false;
          const blockPrevText = getPreviousText ? getPreviousText(blockId) : null;
          const blockDisplayText = blockEdited && getDisplayText
            ? getDisplayText(blockId, block.segments.map((s) => s.original_text).join(" "))
            : null;
          const isBlockActive = playing && currentTime !== undefined && block.startTime <= currentTime && block.endTime > currentTime;

          const contentEditableRef = (el: HTMLDivElement | null) => {
            // Focus the element if not already focused, but don't
            // move the cursor -- preserve the browser's word selection
            // from double-click.
            if (el && isEditing && el !== document.activeElement) {
              el.focus();
            }
          };

          return (
            <>
              {blockEdited && blockPrevText && !isEditing && (
                <div>
                  <span className="line-through font-serif text-[13px] text-ink-faint">
                    {blockPrevText}
                  </span>
                  {revertTo && (
                    <button className="ml-1 font-sans text-[10px] text-ink-faint hover:opacity-60"
                      onClick={(e) => { e.stopPropagation(); revertTo(blockId, 0); }} title="Revert to original">&#8617;</button>
                  )}
                </div>
              )}
              <div
                ref={isEditing ? contentEditableRef : undefined}
                contentEditable={isEditing}
                suppressContentEditableWarning
                className={`${isGM ? "italic " : ""}font-serif text-[15px] text-ink ${isBlockActive ? "text-glow" : "text-dim"} ${isEditing ? "outline-none border-b border-rule" : ""}`}
                style={{
                  lineHeight: "1.35",
                }}
                onBlur={(e) => {
                  if (isEditing && saveEditWithText) {
                    const newText = e.currentTarget.textContent ?? "";
                    saveEditWithText(block.segments, newText);
                  }
                }}
                onKeyDown={(e) => {
                  if (!isEditing) return;
                  if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
                  if (e.key === "Escape") { e.currentTarget.blur(); }
                }}
              >
              {blockDisplayText
                ? <>{blockDisplayText}</>
                : block.segments.map((seg, si) => (
                  <span key={seg.id}>
                    {getDisplayText ? getDisplayText(seg.id, seg.original_text) : seg.text}{si < block.segments.length - 1 ? " " : ""}
                  </span>
                ))
              }
              {isSelected && startEdit && (
                <span className="inline-flex gap-2 ml-2 align-middle" onClick={(e) => e.stopPropagation()}>
                  <button title="Flag hallucination" className="text-ink-faint hover:opacity-60 transition-opacity"><Ghost size={11} /></button>
                  <button title="Flag misattribution" className="text-ink-faint hover:opacity-60 transition-opacity"><UserRoundX size={11} /></button>
                  <button title="Flag private" className="text-ink-faint hover:opacity-60 transition-opacity"><Flag size={11} /></button>
                  <button title="Edit" className="text-ink-faint hover:opacity-60 transition-opacity"
                    onClick={() => startEdit(block.segments)}><Pencil size={11} /></button>
                </span>
              )}
            </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}

function OverlapBlock({ block, playing, currentTime, onPlayClip }: { block: Block; playing?: boolean; currentTime?: number; onPlayClip?: (time: number) => void }) {
  const bySpeaker: Record<string, Segment[]> = {};
  for (const seg of block.segments) {
    if (!bySpeaker[seg.speaker_pseudo_id]) {
      bySpeaker[seg.speaker_pseudo_id] = [];
    }
    bySpeaker[seg.speaker_pseudo_id].push(seg);
  }

  // Use the column assignments from buildBlocks (GM always left)
  const speakerIds = Object.keys(bySpeaker);
  const order = block.columnSpeakers
    ? [block.columnSpeakers[0], block.columnSpeakers[1]].filter((s) => bySpeaker[s])
    : speakerIds;

  // If there are more than 2 speakers, append extras
  for (const spk of speakerIds) {
    if (!order.includes(spk)) order.push(spk);
  }

  return (
    <div className="mb-1 pt-2">
      <div className="font-sans text-[9px] uppercase tracking-widest ml-1 mb-1 mt-3 text-ink-faint">
        (simultaneous)
      </div>
      <div className="grid grid-cols-2 gap-4">
        {order.map((spk) => {
          const segs = bySpeaker[spk];
          const accent = getSpeakerAccent(spk);
          const isGMSpeaker = spk === GM_ID_REF.current;

          const confs = segs.map((s) => s.confidence).filter((c): c is number => c !== null);
          const avgConf = confs.length > 0 ? confs.reduce((a, b) => a + b, 0) / confs.length : null;

          return (
            <div key={spk} className="relative flex gap-0 mb-0.5" style={{ paddingTop: 5 }}>
              {/* Per-column gutter -- tight to bar */}
              <div className="absolute flex items-center gap-0.5" style={{ right: "calc(100% + 2px)", top: 6, whiteSpace: "nowrap" }}>
                <span className="font-mono text-[8px] text-ink-faint">{formatTime(segs[0].start_time)}</span>
                <div className="w-1.5 flex items-center justify-center shrink-0">
                  {avgConf !== null && avgConf < -0.5 && (
                    <div className="w-1 h-1 rounded-full" style={{ background: confidenceDot(avgConf) }} />
                  )}
                </div>
              </div>
              <div className="w-[3px] shrink-0 self-stretch" style={{ background: accent, opacity: 0.7 }} />
              <div className="pl-3 min-w-0">
                {(() => {
                  const isSpkPlaying = playing && currentTime !== undefined &&
                    segs[0].start_time <= currentTime && segs[segs.length - 1].end_time > currentTime;
                  return (
                    <div className="flex items-center gap-1.5 -mb-0.5">
                      <button
                        className={`transition-all duration-300 hover:opacity-90 ${isSpkPlaying ? "speaker-glow" : ""}`}
                        style={{ color: isSpkPlaying ? accent : undefined }}
                        onClick={(e) => { e.stopPropagation(); onPlayClip?.(segs[0].start_time); }}
                        title="Play clip"
                      >
                        <Volume2 size={11} className={isSpkPlaying ? "" : "text-ink-faint"} />
                      </button>
                      <User size={12} style={{ color: accent }} />
                      <div className={`font-serif text-[12px] italic ${isSpkPlaying ? "speaker-glow" : "speaker-dim"}`} style={{ color: accent }}>
                        {speakerName(spk)}
                      </div>
                    </div>
                  );
                })()}
                <p className={`${isGMSpeaker ? "italic " : ""}font-serif text-[15px] text-ink`} style={{ lineHeight: "1.35" }}>
                  {segs.map((s) => s.text).join(" ")}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SpeakerColumn({ speakerId, segments }: { speakerId: string; segments: Segment[] }) {
  const accent = getSpeakerAccent(speakerId);
  const isGM = speakerId === GM_ID_REF.current;
  const confs = segments.map((s) => s.confidence).filter((c): c is number => c !== null);
  const avgConf = confs.length > 0 ? confs.reduce((a, b) => a + b, 0) / confs.length : null;

  return (
    <div className="flex gap-0">
      <div className="w-[3px] shrink-0 self-stretch" style={{ background: accent, opacity: 0.7 }} />
      <div className="pl-2 min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <User size={12} style={{ color: accent }} />
          <span className="font-serif text-[12px] italic" style={{ color: accent }}>
            {speakerName(speakerId)}
          </span>
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: confidenceDot(avgConf) }} />
        </div>
        <p className={`${isGM ? "italic " : ""}font-serif text-[14px] text-ink`} style={{ lineHeight: "1.35" }}>
          {segments.map((s) => s.text).join(" ")}
        </p>
      </div>
    </div>
  );
}
