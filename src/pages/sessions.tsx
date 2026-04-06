import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, type Session } from "../lib/api";
import { formatDate } from "../lib/format";
import { Badge } from "../components/ui/badge";

export function Sessions() {
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

  return (
    <div>
      <h2 className="mb-4 font-serif text-lg font-semibold text-ink">
        Sessions
      </h2>

      {sessions.length === 0 ? (
        <p className="text-ink-faint">No sessions yet.</p>
      ) : (
        <div className="overflow-x-auto rounded border border-rule bg-card-surface">
          <table className="w-full text-left font-sans text-sm">
            <thead>
              <tr className="border-b border-rule text-ink-faint">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Participants</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
