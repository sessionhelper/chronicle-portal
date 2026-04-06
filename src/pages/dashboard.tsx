import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, type Session } from "../lib/api";
import { formatDate, formatDuration } from "../lib/format";
import { Badge } from "../components/ui/badge";

export function Dashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch<Session[]>("/sessions")
      .then(setSessions)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-ink-faint">Loading...</p>;
  if (error) return <p className="text-danger">Error: {error}</p>;

  const totalDuration = sessions.reduce(
    (sum, s) => sum + (s.duration_seconds ?? 0),
    0,
  );
  const totalSegments = sessions.reduce(
    (sum, s) => sum + (s.segment_count ?? 0),
    0,
  );
  const recent = sessions.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Sessions" value={String(sessions.length)} />
        <StatCard label="Total duration" value={formatDuration(totalDuration)} />
        <StatCard label="Segments" value={String(totalSegments)} />
      </div>

      {/* Recent sessions */}
      <div>
        <h2 className="mb-3 font-serif text-lg font-semibold text-ink">
          Recent sessions
        </h2>

        {recent.length === 0 ? (
          <p className="text-ink-faint">No sessions yet.</p>
        ) : (
          <div className="overflow-x-auto rounded border border-rule bg-card-surface">
            <table className="w-full text-left font-sans text-sm">
              <thead>
                <tr className="border-b border-rule text-ink-faint">
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Participants</th>
                  <th className="px-4 py-2 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr
                    key={s.id}
                    className="cursor-pointer border-b border-rule last:border-0 hover:bg-parchment-dark/40"
                    onClick={() => navigate(`/sessions/${s.id}`)}
                  >
                    <td className="px-4 py-2 text-ink">
                      {formatDate(s.started_at)}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={s.status}>{s.status}</Badge>
                    </td>
                    <td className="px-4 py-2 text-ink-light">
                      {s.participant_count}
                    </td>
                    <td className="px-4 py-2 text-ink-light">
                      {s.duration_seconds
                        ? formatDuration(s.duration_seconds)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-rule bg-card-surface p-4">
      <p className="font-sans text-xs text-ink-faint">{label}</p>
      <p className="mt-1 font-serif text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}
