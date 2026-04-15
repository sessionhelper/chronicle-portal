"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function LicenseSwitches({
  sessionId,
  noLlmTraining,
  noPublicRelease,
}: {
  sessionId: string;
  noLlmTraining: boolean;
  noPublicRelease: boolean;
}) {
  const [llm, setLlm] = useState(noLlmTraining);
  const [pub, setPub] = useState(noPublicRelease);
  const [, start] = useTransition();

  const patch = (body: Record<string, boolean>) => {
    start(async () => {
      const res = await fetch(`/api/me/sessions/${sessionId}/license`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) toast.error("Couldn't update license flags");
      else toast.success("License updated");
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={`llm-${sessionId}`}>No LLM training</Label>
        <Switch
          id={`llm-${sessionId}`}
          checked={llm}
          onCheckedChange={(v) => {
            setLlm(v);
            patch({ no_llm_training: v });
          }}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={`pub-${sessionId}`}>No public release</Label>
        <Switch
          id={`pub-${sessionId}`}
          checked={pub}
          onCheckedChange={(v) => {
            setPub(v);
            patch({ no_public_release: v });
          }}
        />
      </div>
    </div>
  );
}
