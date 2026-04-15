import { describe, expect, it } from "vitest";

import {
  canEditSegment,
  filterSegmentsForRole,
  filterSessionsForUser,
} from "@/lib/filters";
import type { Segment, Session } from "@/lib/schemas/data-api";
import type { RequestUser } from "@/lib/server-auth";

const admin: RequestUser = {
  pseudo_id: "a".repeat(24),
  display_name: "admin",
  is_admin: true,
};
const player: RequestUser = {
  pseudo_id: "b".repeat(24),
  display_name: "player",
  is_admin: false,
};
const other: RequestUser = {
  pseudo_id: "c".repeat(24),
  display_name: "other",
  is_admin: false,
};

const mkSegment = (id: string, owner: string, extra?: Partial<Segment>): Segment => ({
  id,
  session_id: "s1",
  pseudo_id: owner,
  text: `text-${id}`,
  author_service: "pipeline",
  author_user_pseudo_id: owner,
  ...extra,
});

describe("filterSegmentsForRole", () => {
  const segments: Segment[] = [
    mkSegment("seg-a", "a".repeat(24)),
    mkSegment("seg-b", "b".repeat(24)),
    mkSegment("seg-c", "c".repeat(24)),
  ];

  it("admin sees all, with author fields", () => {
    const out = filterSegmentsForRole(admin, "admin", segments);
    expect(out).toHaveLength(3);
    expect(out[0].author_service).toBe("pipeline");
  });

  it("gm sees all, without author fields", () => {
    const out = filterSegmentsForRole(admin, "gm", segments);
    expect(out).toHaveLength(3);
    expect(out[0].author_service).toBeUndefined();
    expect(out[0].author_user_pseudo_id).toBeUndefined();
  });

  it("player sees only their own segments", () => {
    const out = filterSegmentsForRole(player, "player", segments);
    expect(out.map((s) => s.id)).toEqual(["seg-b"]);
    expect(out[0].author_service).toBeUndefined();
  });
});

describe("canEditSegment", () => {
  const seg = mkSegment("seg-b", "b".repeat(24));
  it("admin can edit anything", () => {
    expect(canEditSegment(admin, seg)).toBe(true);
  });
  it("owning player can edit their own", () => {
    expect(canEditSegment(player, seg)).toBe(true);
  });
  it("other player cannot edit", () => {
    expect(canEditSegment(other, seg)).toBe(false);
  });
});

describe("filterSessionsForUser", () => {
  const sessions: Session[] = [
    {
      id: "s1",
      guild_id: "g",
      started_at: "t",
      ended_at: null,
      status: "transcribed",
      initiator_pseudo_id: "b".repeat(24),
      participant_count: 3,
      segment_count: 10,
    },
    {
      id: "s2",
      guild_id: "g",
      started_at: "t",
      ended_at: null,
      status: "transcribed",
      initiator_pseudo_id: "a".repeat(24),
      participant_count: 2,
      segment_count: 5,
    },
    {
      id: "s3",
      guild_id: "g",
      started_at: "t",
      ended_at: null,
      status: "transcribed",
      initiator_pseudo_id: "a".repeat(24),
      participant_count: 1,
      segment_count: 2,
    },
  ];
  const participation = new Map([
    [player.pseudo_id, new Set(["s2"])],
  ]);

  it("admin sees everything", () => {
    const out = filterSessionsForUser(admin, sessions, participation);
    expect(out).toHaveLength(3);
  });

  it("player sees only initiated or participated", () => {
    const out = filterSessionsForUser(player, sessions, participation);
    expect(out.map((s) => s.id).sort()).toEqual(["s1", "s2"]);
  });

  it("user with no participation / initiation sees nothing", () => {
    const out = filterSessionsForUser(other, sessions, new Map());
    expect(out).toHaveLength(0);
  });
});
