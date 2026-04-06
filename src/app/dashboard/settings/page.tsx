"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { usePolling } from "@/hooks/use-polling";
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

export default function SettingsPage() {
  const { user } = useAuth();
  const [optOutOpen, setOptOutOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [optingOut, setOptingOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exportId, setExportId] = useState<string | null>(null);

  const { data: exportStatus } = usePolling(
    () => api.user.exportStatus(exportId!),
    3000,
    exportId !== null
  );

  async function handleOptOut() {
    setOptingOut(true);
    try {
      if (user?.global_opt_out) {
        await api.user.optIn();
        toast.success("Opted back in. You can be recorded in future sessions.");
      } else {
        await api.user.optOut();
        toast.success("Opted out. You will not be recorded in future sessions.");
      }
      setOptOutOpen(false);
      // Reload to update user state
      window.location.reload();
    } catch {
      toast.error("Failed to update opt-out preference");
    } finally {
      setOptingOut(false);
    }
  }

  async function handleExport() {
    try {
      const result = await api.user.requestExport();
      setExportId(result.id);
      toast.success("Export requested. This may take a moment.");
    } catch {
      toast.error("Failed to request data export");
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.user.deleteAccount();
      toast.success("Account deletion requested.");
      window.location.href = "/";
    } catch {
      toast.error("Failed to delete account");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-serif text-xl font-semibold text-ink">Settings</h1>

      {/* Global opt-out */}
      <div className="rounded border border-rule bg-card-surface p-4">
        <h2 className="font-serif text-base font-semibold text-ink">
          Recording Opt-Out
        </h2>
        <p className="mt-1 font-sans text-xs text-ink-faint">
          {user?.global_opt_out
            ? "You are currently opted out. The bot will not record you in future sessions."
            : "When enabled, the bot will skip recording you in future sessions."}
        </p>
        <Dialog open={optOutOpen} onOpenChange={setOptOutOpen}>
          <DialogTrigger
            render={
              <Button
                variant={user?.global_opt_out ? "outline" : "default"}
                size="sm"
                className="mt-3 font-sans"
              />
            }
          >
            {user?.global_opt_out ? "Opt back in" : "Opt out of recording"}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {user?.global_opt_out ? "Opt Back In" : "Opt Out of Recording"}
              </DialogTitle>
              <DialogDescription>
                {user?.global_opt_out
                  ? "You will be included in future recording sessions again."
                  : "The bot will not record your audio in any future sessions. Existing recordings are not affected."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                className="font-sans"
                onClick={() => setOptOutOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                className="font-sans"
                disabled={optingOut}
                onClick={handleOptOut}
              >
                {optingOut ? "Saving..." : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Data export */}
      <div className="rounded border border-rule bg-card-surface p-4">
        <h2 className="font-serif text-base font-semibold text-ink">
          Data Export
        </h2>
        <p className="mt-1 font-sans text-xs text-ink-faint">
          Download a copy of all your data including sessions, transcripts, and
          audio.
        </p>
        {exportId && exportStatus ? (
          <div className="mt-3 font-sans text-sm">
            {exportStatus.status === "ready" && exportStatus.download_url ? (
              <a
                href={exportStatus.download_url}
                className="text-accent-brown hover:underline"
                download
              >
                Download ready — click to download
              </a>
            ) : (
              <p className="text-ink-faint">
                Export in progress ({exportStatus.status})...
              </p>
            )}
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="mt-3 font-sans"
            onClick={handleExport}
          >
            Download My Data
          </Button>
        )}
      </div>

      {/* Account */}
      <div className="rounded border border-rule bg-card-surface p-4">
        <h2 className="font-serif text-base font-semibold text-ink">Account</h2>
        <div className="mt-2 font-sans text-sm text-ink-light">
          <p>
            Discord ID:{" "}
            <span className="text-ink">{user?.pseudo_id ?? "—"}</span>
          </p>
        </div>
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogTrigger
            render={
              <Button
                variant="destructive"
                size="sm"
                className="mt-3 font-sans"
              />
            }
          >
            Delete My Account
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Account</DialogTitle>
              <DialogDescription>
                This will permanently delete your account and all associated
                data. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                className="font-sans"
                onClick={() => setDeleteOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="font-sans"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? "Deleting..." : "Delete Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
