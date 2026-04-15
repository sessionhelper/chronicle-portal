/**
 * Zod schemas for BFF request bodies.
 *
 * These are the choke point: any user-authored PATCH body arrives here
 * first. Privileged fields (`author_service`, `author_user_pseudo_id`,
 * state transitions, etc.) are either absent from these schemas or
 * actively stripped — never forwarded to the data-api verbatim.
 */

import { z } from "zod";

/** PATCH /api/segments/:id — text edit only. Everything else is stripped. */
export const SegmentPatchBodySchema = z
  .object({
    text: z.string().min(0).max(50_000),
  })
  .strict();
export type SegmentPatchBody = z.infer<typeof SegmentPatchBodySchema>;

/** PATCH /api/me/sessions/:id/consent */
export const ConsentPatchBodySchema = z
  .object({
    consent_scope: z.enum(["full", "decline"]),
  })
  .strict();
export type ConsentPatchBody = z.infer<typeof ConsentPatchBodySchema>;

/** PATCH /api/me/sessions/:id/license */
export const LicensePatchBodySchema = z
  .object({
    no_llm_training: z.boolean().optional(),
    no_public_release: z.boolean().optional(),
  })
  .strict()
  .refine(
    (body) =>
      body.no_llm_training !== undefined ||
      body.no_public_release !== undefined,
    { message: "at least one license flag must be provided" },
  );
export type LicensePatchBody = z.infer<typeof LicensePatchBodySchema>;

/** POST /api/me/sessions/:id/delete-my-audio — confirmation phrase required. */
export const DeleteMyAudioBodySchema = z
  .object({
    confirm: z.literal("DELETE MY AUDIO"),
  })
  .strict();
export type DeleteMyAudioBody = z.infer<typeof DeleteMyAudioBodySchema>;

/** PATCH /api/admin/users/:pseudo_id — admin only. */
export const AdminUserPatchBodySchema = z
  .object({
    is_admin: z.boolean(),
  })
  .strict();
export type AdminUserPatchBody = z.infer<typeof AdminUserPatchBodySchema>;
