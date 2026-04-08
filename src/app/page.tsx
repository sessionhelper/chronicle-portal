"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDuration } from "@/lib/format";
import type { DataApiSession } from "@/lib/data-api";

interface DashboardStats {
  sessionCount: number;
  totalDuration: number;
  totalSegments: number;
}

function computeStats(sessions: DataApiSession[]): DashboardStats {
  let totalDuration = 0;
  let totalSegments = 0;
  for (const s of sessions) {
    if (s.ended_at) {
      totalDuration +=
        (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) /
        1000;
    }
    totalSegments += s.segment_count;
  }
  return { sessionCount: sessions.length, totalDuration, totalSegments };
}

export default function DashboardPage() {
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
          setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = computeStats(sessions);
  const recent = sessions.slice(0, 5);

  return (
    <AppShell>
      <h1 className="font-serif text-xl font-semibold text-ink">Dashboard</h1>

      {/* Stats cards */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded border border-rule bg-card-surface p-4">
          <p className="font-sans text-xs text-ink-faint">Sessions</p>
          <p className="mt-1 font-serif text-2xl font-semibold text-ink">
            {loading ? "..." : stats.sessionCount}
          </p>
        </div>
        <div className="rounded border border-rule bg-card-surface p-4">
          <p className="font-sans text-xs text-ink-faint">Total duration</p>
          <p className="mt-1 font-serif text-2xl font-semibold text-ink">
            {loading ? "..." : formatDuration(stats.totalDuration)}
          </p>
        </div>
        <div className="rounded border border-rule bg-card-surface p-4">
          <p className="font-sans text-xs text-ink-faint">Total segments</p>
          <p className="mt-1 font-serif text-2xl font-semibold text-ink">
            {loading ? "..." : stats.totalSegments.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="mt-4 rounded border border-danger/20 bg-danger/5 px-4 py-3">
          <p className="font-sans text-sm text-danger">{error}</p>
        </div>
      )}

      {/* Recent sessions */}
      <div className="mt-6">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-base font-semibold text-ink">
            Recent sessions
          </h2>
          <Link
            href="/sessions"
            className="font-sans text-xs text-accent-brown hover:underline"
          >
            View all
          </Link>
        </div>

        {loading ? (
          <p className="mt-3 font-sans text-sm text-ink-faint">Loading...</p>
        ) : recent.length === 0 ? (
          <p className="mt-3 font-sans text-sm text-ink-light">
            No sessions found. Sessions will appear once the data API has
            processed recordings.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-rule font-sans text-xs text-ink-faint">
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">Duration</th>
                  <th className="pb-2 pr-4 font-medium text-center">
                    Speakers
                  </th>
                  <th className="pb-2 pr-4 font-medium text-center">
                    Segments
                  </th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((session) => (
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
                        ? formatDuration(
                            (new Date(session.ended_at).getTime() -
                              new Date(session.started_at).getTime()) /
                              1000
                          )
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
