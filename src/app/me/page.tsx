import { AppShell } from "@/components/app-shell";
import { SessionConsentCard } from "@/components/me/session-consent-card";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { dataApiClient } from "@/lib/data-api-client";
import { fetchVisibleSessions } from "@/lib/page-data";
import { formatDate } from "@/lib/utils";
import { requireUser } from "@/lib/server-auth";

export default async function MePage() {
  const user = await requireUser();
  const sessions = await fetchVisibleSessions(user);

  const rows = await Promise.all(
    sessions.map(async (s) => {
      const participants = await dataApiClient
        .listParticipants(s.id)
        .catch(() => []);
      const mine =
        participants.find((p) => p.user_pseudo_id === user.pseudo_id) ?? null;
      return mine ? { session: s, mine } : null;
    }),
  );
  const mySessions = rows.filter((r): r is NonNullable<typeof r> => !!r);
  const displayName = user.display_name ?? user.pseudo_id;

  return (
    <AppShell>
      <h1 className="mb-2 text-2xl font-semibold">Me</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Display name: {displayName} · Pseudo ID:{" "}
        <span className="font-mono">{user.pseudo_id}</span>
      </p>

      {mySessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            You haven&apos;t participated in any sessions yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {mySessions.map(({ session, mine }) => (
            <SessionConsentCard
              key={session.id}
              sessionId={session.id}
              sessionLabel={
                session.campaign_name ||
                session.title ||
                formatDate(session.started_at)
              }
              startedAt={session.started_at}
              consentScope={mine.consent_scope ?? null}
              noLlmTraining={mine.no_llm_training}
              noPublicRelease={mine.no_public_release}
              displayName={displayName}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
