/**
 * Zod schemas for chronicle-data-api types — authoritative shape reference
 * for anything flowing in or out of the BFF. Every data-api response used
 * by the portal should be parsed through these before it leaves the server
 * boundary.
 */

import { z } from "zod";

export const PseudoIdSchema = z
  .string()
  .regex(/^[0-9a-f]{24}$/, "invalid pseudo_id format: expected 24 hex chars");

// Session state machine from chronicle-data-api §2.
export const SessionStatusSchema = z.enum([
  "recording",
  "uploaded",
  "claim",
  "transcribing",
  "transcribed",
  "transcribing_failed",
  "abandoned",
  "deleted",
]);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const SessionSchema = z.object({
  id: z.string(),
  guild_id: z.string(),
  started_at: z.string(),
  ended_at: z.string().nullable(),
  status: SessionStatusSchema,
  game_system: z.string().nullable().optional(),
  campaign_name: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  initiator_pseudo_id: z.string().nullable().optional(),
  participant_count: z.number().int().nonnegative().nullable().default(0),
  segment_count: z.number().int().nonnegative().nullable().default(0),
  s3_prefix: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type Session = z.infer<typeof SessionSchema>;

export const SessionListSchema = z.array(SessionSchema);

export const SessionSummarySchema = z.object({
  chunk_count: z.number().int().nonnegative().nullable().default(0),
  participant_count: z.number().int().nonnegative().nullable().default(0),
  duration_ms: z.number().int().nonnegative().nullable().default(0),
  segment_count: z.number().int().nonnegative().nullable().default(0),
  beat_count: z.number().int().nonnegative(),
  scene_count: z.number().int().nonnegative(),
  mute_range_count: z.number().int().nonnegative(),
  aggregate_license_flags: z
    .object({
      no_llm_training: z.boolean(),
      no_public_release: z.boolean(),
    })
    .optional(),
});
export type SessionSummary = z.infer<typeof SessionSummarySchema>;

export const ParticipantSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  user_pseudo_id: z.string().nullable(),
  display_name: z.string().nullable().optional(),
  character_name: z.string().nullable().optional(),
  consent_scope: z.enum(["full", "decline", "timed_out"]).nullable().optional(),
  consented_at: z.string().nullable().optional(),
  no_llm_training: z.boolean().default(false),
  no_public_release: z.boolean().default(false),
  joined_at: z.string().optional(),
  left_at: z.string().nullable().optional(),
  data_wiped_at: z.string().nullable().optional(),
});
export type Participant = z.infer<typeof ParticipantSchema>;

export const ParticipantListSchema = z.array(ParticipantSchema);

export const SegmentSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  pseudo_id: z.string().optional(),
  speaker_pseudo_id: z.string().optional(),
  segment_index: z.number().int().optional(),
  start_ms: z.number().int().nonnegative().optional(),
  end_ms: z.number().int().nonnegative().optional(),
  start_time: z.number().optional(),
  end_time: z.number().optional(),
  text: z.string().nullable(),
  original: z.unknown().optional(),
  confidence: z.number().nullable().optional(),
  author_service: z.string().nullable().optional(),
  author_user_pseudo_id: z.string().nullable().optional(),
  beat_id: z.string().nullable().optional(),
  scene_id: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type Segment = z.infer<typeof SegmentSchema>;

export const SegmentListSchema = z.array(SegmentSchema);

export const UserSchema = z.object({
  pseudo_id: z.string(),
  is_admin: z.boolean().default(false),
  display_name: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type User = z.infer<typeof UserSchema>;

export const MuteRangeSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  pseudo_id: z.string(),
  start_offset_ms: z.number(),
  end_offset_ms: z.number(),
  reason: z.string().nullable().optional(),
  created_at: z.string().optional(),
});
export type MuteRange = z.infer<typeof MuteRangeSchema>;

export const DisplayNameSchema = z.object({
  pseudo_id: z.string(),
  display_name: z.string(),
  first_seen_at: z.string().optional(),
  last_seen_at: z.string().optional(),
  seen_count: z.number().int().nonnegative().optional(),
  source: z.string().optional(),
});

export const DisplayNameListSchema = z.array(DisplayNameSchema);
