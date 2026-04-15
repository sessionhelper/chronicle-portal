import { describe, expect, it } from "vitest";

import {
  AdminUserPatchBodySchema,
  ConsentPatchBodySchema,
  DeleteMyAudioBodySchema,
  LicensePatchBodySchema,
  SegmentPatchBodySchema,
} from "@/lib/schemas/bff";

describe("SegmentPatchBodySchema", () => {
  it("accepts a text-only body", () => {
    expect(SegmentPatchBodySchema.parse({ text: "hello" })).toEqual({
      text: "hello",
    });
  });

  it("strips user-supplied author fields (strict mode)", () => {
    const body = {
      text: "hello",
      author_service: "chronicle-bot",
      author_user_pseudo_id: "a".repeat(24),
    };
    expect(() => SegmentPatchBodySchema.parse(body)).toThrow();
  });

  it("rejects overly long text", () => {
    expect(() =>
      SegmentPatchBodySchema.parse({ text: "a".repeat(60_000) }),
    ).toThrow();
  });
});

describe("ConsentPatchBodySchema", () => {
  it("accepts full / decline", () => {
    expect(
      ConsentPatchBodySchema.parse({ consent_scope: "full" }).consent_scope,
    ).toBe("full");
    expect(
      ConsentPatchBodySchema.parse({ consent_scope: "decline" }).consent_scope,
    ).toBe("decline");
  });

  it("rejects timed_out (only settable server-side)", () => {
    expect(() =>
      ConsentPatchBodySchema.parse({ consent_scope: "timed_out" }),
    ).toThrow();
  });

  it("rejects extra fields", () => {
    expect(() =>
      ConsentPatchBodySchema.parse({
        consent_scope: "full",
        consented_at: "2026-01-01T00:00:00Z",
      }),
    ).toThrow();
  });
});

describe("LicensePatchBodySchema", () => {
  it("accepts one flag", () => {
    expect(
      LicensePatchBodySchema.parse({ no_llm_training: true }).no_llm_training,
    ).toBe(true);
  });

  it("rejects empty body", () => {
    expect(() => LicensePatchBodySchema.parse({})).toThrow();
  });
});

describe("DeleteMyAudioBodySchema", () => {
  it("requires the exact confirmation phrase", () => {
    expect(() => DeleteMyAudioBodySchema.parse({ confirm: "yes" })).toThrow();
    expect(
      DeleteMyAudioBodySchema.parse({ confirm: "DELETE MY AUDIO" }).confirm,
    ).toBe("DELETE MY AUDIO");
  });
});

describe("AdminUserPatchBodySchema", () => {
  it("accepts is_admin boolean", () => {
    expect(
      AdminUserPatchBodySchema.parse({ is_admin: true }).is_admin,
    ).toBe(true);
  });

  it("rejects non-boolean", () => {
    expect(() =>
      AdminUserPatchBodySchema.parse({ is_admin: "yes" }),
    ).toThrow();
  });
});
