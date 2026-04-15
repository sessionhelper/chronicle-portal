/**
 * PATCH /api/admin/users/:pseudo_id. Admin-only; body is strict boolean.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSetUserAdmin = vi.fn();

vi.mock("@/lib/data-api-client", () => ({
  dataApiClient: {
    getUser: async (id: string) => ({ pseudo_id: id, is_admin: false }),
    setUserAdmin: (id: string, flag: boolean) => mockSetUserAdmin(id, flag),
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
    requireAdmin: async () => {
      const u = await mockResolveUser();
      if (!u) throw new actual.AuthError(401, "unauthenticated");
      if (!u.is_admin) throw new actual.AuthError(403, "forbidden");
      return u;
    },
  };
});

import { PATCH } from "@/app/api/admin/users/[pseudo_id]/route";

const TARGET = "c".repeat(24);

beforeEach(() => {
  mockSetUserAdmin.mockReset();
  mockResolveUser.mockReset();
});

function req(body: unknown) {
  return new Request(`http://x/api/admin/users/${TARGET}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("PATCH /api/admin/users/:pseudo_id", () => {
  it("non-admin gets 403", async () => {
    mockResolveUser.mockResolvedValue({
      pseudo_id: "b".repeat(24),
      display_name: "player",
      is_admin: false,
    });
    const res = await PATCH(req({ is_admin: true }), {
      params: Promise.resolve({ pseudo_id: TARGET }),
    });
    expect(res.status).toBe(403);
    expect(mockSetUserAdmin).not.toHaveBeenCalled();
  });

  it("admin can grant is_admin", async () => {
    mockResolveUser.mockResolvedValue({
      pseudo_id: "a".repeat(24),
      display_name: "root",
      is_admin: true,
    });
    mockSetUserAdmin.mockResolvedValue({
      pseudo_id: TARGET,
      is_admin: true,
    });
    const res = await PATCH(req({ is_admin: true }), {
      params: Promise.resolve({ pseudo_id: TARGET }),
    });
    expect(res.status).toBe(200);
    expect(mockSetUserAdmin).toHaveBeenCalledWith(TARGET, true);
  });

  it("rejects non-boolean is_admin", async () => {
    mockResolveUser.mockResolvedValue({
      pseudo_id: "a".repeat(24),
      display_name: "root",
      is_admin: true,
    });
    const res = await PATCH(req({ is_admin: "yes" }), {
      params: Promise.resolve({ pseudo_id: TARGET }),
    });
    expect(res.status).toBe(400);
  });
});
