import type {
  User,
  SessionListItem,
  SessionDetail,
  TranscriptSegment,
  AuditEntry,
} from "./types";

const BASE = "/api/v1";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  auth: {
    me: () => request<User>("/auth/me"),
    discordCallback: (code: string, state: string) =>
      request<{ redirect: string }>("/auth/discord/callback", {
        method: "POST",
        body: JSON.stringify({ code, state }),
      }),
    logout: () => request<void>("/auth/logout", { method: "POST" }),
  },

  sessions: {
    list: () => request<SessionListItem[]>("/sessions"),
    get: (id: string) => request<SessionDetail>(`/sessions/${id}`),
    withdraw: (id: string) =>
      request<void>(`/sessions/${id}/consent/withdraw`, { method: "POST" }),
    reinstate: (id: string) =>
      request<void>(`/sessions/${id}/consent/reinstate`, { method: "POST" }),
    /**
     * Update the logged-in user's license flags for this session.
     * Either flag can be omitted for a partial update. The BFF resolves
     * which participant row belongs to the current user and PATCHes the
     * data-api's /internal/participants/{id}/license endpoint.
     */
    updateLicense: (
      id: string,
      flags: { no_llm_training?: boolean; no_public_release?: boolean }
    ) =>
      request<void>(`/sessions/${id}/license`, {
        method: "PATCH",
        body: JSON.stringify(flags),
      }),
    updateCollaborativeEditing: (id: string, enabled: boolean) =>
      request<void>(`/sessions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ collaborative_editing: enabled }),
      }),
  },

  transcript: {
    get: (sessionId: string) =>
      request<TranscriptSegment[]>(`/sessions/${sessionId}/transcript`),
  },

  segments: {
    edit: (segmentId: string, newText: string) =>
      request<void>(`/segments/${segmentId}/edit`, {
        method: "POST",
        body: JSON.stringify({ new_text: newText }),
      }),
    flag: (segmentId: string, reason: string) =>
      request<void>(`/segments/${segmentId}/flag`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    unflag: (segmentId: string) =>
      request<void>(`/segments/${segmentId}/flag`, { method: "DELETE" }),
  },

  user: {
    optOut: () => request<void>("/auth/me/opt-out", { method: "POST" }),
    optIn: () => request<void>("/auth/me/opt-in", { method: "POST" }),
    requestExport: () =>
      request<{ id: string }>("/auth/me/export", { method: "POST" }),
    exportStatus: (exportId: string) =>
      request<{ status: string; download_url?: string }>(
        `/auth/me/export/${exportId}/status`
      ),
    deleteAccount: () => request<void>("/auth/me", { method: "DELETE" }),
    audit: () => request<AuditEntry[]>("/auth/me/audit"),
  },
};
