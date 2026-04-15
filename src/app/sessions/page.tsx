import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { SessionLiveBadge } from "@/components/session-live-badge";
import { Card, CardContent } from "@/components/ui/card";
import { fetchVisibleSessions } from "@/lib/page-data";
import { requireUser } from "@/lib/server-auth";
import { formatDate } from "@/lib/utils";

export default async function SessionsPage() {
  const user = await requireUser();
  const sessions = await fetchVisibleSessions(user);

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
                      {session.campaign_name ||
                        session.title ||
                        formatDate(session.started_at)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(session.started_at)} •{" "}
                      {session.participant_count} participants •{" "}
                      {session.segment_count} segments
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
