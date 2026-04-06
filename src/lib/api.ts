const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

export async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export interface Session {
  id: string;
  guild_id: string;
  channel_id: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  participant_count: number;
  segment_count: number;
}

export interface Segment {
  id: string;
  session_id: string;
  pseudo_id: string;
  start_time: number;
  end_time: number;
  text: string;
  confidence: number | null;
}

export interface Participant {
  pseudo_id: string;
  session_id: string;
  joined_at: string;
}
