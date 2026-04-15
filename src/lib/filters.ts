/**
 * Response filters. Per spec §Behavior:
 *   - Players see only their own segments + public metadata
 *   - Audit-log fields (author_service, author_user_pseudo_id) stripped
 *     unless caller is admin
 *   - Sessions the caller has no access to are not returned
 *
 * Every filter is a pure function from (user, data) → data. Composition
 * over conditionals; never mutate the input.
 */

import type { RequestUser, SessionRole } from "@/lib/server-auth";
import type {
  Participant,
  Segment,
  Session,
} from "@/lib/schemas/data-api";

export function filterSessionsForUser(
  user: RequestUser,
  sessions: Session[],
  participationByPseudoId: Map<string, Set<string>>,
): Session[] {
  if (user.is_admin) return sessions;
  const mine = participationByPseudoId.get(user.pseudo_id) ?? new Set();
  return sessions.filter(
    (s) => mine.has(s.id) || s.initiator_pseudo_id === user.pseudo_id,
  );
}

export function filterSegmentsForRole(
  user: RequestUser,
  role: SessionRole,
  segments: Segment[],
): Segment[] {
  const visible =
    role === "admin" || role === "gm"
      ? segments
      : segments.filter((s) => {
          const owner = s.pseudo_id ?? s.speaker_pseudo_id;
          return owner === user.pseudo_id;
        });
  // Strip audit fields for non-admin.
  if (role === "admin") return visible;
  return visible.map((segment) => {
    const copy = { ...segment };
    delete copy.author_service;
    delete copy.author_user_pseudo_id;
    return copy;
  });
}

export function filterParticipantsForRole(
  role: SessionRole,
  participants: Participant[],
): Participant[] {
  // Everyone who can see the session sees the participant roster (names
  // are public within a session). Consent/license specifics stay on the
  // row — those are intentionally part of the participant shape and are
  // used by /me. If we later need to hide them from other players, do it
  // here rather than sprinkling across handlers.
  return role === "admin" ? participants : participants;
}

/**
 * Determine if the caller can edit a given segment (spec §Behavior:
 * admin OR owning player).
 */
export function canEditSegment(
  user: RequestUser,
  segment: Segment,
): boolean {
  if (user.is_admin) return true;
  const owner = segment.pseudo_id ?? segment.speaker_pseudo_id;
  return owner === user.pseudo_id;
}
