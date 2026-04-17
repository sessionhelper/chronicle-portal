"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function ConsentForm({
  sessionId,
  current,
  onScopeChange,
}: {
  sessionId: string;
  current: "full" | "decline" | "timed_out" | null;
  onScopeChange?: (scope: "full" | "decline") => void;
}) {
  const [scope, setScope] = useState<"full" | "decline">(
    current === "full" ? "full" : "decline",
  );
  const [pending, start] = useTransition();

  const save = () => {
    start(async () => {
      const res = await fetch(`/api/me/sessions/${sessionId}/consent`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent_scope: scope }),
      });
      if (!res.ok) {
        toast.error("Couldn't update consent");
        return;
      }
      toast.success("Consent updated");
      onScopeChange?.(scope);
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <select
          className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={scope}
          onChange={(e) => setScope(e.target.value as "full" | "decline")}
        >
          <option value="full">Full — keep my voice</option>
          <option value="decline">Decline — remove my voice</option>
        </select>
        <Button onClick={save} disabled={pending} size="sm">
          Save
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        <strong>Full:</strong> your audio and attributed transcript
        segments are retained for this session. You can still restrict
        how they&apos;re used via the license flags below.{" "}
        <strong>Decline:</strong> your audio will be deleted and your
        transcript segments will be removed from the session. This is
        reversible — you can re-consent later and your data will be
        restored if it hasn&apos;t been permanently purged yet.
      </p>
    </div>
  );
}
