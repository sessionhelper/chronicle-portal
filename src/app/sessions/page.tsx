import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { LocalDate } from "@/components/local-date";
import { SessionLiveBadge } from "@/components/session-live-badge";
import { Card, CardContent } from "@/components/ui/card";
import { fetchVisibleSessions } from "@/lib/page-data";
import { AuthError, requireUser } from "@/lib/server-auth";

export default async function SessionsPage() {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof AuthError) redirect("/login");
    throw err;
  }
  const sessions = await fetchVisibleSessions(user).catch(() => []);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Sessions</h1>
        <p className="text-sm text-muted-foreground">
          {user.is_admin ? "All sessions" : "Sessions you were in or ran"}
        </p>
      </div>
      {sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No sessions visible to you yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <Link key={session.id} href={`/sessions/${session.id}`}>
              <Card className="hover:bg-accent/50 transition-colors">
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <div className="font-medium">
                      {session.campaign_name || session.title || (
                        <LocalDate iso={session.started_at} />
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <LocalDate iso={session.started_at} /> •{" "}
                      {session.participant_count ?? 0} participants •{" "}
                      {session.segment_count ?? 0} segments
                    </div>
                  </div>
                  <SessionLiveBadge
                    sessionId={session.id}
                    initialStatus={session.status}
                  />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
