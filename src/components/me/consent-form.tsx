"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function ConsentForm({
  sessionId,
  current,
}: {
  sessionId: string;
  current: "full" | "decline" | "timed_out" | null;
}) {
  const [scope, setScope] = useState(current === "full" ? "full" : "decline");
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
    });
  };

  return (
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
  );
}
