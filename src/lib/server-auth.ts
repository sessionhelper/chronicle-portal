/**
 * Server-side request identity + authorization helpers.
 *
 * Every BFF route starts with `resolveUser()`. It reads the Auth.js
 * JWT, then queries data-api for the authoritative `is_admin` value
 * (runtime-evaluated per spec §Behavior).
 *
 * No IF-forest: handlers call `requireUser()` / `requireAdmin()` and the
 * helpers throw early with tagged auth errors that `apiHandler()`
 * translates to 401 / 403.
 */

import { auth } from "@/lib/auth";
import { dataApiClient } from "@/lib/data-api-client";

export type RequestUser = {
  pseudo_id: string;
  display_name: string | null;
  is_admin: boolean;
};

export class AuthError extends Error {
  constructor(
    public readonly status: 401 | 403 | 404,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Resolve the logged-in user, or return null if not signed in.
 * Combines JWT (identity) + data-api `is_admin` (authorization).
 */
export async function resolveUser(): Promise<RequestUser | null> {
  const session = await auth();
  if (!session?.user?.pseudo_id) return null;
  const pseudoId = session.user.pseudo_id;
  let isAdmin = false;
  try {
    const user = await dataApiClient.getUser(pseudoId);
    isAdmin = user.is_admin;
  } catch {
    // If data-api is unreachable, treat as non-admin but still signed in.
  }
  return {
    pseudo_id: pseudoId,
    display_name: session.user.display_name ?? session.user.name ?? null,
    is_admin: isAdmin,
  };
}

/** Throws AuthError(401) if not signed in. */
export async function requireUser(): Promise<RequestUser> {
  const user = await resolveUser();
  if (!user) throw new AuthError(401, "unauthenticated");
  return user;
}

/** Throws AuthError(403) if the caller is not admin. */
export async function requireAdmin(): Promise<RequestUser> {
  const user = await requireUser();
  if (!user.is_admin) throw new AuthError(403, "forbidden");
  return user;
}

/**
 * Session-scope authorization. Returns a role decision for the caller
 * against a given session — everything else the handlers need derives
 * from this. Admin sees everything; initiator is GM; participants are
 * players; nobody else gets through.
 */
export type SessionRole = "admin" | "gm" | "player" | "none";

export async function resolveSessionRole(
  user: RequestUser,
  sessionId: string,
): Promise<{
  role: SessionRole;
  participantId: string | null;
}> {
  if (user.is_admin) return { role: "admin", participantId: null };

  const [session, participants] = await Promise.all([
    dataApiClient.getSession(sessionId),
    dataApiClient.listParticipants(sessionId),
  ]);

  const mine =
    participants.find((p) => p.user_pseudo_id === user.pseudo_id) ?? null;

  if (session.initiator_pseudo_id === user.pseudo_id) {
    return { role: "gm", participantId: mine?.id ?? null };
  }
  if (mine) return { role: "player", participantId: mine.id };
  return { role: "none", participantId: null };
}

/**
 * Require at least a participant-level view on a session. 404 if the
 * caller has no access — per spec, "404 for both non-existent and
 * forbidden unless the caller could otherwise infer existence."
 */
export async function requireSessionAccess(
  user: RequestUser,
  sessionId: string,
): Promise<{ role: SessionRole; participantId: string | null }> {
  const decision = await resolveSessionRole(user, sessionId);
  if (decision.role === "none") throw new AuthError(404, "not found");
  return decision;
}
