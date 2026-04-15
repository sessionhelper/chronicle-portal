/**
 * Integration test for POST /api/me/sessions/:id/delete-my-audio.
 *
 * Confirms that:
 *   - the confirmation phrase is enforced (400 without it)
 *   - non-participants can't wipe data on a session they weren't in
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
const mockListParticipants = vi.fn();
const mockDeleteParticipantAudio = vi.fn();

vi.mock("@/lib/data-api-client", () => ({
  dataApiClient: {
    getUser: async (id: string) => ({ pseudo_id: id, is_admin: false }),
    getSession: (id: string) => mockGetSession(id),
    listParticipants: (id: string) => mockListParticipants(id),
    deleteParticipantAudio: (sid: string, pid: string) =>
      mockDeleteParticipantAudio(sid, pid),
  },
}));

const mockResolveUser = vi.fn();
vi.mock("@/lib/server-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server-auth")>(
    "@/lib/server-auth",
  );
  return {
    ...actual,
    resolveUser: () => mockResolveUser(),
    requireUser: async () => {
      const u = await mockResolveUser();
      if (!u) throw new actual.AuthError(401, "unauthenticated");
      return u;
    },
  };
});

import { POST } from "@/app/api/me/sessions/[id]/delete-my-audio/route";

const pseudo = "b".repeat(24);

beforeEach(() => {
  mockGetSession.mockReset();
  mockListParticipants.mockReset();
  mockDeleteParticipantAudio.mockReset();
  mockResolveUser.mockReset();
});

function req(body: unknown) {
  return new Request("http://x/api/me/sessions/s1/delete-my-audio", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/me/sessions/:id/delete-my-audio", () => {
  it("rejects without confirmation phrase", async () => {
    mockResolveUser.mockResolvedValue({
      pseudo_id: pseudo,
      display_name: "me",
      is_admin: false,
    });
    const res = await POST(req({}), {
      params: Promise.resolve({ id: "s1" }),
    });
    expect(res.status).toBe(400);
    expect(mockDeleteParticipantAudio).not.toHaveBeenCalled();
  });

  it("non-participant gets 404 (spec: no existence leak)", async () => {
    mockResolveUser.mockResolvedValue({
      pseudo_id: pseudo,
      display_name: "me",
      is_admin: false,
    });
    mockGetSession.mockResolvedValue({
      id: "s1",
      initiator_pseudo_id: "z".repeat(24),
    });
    mockListParticipants.mockResolvedValue([]);

    const res = await POST(req({ confirm: "DELETE MY AUDIO" }), {
      params: Promise.resolve({ id: "s1" }),
    });
    expect(res.status).toBe(404);
  });

  it("participant with confirmation triggers delete on data-api", async () => {
    mockResolveUser.mockResolvedValue({
      pseudo_id: pseudo,
      display_name: "me",
      is_admin: false,
    });
    mockGetSession.mockResolvedValue({
      id: "s1",
      initiator_pseudo_id: "z".repeat(24),
    });
    mockListParticipants.mockResolvedValue([
      { id: "part-1", session_id: "s1", user_pseudo_id: pseudo },
    ]);
    mockDeleteParticipantAudio.mockResolvedValue(undefined);

    const res = await POST(req({ confirm: "DELETE MY AUDIO" }), {
      params: Promise.resolve({ id: "s1" }),
    });
    expect(res.status).toBe(200);
    expect(mockDeleteParticipantAudio).toHaveBeenCalledWith("s1", pseudo);
  });
});
