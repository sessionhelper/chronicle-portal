/**
 * Integration test for PATCH /api/segments/:id.
 *
 * Mocks:
 *   - `@/lib/data-api-client` — dataApiClient methods replaced with vi.fn()
 *   - `@/lib/server-auth` — resolveUser returns whatever the test asks
 *
 * Covers: valid text edit (owner), 403 for non-owner, 400 for strict-mode
 * schema violation.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

type MockSegment = {
  id: string;
  session_id: string;
  pseudo_id: string;
  text: string;
  author_service?: string;
  author_user_pseudo_id?: string;
};

// ---- Mocks ----

const mockGetSegment = vi.fn();
const mockPatchSegment = vi.fn();

vi.mock("@/lib/data-api-client", () => ({
  dataApiClient: {
    getSegment: (id: string) => mockGetSegment(id),
    patchSegment: (id: string, body: unknown) => mockPatchSegment(id, body),
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
    requireAdmin: async () => {
      const u = await mockResolveUser();
      if (!u) throw new actual.AuthError(401, "unauthenticated");
      if (!u.is_admin) throw new actual.AuthError(403, "forbidden");
      return u;
    },
  };
});

// Import under test AFTER mocks.
import { PATCH } from "@/app/api/segments/[id]/route";

const owner = "b".repeat(24);
const otherUser = "c".repeat(24);

function makeRequest(body: unknown) {
  return new Request("http://x/api/segments/seg-1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  mockGetSegment.mockReset();
  mockPatchSegment.mockReset();
  mockResolveUser.mockReset();
});

describe("PATCH /api/segments/[id]", () => {
  it("owner can edit their own segment; BFF re-sets author fields", async () => {
    mockResolveUser.mockResolvedValue({
      pseudo_id: owner,
      display_name: "me",
      is_admin: false,
    });
    const segment: MockSegment = {
      id: "seg-1",
      session_id: "s1",
      pseudo_id: owner,
      text: "original",
    };
    mockGetSegment.mockResolvedValue(segment);
    mockPatchSegment.mockResolvedValue({ ...segment, text: "edited" });

    const res = await PATCH(
      makeRequest({ text: "edited" }),
      { params: Promise.resolve({ id: "seg-1" }) },
    );
    expect(res.status).toBe(200);
    expect(mockPatchSegment).toHaveBeenCalledWith(
      "seg-1",
      expect.objectContaining({
        text: "edited",
        author_service: "chronicle-portal",
        author_user_pseudo_id: owner,
      }),
    );
  });

  it("strips client-supplied author fields before they can reach the data-api", async () => {
    mockResolveUser.mockResolvedValue({
      pseudo_id: owner,
      display_name: "me",
      is_admin: false,
    });

    const res = await PATCH(
      makeRequest({
        text: "edited",
        author_service: "malicious",
        author_user_pseudo_id: otherUser,
      }),
      { params: Promise.resolve({ id: "seg-1" }) },
    );
    expect(res.status).toBe(400);
    expect(mockPatchSegment).not.toHaveBeenCalled();
  });

  it("non-owner gets 403", async () => {
    mockResolveUser.mockResolvedValue({
      pseudo_id: otherUser,
      display_name: "other",
      is_admin: false,
    });
    mockGetSegment.mockResolvedValue({
      id: "seg-1",
      session_id: "s1",
      pseudo_id: owner,
      text: "mine",
    });

    const res = await PATCH(
      makeRequest({ text: "edited" }),
      { params: Promise.resolve({ id: "seg-1" }) },
    );
    expect(res.status).toBe(403);
    expect(mockPatchSegment).not.toHaveBeenCalled();
  });

  it("admin can edit anyone's segment", async () => {
    mockResolveUser.mockResolvedValue({
      pseudo_id: otherUser,
      display_name: "admin",
      is_admin: true,
    });
    mockGetSegment.mockResolvedValue({
      id: "seg-1",
      session_id: "s1",
      pseudo_id: owner,
      text: "mine",
    });
    mockPatchSegment.mockResolvedValue({
      id: "seg-1",
      session_id: "s1",
      pseudo_id: owner,
      text: "admin edit",
    });

    const res = await PATCH(
      makeRequest({ text: "admin edit" }),
      { params: Promise.resolve({ id: "seg-1" }) },
    );
    expect(res.status).toBe(200);
    expect(mockPatchSegment).toHaveBeenCalled();
  });

  it("unauthenticated gets 401", async () => {
    mockResolveUser.mockResolvedValue(null);
    const res = await PATCH(
      makeRequest({ text: "hi" }),
      { params: Promise.resolve({ id: "seg-1" }) },
    );
    expect(res.status).toBe(401);
  });
});
