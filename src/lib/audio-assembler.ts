/**
 * Assemble per-speaker PCM chunks from data-api into a playable WAV.
 *
 * The bot uploads chunks as raw 48kHz stereo s16le PCM. The data-api
 * stores them and exposes per-chunk download. This module fetches the
 * chunk list, downloads each chunk, and prepends a WAV header so the
 * concatenated bytes are a valid WAV file the browser can play.
 *
 * "mixed" is special-cased on the data-api side as a synthetic
 * pseudo_id covering the worker-produced room mix. If no mixed
 * chunks exist (e.g. the worker hasn't run yet on a freshly-injected
 * demo session), we sum the per-speaker streams ourselves.
 *
 * Tracks are materialized once into an in-memory cache so HTTP Range
 * requests (needed for seeking without downloading the whole file
 * first) can be served cheaply. Without this, a seek to a position
 * that hasn't downloaded yet silently snaps the player back to zero
 * — which was the symptom of the "per-segment play jumps to the
 * beginning" bug.
 *
 * Cache capacity is bounded by MAX_CACHED_TRACKS; LRU-evict on insert.
 * A 20-min demo is ~234MB per track, so the cache budget should stay
 * within a reasonable Node RSS footprint. For multi-hour sessions
 * we'll need to switch to seek-aware streaming, but that's a later
 * problem.
 */

import { dataApiClient } from "@/lib/data-api-client";

const SAMPLE_RATE = 48_000;
const CHANNELS = 2;
const BITS_PER_SAMPLE = 16;
const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8;

const MAX_CACHED_TRACKS = 4;

interface ChunkRow {
  seq: number;
  size_bytes: number;
}

/* ---------------- WAV header ---------------- */

function wavHeader(dataLength: number): Uint8Array {
  const buf = new ArrayBuffer(44);
  const view = new DataView(buf);
  const byteRate = SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE;
  const blockAlign = CHANNELS * BYTES_PER_SAMPLE;

  view.setUint8(0, 0x52); // R
  view.setUint8(1, 0x49); // I
  view.setUint8(2, 0x46); // F
  view.setUint8(3, 0x46); // F
  view.setUint32(4, 36 + dataLength, true);
  view.setUint8(8, 0x57); // W
  view.setUint8(9, 0x41); // A
  view.setUint8(10, 0x56); // V
  view.setUint8(11, 0x45); // E
  view.setUint8(12, 0x66); // f
  view.setUint8(13, 0x6d); // m
  view.setUint8(14, 0x74); // t
  view.setUint8(15, 0x20); // (space)
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, CHANNELS, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, BITS_PER_SAMPLE, true);
  view.setUint8(36, 0x64); // d
  view.setUint8(37, 0x61); // a
  view.setUint8(38, 0x74); // t
  view.setUint8(39, 0x61); // a
  view.setUint32(40, dataLength, true);

  return new Uint8Array(buf);
}

/* ---------------- data-api helpers ---------------- */

async function listChunks(
  sessionId: string,
  pseudoId: string,
): Promise<ChunkRow[]> {
  const res = await dataApiClient.raw(
    `/internal/sessions/${sessionId}/audio/${pseudoId}/chunks`,
    { op: "list_chunks" },
  );
  if (!res.ok) return [];
  return (await res.json()) as ChunkRow[];
}

async function fetchChunk(
  sessionId: string,
  pseudoId: string,
  seq: number,
): Promise<ArrayBuffer | null> {
  const res = await dataApiClient.raw(
    `/internal/sessions/${sessionId}/audio/${pseudoId}/chunk/${seq}`,
    { op: "fetch_chunk" },
  );
  if (!res.ok) return null;
  return await res.arrayBuffer();
}

function sumInt16Into(a: Int16Array, b: Int16Array): void {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const s = a[i] + b[i];
    a[i] = s > 32767 ? 32767 : s < -32768 ? -32768 : s;
  }
}

/* ---------------- In-process cache ---------------- */

// Tracks in insertion order; oldest entry is evicted when we exceed
// MAX_CACHED_TRACKS. A touch moves a hit to the end. Global scope so
// it survives hot reloads in dev.
declare global {
  var __chronicle_audio_cache: Map<string, Uint8Array> | undefined;
}
const cache: Map<string, Uint8Array> =
  global.__chronicle_audio_cache ??
  (global.__chronicle_audio_cache = new Map());

function cacheGet(key: string): Uint8Array | null {
  const hit = cache.get(key);
  if (!hit) return null;
  // LRU touch
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

function cachePut(key: string, buf: Uint8Array): void {
  cache.set(key, buf);
  while (cache.size > MAX_CACHED_TRACKS) {
    const first = cache.keys().next().value;
    if (first === undefined) break;
    cache.delete(first);
  }
}

/* ---------------- Materializers ---------------- */

async function materializeSingle(
  sessionId: string,
  pseudoId: string,
): Promise<Uint8Array | null> {
  const chunks = await listChunks(sessionId, pseudoId);
  if (chunks.length === 0) return null;
  chunks.sort((a, b) => a.seq - b.seq);
  const totalDataBytes = chunks.reduce((acc, c) => acc + c.size_bytes, 0);

  const out = new Uint8Array(44 + totalDataBytes);
  out.set(wavHeader(totalDataBytes), 0);
  let cursor = 44;
  for (const chunk of chunks) {
    const buf = await fetchChunk(sessionId, pseudoId, chunk.seq);
    if (!buf) continue;
    out.set(new Uint8Array(buf), cursor);
    cursor += buf.byteLength;
  }
  return out;
}

async function materializeMix(
  sessionId: string,
  participantPseudoIds: string[],
): Promise<Uint8Array | null> {
  // Fetch each speaker's chunk list in parallel.
  const perSpeaker = await Promise.all(
    participantPseudoIds.map(async (pid) => ({
      pid,
      chunks: (await listChunks(sessionId, pid)).sort((a, b) => a.seq - b.seq),
    })),
  );
  const withAudio = perSpeaker.filter((s) => s.chunks.length > 0);
  if (withAudio.length === 0) return null;
  if (withAudio.length === 1) return materializeSingle(sessionId, withAudio[0].pid);

  const maxSeq = Math.max(
    ...withAudio.map((s) => s.chunks[s.chunks.length - 1].seq),
  );

  // Compute per-seq output size (= max across speakers) and total.
  const perSeqSize: number[] = new Array(maxSeq + 1).fill(0);
  for (let seq = 0; seq <= maxSeq; seq++) {
    for (const s of withAudio) {
      const c = s.chunks.find((cc) => cc.seq === seq);
      if (c && c.size_bytes > perSeqSize[seq]) perSeqSize[seq] = c.size_bytes;
    }
  }
  const totalDataBytes = perSeqSize.reduce((a, b) => a + b, 0);

  const out = new Uint8Array(44 + totalDataBytes);
  out.set(wavHeader(totalDataBytes), 0);
  let cursor = 44;

  for (let seq = 0; seq <= maxSeq; seq++) {
    const bufs = await Promise.all(
      withAudio.map(async (s) => {
        const has = s.chunks.some((cc) => cc.seq === seq);
        if (!has) return null;
        return fetchChunk(sessionId, s.pid, seq);
      }),
    );
    const present = bufs.filter((b): b is ArrayBuffer => !!b);
    if (present.length === 0) continue;

    const seqSize = perSeqSize[seq];
    const mixed = new Int16Array(seqSize / 2);
    for (const b of present) {
      sumInt16Into(mixed, new Int16Array(b));
    }
    out.set(new Uint8Array(mixed.buffer), cursor);
    cursor += seqSize;
  }
  return out;
}

/* ---------------- Range response ---------------- */

/**
 * Build a Response for a cached track, honoring the HTTP Range
 * request header. Without a range: 200 with the whole buffer.
 * With a valid range: 206 Partial Content with a slice + Content-Range.
 * Unparseable or out-of-bounds range: 416 Range Not Satisfiable.
 */
function rangedResponse(
  buf: Uint8Array,
  range: string | null,
  contentType: string,
): Response {
  const totalSize = buf.byteLength;
  const baseHeaders = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=300",
  };

  if (!range) {
    return new Response(buf as BodyInit, {
      status: 200,
      headers: {
        ...baseHeaders,
        "Content-Length": String(totalSize),
      },
    });
  }

  const m = /^bytes=(\d+)-(\d*)$/.exec(range);
  if (!m) {
    return new Response("Invalid range", {
      status: 416,
      headers: { "Content-Range": `bytes */${totalSize}` },
    });
  }
  const start = parseInt(m[1], 10);
  const end = m[2] ? Math.min(parseInt(m[2], 10), totalSize - 1) : totalSize - 1;
  if (start > end || start >= totalSize) {
    return new Response("Out of range", {
      status: 416,
      headers: { "Content-Range": `bytes */${totalSize}` },
    });
  }
  const slice = buf.subarray(start, end + 1);
  return new Response(slice as BodyInit, {
    status: 206,
    headers: {
      ...baseHeaders,
      "Content-Length": String(slice.byteLength),
      "Content-Range": `bytes ${start}-${end}/${totalSize}`,
    },
  });
}

/* ---------------- Public API ---------------- */

export async function assembleWavResponse(
  sessionId: string,
  pseudoId: string,
  range: string | null = null,
): Promise<Response | null> {
  const key = `single:${sessionId}:${pseudoId}`;
  let buf = cacheGet(key);
  if (!buf) {
    const fresh = await materializeSingle(sessionId, pseudoId);
    if (!fresh) return null;
    cachePut(key, fresh);
    buf = fresh;
  }
  return rangedResponse(buf, range, "audio/wav");
}

export async function assembleMixedOrFallback(
  sessionId: string,
  participantPseudoIds: string[],
  range: string | null = null,
): Promise<Response | null> {
  // If the worker has posted a real mixed track, prefer that.
  const mixedKey = `single:${sessionId}:mixed`;
  let buf = cacheGet(mixedKey);
  if (!buf) {
    const real = await materializeSingle(sessionId, "mixed");
    if (real) {
      cachePut(mixedKey, real);
      buf = real;
    }
  }
  if (buf) return rangedResponse(buf, range, "audio/wav");

  // Otherwise sum per-speaker streams.
  const pidsKey = [...participantPseudoIds].sort().join(",");
  const key = `mix:${sessionId}:${pidsKey}`;
  buf = cacheGet(key);
  if (!buf) {
    const fresh = await materializeMix(sessionId, participantPseudoIds);
    if (!fresh) return null;
    cachePut(key, fresh);
    buf = fresh;
  }
  return rangedResponse(buf, range, "audio/wav");
}
