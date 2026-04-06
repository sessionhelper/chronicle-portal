import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch, type Session, type Segment, type Participant } from "../lib/api";
import { formatDate, formatDuration, formatTime } from "../lib/format";
import { Badge } from "../components/ui/badge";

/** Hash a pseudo_id to a hue (0-360) for speaker color dots. */
function pseudoHue(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

export function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    Promise.all([
      apiFetch<Session>(`/sessions/${id}`),
      apiFetch<Segment[]>(`/sessions/${id}/segments`),
      apiFetch<Participant[]>(`/sessions/${id}/participants`),
    ])
      .then(([s, seg, p]) => {
        setSession(s);
        setSegments(seg.sort((a, b) => a.start_time - b.start_time));
        setParticipants(p);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-ink-faint">Loading...</p>;
  if (error) return <p className="text-danger">Error: {error}</p>;
  if (!session) return <p className="text-ink-faint">Session not found.</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded border border-rule bg-card-surface p-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="font-serif text-lg font-semibold text-ink">
            {session.id.slice(0, 8)}...
          </h2>
          <Badge variant={session.status}>{session.status}</Badge>
        </div>
        <div className="mt-2 flex flex-wrap gap-4 font-sans text-sm text-ink-light">
          <span>{formatDate(session.started_at)}</span>
          {session.duration_seconds != null && (
            <span>{formatDuration(session.duration_seconds)}</span>
          )}
          <span>
            {participants.length} participant{participants.length !== 1 && "s"}
          </span>
          <span>
            {segments.length} segment{segments.length !== 1 && "s"}
          </span>
        </div>
      </div>

      {/* Transcript */}
      <div>
        <h3 className="mb-3 font-serif text-base font-semibold text-ink">
          Transcript
        </h3>

        {segments.length === 0 ? (
          <p className="text-ink-faint">No segments recorded.</p>
        ) : (
          <div className="space-y-1">
            {segments.map((seg) => (
              <div
                key={seg.id}
                className="flex gap-3 rounded border border-rule bg-card-surface px-4 py-2"
              >
                {/* Speaker dot + pseudo_id */}
                <div className="flex shrink-0 items-center gap-1.5 font-sans text-xs text-ink-light">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor: `hsl(${pseudoHue(seg.pseudo_id)}, 50%, 45%)`,
                    }}
                  />
                  <span className="w-16 truncate">{seg.pseudo_id}</span>
                </div>

                {/* Timestamp */}
                <span className="shrink-0 font-sans text-xs text-ink-faint tabular-nums">
                  {formatTime(seg.start_time)}
                </span>

                {/* Text */}
                <p className="font-serif text-sm text-ink">{seg.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
