"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";

interface HealthStatus {
  ok: boolean;
  error?: string;
}

export default function SettingsPage() {
  const apiUrl = process.env.NEXT_PUBLIC_DATA_API_URL || "http://localhost:8001";
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [checking, setChecking] = useState(false);

  async function checkConnection() {
    setChecking(true);
    try {
      const res = await fetch("/api/health");
      const data: HealthStatus = await res.json();
      setHealth(data);
    } catch {
      setHealth({ ok: false, error: "Failed to reach health endpoint" });
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    checkConnection();
  }, []);

  return (
    <AppShell>
      <h1 className="font-serif text-xl font-semibold text-ink">Settings</h1>

      {/* Data API configuration */}
      <div className="mt-4 rounded border border-rule bg-card-surface p-4">
        <h2 className="font-serif text-base font-semibold text-ink">
          Data API Connection
        </h2>

        <div className="mt-3 space-y-3">
          {/* API URL */}
          <div>
            <label className="font-sans text-xs text-ink-faint">
              API URL (DATA_API_URL)
            </label>
            <p className="mt-0.5 rounded border border-rule bg-parchment px-3 py-1.5 font-mono text-sm text-ink">
              {apiUrl}
            </p>
            <p className="mt-1 font-sans text-[11px] text-ink-faint">
              Set via DATA_API_URL environment variable. Default:
              http://localhost:8001
            </p>
          </div>

          {/* Shared secret */}
          <div>
            <label className="font-sans text-xs text-ink-faint">
              Shared Secret (DATA_API_SHARED_SECRET)
            </label>
            <p className="mt-0.5 rounded border border-rule bg-parchment px-3 py-1.5 font-mono text-sm text-ink-faint">
              ••••••••••••••••
            </p>
            <p className="mt-1 font-sans text-[11px] text-ink-faint">
              Set via DATA_API_SHARED_SECRET environment variable (server-side
              only).
            </p>
          </div>

          {/* Connection status */}
          <div>
            <label className="font-sans text-xs text-ink-faint">
              Connection status
            </label>
            <div className="mt-1 flex items-center gap-2">
              {health === null || checking ? (
                <span className="font-sans text-sm text-ink-faint">
                  Checking...
                </span>
              ) : health.ok ? (
                <>
                  <span className="inline-block size-2 rounded-full bg-success" />
                  <span className="font-sans text-sm text-success">
                    Connected
                  </span>
                </>
              ) : (
                <>
                  <span className="inline-block size-2 rounded-full bg-danger" />
                  <span className="font-sans text-sm text-danger">
                    Disconnected
                  </span>
                  {health.error && (
                    <span className="font-sans text-xs text-ink-faint">
                      ({health.error})
                    </span>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={checkConnection}
                disabled={checking}
                className="ml-2 font-sans text-xs text-accent-brown hover:underline disabled:opacity-50"
              >
                Recheck
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Environment info */}
      <div className="mt-4 rounded border border-rule bg-card-surface p-4">
        <h2 className="font-serif text-base font-semibold text-ink">
          Environment
        </h2>
        <div className="mt-3 space-y-2 font-sans text-sm">
          <div className="flex justify-between">
            <span className="text-ink-faint">Node environment</span>
            <span className="text-ink">
              {process.env.NODE_ENV || "development"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-faint">Proxy routes</span>
            <span className="text-ink">/api/sessions, /api/health</span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
