"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function LicenseSwitches({
  sessionId,
  noLlmTraining,
  noPublicRelease,
  disabled,
}: {
  sessionId: string;
  noLlmTraining: boolean;
  noPublicRelease: boolean;
  disabled?: boolean;
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
        <div>
          <Label htmlFor={`llm-${sessionId}`}>No LLM training</Label>
          <p className="text-xs text-muted-foreground">
            Exclude your voice data from any language model training
            datasets.
          </p>
        </div>
        <Switch
          id={`llm-${sessionId}`}
          checked={llm}
          disabled={disabled}
          onCheckedChange={(v) => {
            setLlm(v);
            patch({ no_llm_training: v });
          }}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label htmlFor={`pub-${sessionId}`}>No public release</Label>
          <p className="text-xs text-muted-foreground">
            Keep your voice data out of any publicly released datasets.
          </p>
        </div>
        <Switch
          id={`pub-${sessionId}`}
          checked={pub}
          disabled={disabled}
          onCheckedChange={(v) => {
            setPub(v);
            patch({ no_public_release: v });
          }}
        />
      </div>
      {disabled && (
        <p className="text-xs text-muted-foreground italic">
          License flags are disabled because you&apos;ve declined
          consent. Re-consent first to change these.
        </p>
      )}
    </div>
  );
}
