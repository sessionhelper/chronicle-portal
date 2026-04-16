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
 * Mixed-or-fallback: try "mixed" first, fall back to the first
 * participant's chunks if no mixed track exists.
 */
export async function assembleMixedOrFallback(
  sessionId: string,
  participantPseudoIds: string[],
): Promise<Response | null> {
  const mixed = await assembleWavResponse(sessionId, "mixed");
  if (mixed) return mixed;
  for (const pid of participantPseudoIds) {
    const r = await assembleWavResponse(sessionId, pid);
    if (r) return r;
  }
  return null;
}
