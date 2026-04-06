"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { formatDate, formatDuration } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import type { SessionListItem } from "@/lib/types";

function statusVariant(status: string) {
  switch (status) {
    case "published":
    case "uploaded":
      return "default" as const;
    case "recording":
      return "secondary" as const;
    case "awaiting_consent":
      return "outline" as const;
    default:
      return "secondary" as const;
  }
}

function licenseVariant(license: string) {
  switch (license) {
    case "open":
      return "default" as const;
    case "rail":
      return "secondary" as const;
    case "private":
      return "outline" as const;
    default:
      return "secondary" as const;
  }
}

function licenseLabel(license: string) {
  switch (license) {
    case "open":
      return "Open";
    case "rail":
      return "Research";
    case "private":
      return "Private";
    default:
      return license;
  }
}

function durationSeconds(item: SessionListItem): number {
  if (!item.ended_at) return 0;
  return (new Date(item.ended_at).getTime() - new Date(item.started_at).getTime()) / 1000;
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api.sessions.list();
        if (!cancelled) {
          // Sort by date descending
          data.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
          setSessions(data);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load sessions");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <p className="font-sans text-sm text-ink-faint">Loading sessions...</p>
    );
  }

  if (error) {
    return (
      <div className="rounded border border-danger/20 bg-danger/5 px-4 py-3">
        <p className="font-sans text-sm text-danger">{error}</p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div>
        <h1 className="font-serif text-xl font-semibold text-ink">My Sessions</h1>
        <p className="mt-3 font-sans text-sm text-ink-light">
          No recorded sessions yet. Sessions will appear here after you participate in a recorded TTRPG session.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-serif text-xl font-semibold text-ink">My Sessions</h1>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-rule font-sans text-xs text-ink-faint">
              <th className="pb-2 pr-4 font-medium">Date</th>
              <th className="pb-2 pr-4 font-medium">Duration</th>
              <th className="pb-2 pr-4 font-medium">System</th>
              <th className="pb-2 pr-4 font-medium text-center">Players</th>
              <th className="pb-2 pr-4 font-medium">Status</th>
              <th className="pb-2 pr-4 font-medium">Consent</th>
              <th className="pb-2 font-medium">License</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr
                key={session.id}
                className="border-b border-rule/50 transition-colors duration-100 hover:bg-parchment-dark"
              >
                <td className="py-2.5 pr-4">
                  <Link
                    href={`/dashboard/sessions/${session.id}`}
                    className="font-sans text-sm text-accent-brown hover:underline"
                  >
                    {formatDate(session.started_at)}
                  </Link>
                </td>
                <td className="py-2.5 pr-4 font-sans text-sm text-ink-light">
                  {session.ended_at ? formatDuration(durationSeconds(session)) : "In progress"}
                </td>
                <td className="py-2.5 pr-4 font-sans text-sm text-ink-light">
                  {session.game_system ?? "—"}
                </td>
                <td className="py-2.5 pr-4 text-center font-sans text-sm text-ink-light">
                  {session.participant_count}
                </td>
                <td className="py-2.5 pr-4">
                  <Badge variant={statusVariant(session.status)} className="font-sans text-[10px]">
                    {session.status}
                  </Badge>
                </td>
                <td className="py-2.5 pr-4 font-sans text-sm text-ink-light">
                  {session.consent_scope ?? "—"}
                </td>
                <td className="py-2.5">
                  <Badge variant={licenseVariant(session.data_license)} className="font-sans text-[10px]">
                    {licenseLabel(session.data_license)}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
