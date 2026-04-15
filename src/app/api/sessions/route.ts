import { NextResponse } from "next/server";

import { apiHandler } from "@/lib/api-handler";
import { dataApiClient } from "@/lib/data-api-client";
import { filterSessionsForUser } from "@/lib/filters";
import { requireUser } from "@/lib/server-auth";

export const GET = apiHandler("api.sessions.list", async () => {
  const user = await requireUser();
  const sessions = await dataApiClient.listSessions();

  if (user.is_admin) {
    return NextResponse.json(sessions);
  }

  // For non-admins, scope to sessions they participated in OR initiated.
  // We compute "participated in" by walking each session's participants
  // — cheap enough for MVP; when session count grows we can replace
  // with a data-api endpoint `/internal/users/{pseudo_id}/sessions`.
  const participationByPseudoId = new Map<string, Set<string>>();
  for (const session of sessions) {
    try {
      const participants = await dataApiClient.listParticipants(session.id);
      for (const p of participants) {
        if (!p.user_pseudo_id) continue;
        if (!participationByPseudoId.has(p.user_pseudo_id)) {
          participationByPseudoId.set(p.user_pseudo_id, new Set());
        }
        participationByPseudoId.get(p.user_pseudo_id)!.add(session.id);
      }
    } catch {
      // Swallow per-session errors; best effort for scoping.
    }
  }

  return NextResponse.json(
    filterSessionsForUser(user, sessions, participationByPseudoId),
  );
});
