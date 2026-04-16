/**
 * DataApiClient — process-wide singleton.
 *
 * One long-lived client per portal process. Authenticates with
 * `SHARED_SECRET` on first use + refreshes automatically on 401. Callers
 * pass typed args; responses are parsed through Zod schemas before they
 * return. Every method records latency + errors to prom-client.
 *
 * This client is the only place `SHARED_SECRET` is read at runtime.
 * Importing it from a React component (i.e. anything without
 * `"use server"` context) is a bug — enforced by the BFF boundary
 * convention, not the type system.
 */

import { env } from "@/lib/env";
import { metrics } from "@/lib/metrics";
import {
  ParticipantListSchema,
  ParticipantSchema,
  SegmentListSchema,
  SegmentSchema,
  SessionListSchema,
  SessionSchema,
  SessionSummarySchema,
  UserSchema,
  type MuteRange,
  type Participant,
  type Segment,
  type Session,
  type SessionSummary,
  type User,
} from "@/lib/schemas/data-api";

type UpstreamError = Error & {
  upstream: "data-api";
  status: number;
};

function upstreamError(status: number, message: string): UpstreamError {
  const err = new Error(message) as UpstreamError;
  err.upstream = "data-api";
  err.status = status;
  return err;
}

class DataApiClient {
  private token: string | null = null;
  private authInFlight: Promise<string> | null = null;

  private get baseUrl(): string {
    return env.DATA_API_URL;
  }

  private async authenticate(): Promise<string> {
    if (this.authInFlight) return this.authInFlight;
    this.authInFlight = (async () => {
      const start = performance.now();
      try {
        const res = await fetch(`${this.baseUrl}/internal/auth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shared_secret: env.SHARED_SECRET,
            service_name: "chronicle-portal",
          }),
          cache: "no-store",
        });
        if (!res.ok) {
          metrics.portal_bff_errors_total
            .labels("data-api", String(res.status))
            .inc();
          throw upstreamError(res.status, `auth failed: ${res.status}`);
        }
        const json = (await res.json()) as { session_token: string };
        this.token = json.session_token;
        return this.token;
      } finally {
        metrics.portal_bff_upstream_latency_ms
          .labels("data-api", "auth")
          .observe(performance.now() - start);
        this.authInFlight = null;
      }
    })();
    return this.authInFlight;
  }

  private async token$(): Promise<string> {
    return this.token ?? this.authenticate();
  }

  /** Public accessor for callers that need a bearer token (e.g. WS). */
  async getBearerToken(): Promise<string> {
    return this.token$();
  }

  /** Raw HTTP to the data-api, with auto re-auth on 401. */
  async raw(
    path: string,
    init: RequestInit & { op: string; retried?: boolean } = { op: "raw" },
  ): Promise<Response> {
    const token = await this.token$();
    const start = performance.now();
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          ...init.headers,
        },
        cache: "no-store",
      });
    } finally {
      metrics.portal_bff_upstream_latency_ms
        .labels("data-api", init.op)
        .observe(performance.now() - start);
    }

    if (res.status === 401 && !init.retried) {
      this.token = null;
      return this.raw(path, { ...init, retried: true });
    }

    if (!res.ok) {
      metrics.portal_bff_errors_total
        .labels("data-api", String(res.status))
        .inc();
    }
    return res;
  }

  private async json<T>(
    path: string,
    op: string,
    parser: (v: unknown) => T,
    init?: RequestInit,
  ): Promise<T> {
    const res = await this.raw(path, { ...init, op });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw upstreamError(
        res.status,
        `data-api ${op} ${path} ${res.status}: ${body}`,
      );
    }
    if (res.status === 204) return undefined as T;
    const value = (await res.json()) as unknown;
    return parser(value);
  }

  // ---- Users ----

  async upsertUser(pseudoId: string): Promise<User> {
    return this.json(
      `/internal/users`,
      "upsert_user",
      (v) => UserSchema.parse(v),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pseudo_id: pseudoId }),
      },
    );
  }

  async getUser(pseudoId: string): Promise<User> {
    return this.json(
      `/internal/users/${pseudoId}`,
      "get_user",
      (v) => {
        const obj = v as Record<string, unknown>;
        return UserSchema.parse(obj.user ?? obj);
      },
    );
  }

  async recordDisplayName(
    pseudoId: string,
    displayName: string,
    source = "discord",
  ): Promise<void> {
    await this.raw(`/internal/users/${pseudoId}/display_names`, {
      op: "record_display_name",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: displayName, source }),
    });
  }

  async setUserAdmin(pseudoId: string, isAdmin: boolean): Promise<User> {
    return this.json(
      `/internal/users/${pseudoId}`,
      "set_user_admin",
      (v) => UserSchema.parse(v),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_admin: isAdmin }),
      },
    );
  }

  async listUsers(): Promise<User[]> {
    return this.json(
      `/internal/admin/users`,
      "list_users",
      (v) => v as User[], // server-defined shape; loose parse.
    );
  }

  // ---- Sessions ----

  async listSessions(): Promise<Session[]> {
    return this.json(
      `/internal/sessions`,
      "list_sessions",
      (v) => SessionListSchema.parse(v),
    );
  }

  async getSession(id: string): Promise<Session> {
    return this.json(
      `/internal/sessions/${id}`,
      "get_session",
      (v) => SessionSchema.parse(v),
    );
  }

  async getSessionSummary(id: string): Promise<SessionSummary> {
    return this.json(
      `/internal/sessions/${id}/summary`,
      "get_session_summary",
      (v) => SessionSummarySchema.parse(v),
    );
  }

  async listParticipants(sessionId: string): Promise<Participant[]> {
    return this.json(
      `/internal/sessions/${sessionId}/participants`,
      "list_participants",
      (v) => ParticipantListSchema.parse(v),
    );
  }

  async getParticipant(participantId: string): Promise<Participant> {
    return this.json(
      `/internal/participants/${participantId}`,
      "get_participant",
      (v) => ParticipantSchema.parse(v),
    );
  }

  async patchParticipantConsent(
    participantId: string,
    body: { consent_scope: "full" | "decline" },
  ): Promise<Participant> {
    return this.json(
      `/internal/participants/${participantId}/consent`,
      "patch_participant_consent",
      (v) => ParticipantSchema.parse(v),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          consented_at: new Date().toISOString(),
        }),
      },
    );
  }

  async patchParticipantLicense(
    participantId: string,
    body: { no_llm_training?: boolean; no_public_release?: boolean },
  ): Promise<Participant> {
    return this.json(
      `/internal/participants/${participantId}/license`,
      "patch_participant_license",
      (v) => ParticipantSchema.parse(v),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  }

  async deleteParticipantAudio(
    sessionId: string,
    pseudoId: string,
  ): Promise<void> {
    const res = await this.raw(
      `/internal/sessions/${sessionId}/participants/${pseudoId}/audio`,
      { method: "DELETE", op: "delete_participant_audio" },
    );
    if (!res.ok && res.status !== 204) {
      throw upstreamError(res.status, `delete_participant_audio ${res.status}`);
    }
  }

  // ---- Segments ----

  async listSegments(sessionId: string): Promise<Segment[]> {
    return this.json(
      `/internal/sessions/${sessionId}/segments`,
      "list_segments",
      (v) => SegmentListSchema.parse(v),
    );
  }

  async getSegment(segmentId: string): Promise<Segment> {
    return this.json(
      `/internal/segments/${segmentId}`,
      "get_segment",
      (v) => SegmentSchema.parse(v),
    );
  }

  async patchSegment(
    segmentId: string,
    body: {
      text: string;
      author_service: "chronicle-portal";
      author_user_pseudo_id: string;
    },
  ): Promise<Segment> {
    return this.json(
      `/internal/segments/${segmentId}`,
      "patch_segment",
      (v) => SegmentSchema.parse(v),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  }

  // ---- Audio streaming ----

  async streamMixedAudio(
    sessionId: string,
    range?: string | null,
  ): Promise<Response> {
    const headers: Record<string, string> = {};
    if (range) headers["Range"] = range;
    return this.raw(`/internal/sessions/${sessionId}/audio/mixed/stream`, {
      op: "stream_mixed_audio",
      headers,
    });
  }

  async streamParticipantAudio(
    sessionId: string,
    pseudoId: string,
    range?: string | null,
  ): Promise<Response> {
    const headers: Record<string, string> = {};
    if (range) headers["Range"] = range;
    return this.raw(
      `/internal/sessions/${sessionId}/participants/${pseudoId}/audio/stream`,
      { op: "stream_participant_audio", headers },
    );
  }

  // ---- Mute ranges (admin) ----

  async listMuteRanges(sessionId: string, pseudoId: string): Promise<MuteRange[]> {
    return this.json(
      `/internal/sessions/${sessionId}/participants/${pseudoId}/mute`,
      "list_mute_ranges",
      (v) => (v as MuteRange[]),
    );
  }

  async createMuteRange(
    sessionId: string,
    pseudoId: string,
    body: { start_offset_ms: number; end_offset_ms: number; reason?: string },
  ): Promise<MuteRange> {
    return this.json(
      `/internal/sessions/${sessionId}/participants/${pseudoId}/mute`,
      "create_mute_range",
      (v) => (v as MuteRange),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  }

  async removeMuteRange(
    sessionId: string,
    pseudoId: string,
    rangeId: string,
  ): Promise<void> {
    const res = await this.raw(
      `/internal/sessions/${sessionId}/participants/${pseudoId}/mute/${rangeId}`,
      { op: "delete_mute_range", method: "DELETE" },
    );
    if (!res.ok && res.status !== 204) {
      throw upstreamError(res.status, `delete_mute_range ${res.status}`);
    }
  }

  // ---- Worker admin ----

  async triggerRerun(sessionId: string): Promise<Response> {
    const start = performance.now();
    try {
      return await fetch(`${env.WORKER_ADMIN_URL}/admin/rerun/${sessionId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.SHARED_SECRET}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });
    } finally {
      metrics.portal_bff_upstream_latency_ms
        .labels("worker", "rerun")
        .observe(performance.now() - start);
    }
  }
}

// Process-wide singleton. Use `global` so dev-server module reloads
// don't create a new client on every hot reload.
declare global {
  var __chronicle_data_api_client: DataApiClient | undefined;
}

export const dataApiClient: DataApiClient =
  global.__chronicle_data_api_client ??
  (global.__chronicle_data_api_client = new DataApiClient());

export type { DataApiClient };
