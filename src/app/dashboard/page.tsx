import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { LocalDate } from "@/components/local-date";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchVisibleSessions } from "@/lib/page-data";
import { AuthError, requireUser } from "@/lib/server-auth";

export default async function DashboardPage() {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof AuthError) {
      redirect("/login");
    }
    throw err;
  }

  const sessions = await fetchVisibleSessions(user).catch(() => []);
  const latest = sessions[0];

  return (
    <AppShell>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">{sessions.length}</p>
            <Link
              href="/sessions"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              View all →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Latest session</CardTitle>
          </CardHeader>
          <CardContent>
            {latest ? (
              <div className="space-y-2">
                <Link
                  href={`/sessions/${latest.id}`}
                  className="text-lg font-medium hover:underline"
                >
                  {latest.campaign_name || latest.title || (
                    <LocalDate iso={latest.started_at} />
                  )}
                </Link>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{latest.status}</Badge>
                  <span className="text-sm text-muted-foreground">
                    <LocalDate iso={latest.started_at} />
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No sessions yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
