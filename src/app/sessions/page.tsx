"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDuration } from "@/lib/format";
import type { DataApiSession } from "@/lib/data-api";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<DataApiSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/sessions");
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data: DataApiSession[] = await res.json();
        if (!cancelled) {
          data.sort(
            (a, b) =>
              new Date(b.started_at).getTime() -
              new Date(a.started_at).getTime()
          );
          setSessions(data);
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load sessions");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell>
      <h1 className="font-serif text-xl font-semibold text-ink">Sessions</h1>

      {error && (
        <div className="mt-4 rounded border border-danger/20 bg-danger/5 px-4 py-3">
          <p className="font-sans text-sm text-danger">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="mt-4 font-sans text-sm text-ink-faint">
          Loading sessions...
        </p>
      ) : sessions.length === 0 ? (
        <p className="mt-4 font-sans text-sm text-ink-light">
          No sessions found.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-rule font-sans text-xs text-ink-faint">
                <th className="pb-2 pr-4 font-medium">Date</th>
                <th className="pb-2 pr-4 font-medium">Duration</th>
                <th className="pb-2 pr-4 font-medium text-center">Speakers</th>
                <th className="pb-2 pr-4 font-medium text-center">Segments</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => {
                const duration = session.ended_at
                  ? (new Date(session.ended_at).getTime() -
                      new Date(session.started_at).getTime()) /
                    1000
                  : 0;
                return (
                  <tr
                    key={session.id}
                    className="border-b border-rule/50 transition-colors duration-100 hover:bg-parchment-dark"
                  >
                    <td className="py-2.5 pr-4">
                      <Link
                        href={`/sessions/${session.id}`}
                        className="font-sans text-sm text-accent-brown hover:underline"
                      >
                        {formatDate(session.started_at)}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4 font-sans text-sm text-ink-light">
                      {session.ended_at
                        ? formatDuration(duration)
                        : "In progress"}
                    </td>
                    <td className="py-2.5 pr-4 text-center font-sans text-sm text-ink-light">
                      {session.participant_count}
                    </td>
                    <td className="py-2.5 pr-4 text-center font-sans text-sm text-ink-light">
                      {session.segment_count}
                    </td>
                    <td className="py-2.5">
                      <Badge
                        variant="secondary"
                        className="font-sans text-[10px]"
                      >
                        {session.status}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
