export interface User {
  id: string;
  pseudo_id: string;
  global_opt_out: boolean;
  opt_out_at: string | null;
  created_at: string;
}

export interface SessionListItem {
  id: string;
  started_at: string;
  ended_at: string | null;
  game_system: string | null;
  campaign_name: string | null;
  participant_count: number;
  status: string;
  consent_scope: string | null;
}

export interface SessionDetail {
  id: string;
  started_at: string;
  ended_at: string | null;
  game_system: string | null;
  campaign_name: string | null;
  participant_count: number;
  status: string;
  collaborative_editing: boolean;
  consent_scope: string | null;
  consented_at: string | null;
  withdrawn_at: string | null;
  has_transcript: boolean;
}

/**
 * A participant row joined with the current user's identity. Used by the
 * session detail page to render "my" license toggles. Flags are the two
 * independent booleans stored per participant in chronicle-data-api.
 */
export interface MyParticipant {
  id: string;
  session_id: string;
  user_pseudo_id: string | null;
  no_llm_training: boolean;
  no_public_release: boolean;
}

/**
 * Partial update shape for the license flags. Either flag can be
 * toggled independently; omitted fields are unchanged server-side via
 * COALESCE in the data-api route.
 */
export interface LicenseFlagUpdate {
  no_llm_training?: boolean;
  no_public_release?: boolean;
}

export interface TranscriptSegment {
  id: string;
  segment_index: number;
  speaker_label: string;
  is_own_line: boolean;
  can_edit: boolean;
  start_time: number;
  end_time: number;
  text: string | null;
  original_text: string;
  confidence: number | null;
  edited: boolean;
  flagged: boolean;
  flagged_by_me: boolean;
  flag_reason: string | null;
}

export interface AuditEntry {
  id: string;
  user_id: string;
  session_id: string | null;
  action: string;
  previous_scope: string | null;
  new_scope: string | null;
  timestamp: string;
}
