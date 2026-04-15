import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SegmentList } from "@/components/segment-list";
import { SessionLiveBadge } from "@/components/session-live-badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { canEditSegment } from "@/lib/filters";
import { fetchSessionDetail } from "@/lib/page-data";
import { AuthError } from "@/lib/server-auth";
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
  const canEdit: Record<string, boolean> = {};
  for (const seg of segments) {
    canEdit[seg.id] = canEditSegment(user, seg);
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {session.campaign_name || session.title || formatDate(session.started_at)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(session.started_at)} • {participants.length} participants
            {summary.duration_ms
              ? ` • ${formatDuration(summary.duration_ms / 1000)}`
              : ""}
          </p>
        </div>
        <SessionLiveBadge
          sessionId={session.id}
          initialStatus={session.status}
        />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Audio</CardTitle>
        </CardHeader>
        <CardContent>
          <audio
            controls
            className="w-full"
            src={`/api/sessions/${session.id}/audio/mixed/stream`}
            preload="metadata"
          />
        </CardContent>
      </Card>

      <h2 className="mb-3 text-xl font-semibold">Transcript</h2>
      <SegmentList
        segments={segments}
        participants={participants}
        canEdit={canEdit}
      />
    </AppShell>
  );
}
