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
 * demo session), the caller can fall back to the first speaker's
 * stream so playback is at least functional.
 */

import { dataApiClient } from "@/lib/data-api-client";

const SAMPLE_RATE = 48_000;
const CHANNELS = 2;
const BITS_PER_SAMPLE = 16;
const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8;

interface ChunkRow {
  seq: number;
  size_bytes: number;
}

/**
 * Build a 44-byte RIFF/WAVE header for raw 48kHz stereo s16le PCM.
 */
function wavHeader(dataLength: number): Uint8Array {
  const buf = new ArrayBuffer(44);
  const view = new DataView(buf);
  const byteRate = SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE;
  const blockAlign = CHANNELS * BYTES_PER_SAMPLE;

  // "RIFF" chunk descriptor
  view.setUint8(0, 0x52); // R
  view.setUint8(1, 0x49); // I
  view.setUint8(2, 0x46); // F
  view.setUint8(3, 0x46); // F
  view.setUint32(4, 36 + dataLength, true);
  view.setUint8(8, 0x57); // W
  view.setUint8(9, 0x41); // A
  view.setUint8(10, 0x56); // V
  view.setUint8(11, 0x45); // E
  // "fmt " subchunk
  view.setUint8(12, 0x66); // f
  view.setUint8(13, 0x6d); // m
  view.setUint8(14, 0x74); // t
  view.setUint8(15, 0x20); // (space)
  view.setUint32(16, 16, true); // subchunk1 size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, CHANNELS, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, BITS_PER_SAMPLE, true);
  // "data" subchunk
  view.setUint8(36, 0x64); // d
  view.setUint8(37, 0x61); // a
  view.setUint8(38, 0x74); // t
  view.setUint8(39, 0x61); // a
  view.setUint32(40, dataLength, true);

  return new Uint8Array(buf);
}

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

/**
 * Returns a Response with assembled WAV bytes for the given pseudo_id.
 * Returns null if no chunks exist.
 */
export async function assembleWavResponse(
  sessionId: string,
  pseudoId: string,
): Promise<Response | null> {
  const chunks = await listChunks(sessionId, pseudoId);
  if (chunks.length === 0) return null;

  // Sort by seq to preserve playback order.
  chunks.sort((a, b) => a.seq - b.seq);

  const totalDataBytes = chunks.reduce((acc, c) => acc + c.size_bytes, 0);
  const header = wavHeader(totalDataBytes);

  // Stream the WAV to avoid buffering the whole thing. Chunks are
  // fetched on demand and pushed into the controller in seq order.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(header);
      try {
        for (const chunk of chunks) {
          const buf = await fetchChunk(sessionId, pseudoId, chunk.seq);
          if (!buf) continue;
          controller.enqueue(new Uint8Array(buf));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "audio/wav",
      "Content-Length": String(44 + totalDataBytes),
      "Accept-Ranges": "none",
      "Cache-Control": "private, max-age=60",
    },
  });
}

/**
 * Sum two Int16 PCM buffers sample-wise with clipping. `a` is modified
 * in place. If `b` is shorter, the remainder of `a` is left alone.
 * Scaling: we sum raw and clip at ±32767. For 4 concurrent talkers
 * this can clip in loud overlaps but is fine for mid-level speech;
 * a proper mix would normalize against RMS. Good enough for demo
 * playback — the worker-side mix will do better.
 */
function sumInt16Into(a: Int16Array, b: Int16Array): void {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const s = a[i] + b[i];
    a[i] = s > 32767 ? 32767 : s < -32768 ? -32768 : s;
  }
}

/**
 * Mixed-or-fallback: try the worker-produced "mixed" track first; if
 * none exists (e.g. freshly-injected demo, worker hasn't run), mix the
 * per-speaker streams ourselves, streaming one aligned chunk at a time.
 *
 * Assumes all speakers share the same chunk layout (size + seq range)
 * — which is how chronicle-bot uploads (one 2MB/~10.9s chunk per speaker
 * per round) and how inject-session.py replicates that. If a speaker
 * has fewer chunks than another we just stop summing them at their
 * last seq; the rest of the mix uses whoever's still talking.
 */
export async function assembleMixedOrFallback(
  sessionId: string,
  participantPseudoIds: string[],
): Promise<Response | null> {
  const mixed = await assembleWavResponse(sessionId, "mixed");
  if (mixed) return mixed;

  // Fetch each speaker's chunk list in parallel.
  const perSpeaker = await Promise.all(
    participantPseudoIds.map(async (pid) => ({
      pid,
      chunks: (await listChunks(sessionId, pid)).sort((a, b) => a.seq - b.seq),
    })),
  );
  const withAudio = perSpeaker.filter((s) => s.chunks.length > 0);
  if (withAudio.length === 0) return null;
  if (withAudio.length === 1) {
    // Only one speaker has audio — no mixing needed.
    return assembleWavResponse(sessionId, withAudio[0].pid);
  }

  const maxSeq = Math.max(...withAudio.map((s) => s.chunks[s.chunks.length - 1].seq));
  // Total data bytes = max chunk-size at each seq summed across seq range.
  let totalDataBytes = 0;
  for (let seq = 0; seq <= maxSeq; seq++) {
    let seqMax = 0;
    for (const s of withAudio) {
      const c = s.chunks.find((cc) => cc.seq === seq);
      if (c && c.size_bytes > seqMax) seqMax = c.size_bytes;
    }
    totalDataBytes += seqMax;
  }

  const header = wavHeader(totalDataBytes);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(header);
      try {
        for (let seq = 0; seq <= maxSeq; seq++) {
          // Fetch this seq from every speaker that has it, in parallel.
          const bufs = await Promise.all(
            withAudio.map(async (s) => {
              const has = s.chunks.some((cc) => cc.seq === seq);
              if (!has) return null;
              return fetchChunk(sessionId, s.pid, seq);
            }),
          );
          const present = bufs.filter((b): b is ArrayBuffer => !!b);
          if (present.length === 0) continue;

          // Allocate an Int16Array the size of the longest buffer at
          // this seq, zero-filled by default. Sum every speaker's samples
          // into it. Emit as the exact byte length of Int16Array.buffer.
          const maxBytes = Math.max(...present.map((b) => b.byteLength));
          const out = new Int16Array(maxBytes / 2);
          for (const b of present) {
            const samples = new Int16Array(b);
            sumInt16Into(out, samples);
          }
          controller.enqueue(new Uint8Array(out.buffer));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "audio/wav",
      "Content-Length": String(44 + totalDataBytes),
      "Accept-Ranges": "none",
      "Cache-Control": "private, max-age=60",
    },
  });
}
