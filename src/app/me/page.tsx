import { AppShell } from "@/components/app-shell";
import { LocalDate } from "@/components/local-date";
import { ConsentForm } from "@/components/me/consent-form";
import { DeleteMyAudioButton } from "@/components/me/delete-my-audio";
import { LicenseSwitches } from "@/components/me/license-switches";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { dataApiClient } from "@/lib/data-api-client";
import { fetchVisibleSessions } from "@/lib/page-data";
import { requireUser } from "@/lib/server-auth";

export default async function MePage() {
  const user = await requireUser();
  const sessions = await fetchVisibleSessions(user);

  // Pull per-session participant rows so we can render consent/license
  // sliders scoped to *my* participation.
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

  return (
    <AppShell>
      <h1 className="mb-2 text-2xl font-semibold">Me</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Display name: {user.display_name ?? "(not set)"} • Pseudo ID:{" "}
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
            <Card key={session.id}>
              <CardHeader>
                <CardTitle>
                  {session.campaign_name || session.title || (
                    <LocalDate iso={session.started_at} />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <section>
                  <h3 className="mb-2 text-sm font-medium">Consent</h3>
                  <ConsentForm
                    sessionId={session.id}
                    current={mine.consent_scope ?? null}
                  />
                </section>
                <section>
                  <h3 className="mb-2 text-sm font-medium">License</h3>
                  <LicenseSwitches
                    sessionId={session.id}
                    noLlmTraining={mine.no_llm_training}
                    noPublicRelease={mine.no_public_release}
                  />
                </section>
                <section className="flex justify-end pt-2">
                  <DeleteMyAudioButton sessionId={session.id} />
                </section>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
