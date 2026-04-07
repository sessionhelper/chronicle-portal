/**
 * Server-side client for the internal data API (ovp-data-api).
 *
 * Authenticates with a shared secret, caches the bearer token,
 * and auto-refreshes on 401. Intended for use in Next.js API routes
 * and server components only — never import this on the client.
 */

const DATA_API_URL =
  process.env.DATA_API_URL || "http://localhost:8001";
const SHARED_SECRET = process.env.DATA_API_SHARED_SECRET || "";

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function authenticate(): Promise<string> {
  const res = await fetch(`${DATA_API_URL}/internal/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      shared_secret: SHARED_SECRET,
      service_name: "ttrpg-collector-frontend",
    }),
  });

  if (!res.ok) {
    throw new Error(`Data API auth failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  cachedToken = data.session_token;
  // Refresh 60s before the 90s reap timeout
  tokenExpiresAt = Date.now() + 30_000;
  return cachedToken!;
}

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }
  return authenticate();
}

async function request<T>(
  path: string,
  options?: RequestInit & { retry?: boolean }
): Promise<T> {
  const token = await getToken();
  const url = `${DATA_API_URL}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });

  // Auto-refresh on 401 and retry once
  if (res.status === 401 && options?.retry !== false) {
    cachedToken = null;
    return request<T>(path, { ...options, retry: false });
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Data API error ${res.status}: ${res.statusText} ${body}`.trim()
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// --- Public types for data-api responses ---

export interface DataApiSession {
  id: string;
  guild_id: string;
  channel_id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  participant_count: number;
  segment_count: number;
  created_at: string;
  updated_at: string;
}

export interface DataApiParticipant {
  id: string;
  session_id: string;
  pseudo_id: string;
  consent_scope: string | null;
  joined_at: string;
  left_at: string | null;
  flags: string[];
}

export interface DataApiSegment {
  id: string;
  session_id: string;
  segment_index: number;
  speaker_pseudo_id: string;
  start_time: number;
  end_time: number;
  text: string;
  confidence: number | null;
  beat_id: string | null;
  scene_id: string | null;
  created_at: string;
}

export interface DataApiBeat {
  id: string;
  session_id: string;
  title: string;
  start_time: number;
  end_time: number;
  segment_count: number;
  created_at: string;
}

export interface DataApiScene {
  id: string;
  session_id: string;
  title: string;
  start_time: number;
  end_time: number;
  beat_start_index: number;
  beat_end_index: number;
  created_at: string;
}

// --- Client methods ---

export const dataApi = {
  listSessions: (status?: string) => {
    const params = status ? `?status=${encodeURIComponent(status)}` : "";
    return request<DataApiSession[]>(`/internal/sessions${params}`);
  },

  getSession: (id: string) =>
    request<DataApiSession>(`/internal/sessions/${id}`),

  getParticipants: (id: string) =>
    request<DataApiParticipant[]>(`/internal/sessions/${id}/participants`),

  getSegments: (id: string) =>
    request<DataApiSegment[]>(`/internal/sessions/${id}/segments`),

  getBeats: (id: string) =>
    request<DataApiBeat[]>(`/internal/sessions/${id}/beats`),

  getScenes: (id: string) =>
    request<DataApiScene[]>(`/internal/sessions/${id}/scenes`),

  /** Check if the data API is reachable and auth works. */
  healthCheck: async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      await getToken();
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Unknown error",
      };
    }
  },
};
