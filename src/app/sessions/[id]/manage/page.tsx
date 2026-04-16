import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { RerunButton } from "@/components/admin/rerun-button";
import { LocalDate } from "@/components/local-date";
import { SessionLiveBadge } from "@/components/session-live-badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchSessionDetail } from "@/lib/page-data";
import { AuthError, resolveSessionRole } from "@/lib/server-auth";
import { formatDuration } from "@/lib/utils";

type Props = { params: Promise<{ id: string }> };

export default async function ManageSessionPage({ params }: Props) {
  const { id } = await params;

  let data;
  try {
    data = await fetchSessionDetail(id);
  } catch (err) {
    if (err instanceof AuthError && (err.status === 404 || err.status === 403)) {
      notFound();
    }
    throw err;
  }

  const { user, session, participants, summary } = data;
  const { role } = await resolveSessionRole(user, id);

  if (role !== "admin" && role !== "gm") {
    redirect(`/sessions/${id}`);
  }

  const consented = participants.filter((p) => p.consent_scope === "full");
  const declined = participants.filter((p) => p.consent_scope === "decline");
  const pending = participants.filter((p) => !p.consent_scope);

  return (
    <AppShell>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            Manage:{" "}
            {session.campaign_name || session.title || (
              <LocalDate iso={session.started_at} />
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            <LocalDate iso={session.started_at} />
            {summary.duration_ms
              ? ` • ${formatDuration(summary.duration_ms / 1000)}`
              : ""}
            {" • "}Status: {session.status}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(user.is_admin || role === "gm") && (
            <RerunButton sessionId={session.id} />
          )}
          <SessionLiveBadge
            sessionId={session.id}
            initialStatus={session.status}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Participants</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{participants.length}</p>
            <p className="text-xs text-muted-foreground">
              {consented.length} consented • {declined.length} declined • {pending.length} pending
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {summary.duration_ms
                ? formatDuration(summary.duration_ms / 1000)
                : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Chunks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {summary.chunk_count ?? "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Participant Roster</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {participants.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded border px-4 py-3"
              >
                <div>
                  <p className="font-medium">
                    {p.display_name || p.character_name || p.user_pseudo_id || p.id}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.user_pseudo_id?.slice(0, 12)}…
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      p.consent_scope === "full"
                        ? "default"
                        : p.consent_scope === "decline"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {p.consent_scope || "pending"}
                  </Badge>
                  {p.no_llm_training && (
                    <Badge variant="secondary">no-llm</Badge>
                  )}
                  {p.no_public_release && (
                    <Badge variant="secondary">no-public</Badge>
                  )}
                  {p.data_wiped_at && (
                    <Badge variant="destructive">wiped</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
