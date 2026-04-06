"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { AuditEntry } from "@/lib/types";

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api.user.audit();
        if (!cancelled) {
          // Sort chronologically descending
          data.sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          setEntries(data);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Failed to load audit log"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <p className="font-sans text-sm text-ink-faint">Loading audit log...</p>
    );
  }

  if (error) {
    return (
      <div className="rounded border border-danger/20 bg-danger/5 px-4 py-3">
        <p className="font-sans text-sm text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-serif text-xl font-semibold text-ink">Audit Log</h1>
      {entries.length === 0 ? (
        <p className="mt-3 font-sans text-sm text-ink-light">
          No audit entries yet.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-rule font-sans text-xs text-ink-faint">
                <th className="pb-2 pr-4 font-medium">Timestamp</th>
                <th className="pb-2 pr-4 font-medium">Action</th>
                <th className="pb-2 pr-4 font-medium">Session</th>
                <th className="pb-2 font-medium">Scope Change</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-rule/50 transition-colors duration-100 hover:bg-parchment-dark"
                >
                  <td className="py-2.5 pr-4 font-sans text-sm text-ink-light">
                    {formatDate(entry.timestamp)}
                  </td>
                  <td className="py-2.5 pr-4 font-sans text-sm text-ink">
                    {entry.action}
                  </td>
                  <td className="py-2.5 pr-4">
                    {entry.session_id ? (
                      <Link
                        href={`/dashboard/sessions/${entry.session_id}`}
                        className="font-sans text-sm text-accent-brown hover:underline"
                      >
                        View session
                      </Link>
                    ) : (
                      <span className="font-sans text-sm text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="py-2.5 font-sans text-sm text-ink-light">
                    {entry.previous_scope || entry.new_scope ? (
                      <>
                        {entry.previous_scope ?? "—"} → {entry.new_scope ?? "—"}
                      </>
                    ) : (
                      "—"
                    )}
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
