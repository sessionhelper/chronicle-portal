"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { formatDate, formatDuration } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { SessionDetail } from "@/lib/types";

function durationSeconds(session: SessionDetail): number {
  if (!session.ended_at) return 0;
  return (
    (new Date(session.ended_at).getTime() -
      new Date(session.started_at).getTime()) /
    1000
  );
}

function licenseLabel(license: string) {
  switch (license) {
    case "open":
      return "Full Open";
    case "rail":
      return "Research Only";
    case "private":
      return "Private";
    default:
      return license;
  }
}

function licenseDescription(license: string) {
  switch (license) {
    case "open":
      return "Public dataset + LLM training";
    case "rail":
      return "Public dataset, no LLM training";
    case "private":
      return "Internal use only, no publication";
    default:
      return "";
  }
}

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api.sessions.get(id);
        if (!cancelled) setSession(data);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load session");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleLicenseChange(license: "open" | "rail" | "private") {
    if (!session) return;
    try {
      await api.sessions.updateLicense(id, license);
      setSession({ ...session, data_license: license });
      toast.success(`License updated to ${licenseLabel(license)}`);
    } catch {
      toast.error("Failed to update license");
    }
  }

  async function handleWithdraw() {
    setWithdrawing(true);
    try {
      await api.sessions.withdraw(id);
      setSession((prev) =>
        prev
          ? {
              ...prev,
              withdrawn_at: new Date().toISOString(),
              consent_scope: "withdrawn",
            }
          : prev
      );
      setWithdrawOpen(false);
      toast.success("Consent withdrawn. Your audio will be deleted.");
    } catch {
      toast.error("Failed to withdraw consent");
    } finally {
      setWithdrawing(false);
    }
  }

  if (loading) {
    return (
      <p className="font-sans text-sm text-ink-faint">Loading session...</p>
    );
  }

  if (error || !session) {
    return (
      <div className="rounded border border-danger/20 bg-danger/5 px-4 py-3">
        <p className="font-sans text-sm text-danger">
          {error ?? "Session not found"}
        </p>
      </div>
    );
  }

  const isWithdrawn = !!session.withdrawn_at;

  return (
    <div className="flex flex-col gap-4">
      {/* Metadata card */}
      <div className="rounded border border-rule bg-card-surface p-4">
        <h1 className="font-serif text-lg font-semibold text-ink">
          Session {formatDate(session.started_at)}
        </h1>
        <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 font-sans text-sm sm:grid-cols-3">
          <div>
            <span className="text-ink-faint">Date</span>
            <p className="text-ink">{formatDate(session.started_at)}</p>
          </div>
          <div>
            <span className="text-ink-faint">Duration</span>
            <p className="text-ink">
              {session.ended_at
                ? formatDuration(durationSeconds(session))
                : "In progress"}
            </p>
          </div>
          <div>
            <span className="text-ink-faint">System</span>
            <p className="text-ink">{session.game_system ?? "—"}</p>
          </div>
          <div>
            <span className="text-ink-faint">Campaign</span>
            <p className="text-ink">{session.campaign_name ?? "—"}</p>
          </div>
          <div>
            <span className="text-ink-faint">Participants</span>
            <p className="text-ink">{session.participant_count}</p>
          </div>
          <div>
            <span className="text-ink-faint">Status</span>
            <p>
              <Badge variant="secondary" className="font-sans text-[10px]">
                {session.status}
              </Badge>
            </p>
          </div>
        </div>
      </div>

      {/* Data license card */}
      {!isWithdrawn && (
        <div className="rounded border border-rule bg-card-surface p-4">
          <h2 className="font-serif text-base font-semibold text-ink">
            Data License
          </h2>
          <p className="mt-1 font-sans text-xs text-ink-faint">
            Controls how your audio and transcript data is used after recording.
          </p>
          <RadioGroup
            className="mt-3"
            value={session.data_license}
            onValueChange={(val) =>
              handleLicenseChange(val as "open" | "rail" | "private")
            }
          >
            {(["open", "rail", "private"] as const).map((tier) => (
              <label
                key={tier}
                className="flex cursor-pointer items-start gap-3 rounded px-2 py-1.5 hover:bg-parchment-dark transition-colors duration-100"
              >
                <RadioGroupItem value={tier} className="mt-0.5" />
                <div>
                  <span className="font-sans text-sm font-medium text-ink">
                    {licenseLabel(tier)}
                  </span>
                  <p className="font-sans text-xs text-ink-faint">
                    {licenseDescription(tier)}
                  </p>
                </div>
              </label>
            ))}
          </RadioGroup>
        </div>
      )}

      {/* Consent card */}
      <div className="rounded border border-rule bg-card-surface p-4">
        <h2 className="font-serif text-base font-semibold text-ink">Consent</h2>
        <div className="mt-2 font-sans text-sm">
          {isWithdrawn ? (
            <div>
              <p className="text-danger">
                Consent withdrawn on{" "}
                {formatDate(session.withdrawn_at!)}
              </p>
              <p className="mt-1 text-xs text-ink-faint">
                Your audio has been deleted from this session.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-ink-light">
                Scope: {session.consent_scope ?? "—"}
              </p>
              {session.consented_at && (
                <p className="mt-0.5 text-xs text-ink-faint">
                  Consented on {formatDate(session.consented_at)}
                </p>
              )}
              <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
                <DialogTrigger
                  render={
                    <Button
                      variant="destructive"
                      size="sm"
                      className="mt-3 font-sans"
                    />
                  }
                >
                  Withdraw Consent
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Withdraw Consent</DialogTitle>
                    <DialogDescription>
                      This will permanently delete your audio from this session.
                      This cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      size="sm"
                      className="font-sans"
                      onClick={() => setWithdrawOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="font-sans"
                      disabled={withdrawing}
                      onClick={handleWithdraw}
                    >
                      {withdrawing ? "Withdrawing..." : "Withdraw"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </div>

      {/* Transcript link */}
      {session.has_transcript &&
        (session.status === "ready" || session.status === "published") && (
          <div className="rounded border border-rule bg-card-surface p-4">
            <Link
              href={`/dashboard/sessions/${id}/transcript`}
              className="font-sans text-sm text-accent-brown hover:underline"
            >
              Review transcript
            </Link>
          </div>
        )}
    </div>
  );
}
