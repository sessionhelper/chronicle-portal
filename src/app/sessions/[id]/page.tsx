import Link from "next/link";
import { notFound } from "next/navigation";

import { MuteRanges } from "@/components/admin/mute-ranges";
import { RerunButton } from "@/components/admin/rerun-button";
import { AppShell } from "@/components/app-shell";
import { DownloadBar } from "@/components/download-bar";
import { LocalDate } from "@/components/local-date";
import { SessionLiveBadge } from "@/components/session-live-badge";
import { TranscriptViewer } from "@/components/transcript-viewer";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { canEditSegment } from "@/lib/filters";
import { fetchSessionDetail } from "@/lib/page-data";
import { AuthError, resolveSessionRole } from "@/lib/server-auth";
import { formatDate, formatDuration } from "@/lib/utils";

type Props = { params: Promise<{ id: string }> };

export default async function SessionDetailPage({ params }: Props) {
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

  const { user, session, participants, segments, summary } = data;
  const { role } = await resolveSessionRole(user, id);
  const canManage = role === "admin" || role === "gm";
  const canEdit: Record<string, boolean> = {};
  for (const seg of segments) {
    canEdit[seg.id] = canEditSegment(user, seg);
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {session.campaign_name || session.title || (
              <LocalDate iso={session.started_at} />
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            <LocalDate iso={session.started_at} /> • {participants.length} participants
            {summary.duration_ms
              ? ` • ${formatDuration(summary.duration_ms / 1000)}`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <Link href={`/sessions/${session.id}/manage`}>
              <Button variant="secondary" size="sm">Manage</Button>
            </Link>
          )}
          {user.is_admin && <RerunButton sessionId={session.id} />}
          <SessionLiveBadge
            sessionId={session.id}
            initialStatus={session.status}
          />
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Downloads</CardTitle>
        </CardHeader>
        <CardContent>
          <DownloadBar
            sessionId={session.id}
            sessionName={session.campaign_name || session.title || formatDate(session.started_at)}
            segments={segments}
            participants={participants}
            userPseudoId={user.pseudo_id}
            isAdmin={user.is_admin}
          />
        </CardContent>
      </Card>

      <h2 className="mb-3 text-xl font-semibold">Transcript</h2>
      <TranscriptViewer
        sessionId={session.id}
        initialSegments={segments}
        initialParticipants={participants}
        audioSrc={`/api/sessions/${session.id}/audio/mixed/stream`}
        canEdit={(seg) => canEdit[seg.id] ?? false}
      />

      {user.is_admin && participants.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Mute Ranges</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {participants.map((p) => (
              <MuteRanges
                key={p.user_pseudo_id ?? p.id}
                sessionId={session.id}
                pseudoId={p.user_pseudo_id ?? p.id}
                participantName={p.display_name || p.user_pseudo_id || p.id}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
