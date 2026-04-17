"use client";

import Link from "next/link";
import { useState } from "react";

import { ConsentForm } from "@/components/me/consent-form";
import { DeleteMyAudioButton } from "@/components/me/delete-my-audio";
import { LicenseSwitches } from "@/components/me/license-switches";
import { LocalDate } from "@/components/local-date";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Props {
  sessionId: string;
  sessionLabel: string;
  startedAt: string;
  consentScope: "full" | "decline" | "timed_out" | null;
  noLlmTraining: boolean;
  noPublicRelease: boolean;
  displayName: string;
}

export function SessionConsentCard({
  sessionId,
  sessionLabel,
  startedAt,
  consentScope,
  noLlmTraining,
  noPublicRelease,
  displayName,
}: Props) {
  const [scope, setScope] = useState<"full" | "decline">(
    consentScope === "full" ? "full" : "decline",
  );
  const declined = scope === "decline";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline justify-between gap-3">
          <CardTitle>{sessionLabel}</CardTitle>
          <Link
            href={`/sessions/${sessionId}`}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            View session →
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          <LocalDate iso={startedAt} />
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <section>
          <h3 className="mb-2 text-sm font-medium">Consent</h3>
          <ConsentForm
            sessionId={sessionId}
            current={consentScope}
            onScopeChange={setScope}
          />
        </section>
        <section>
          <h3 className="mb-2 text-sm font-medium">License</h3>
          <LicenseSwitches
            sessionId={sessionId}
            noLlmTraining={noLlmTraining}
            noPublicRelease={noPublicRelease}
            disabled={declined}
          />
        </section>
        <section className="flex justify-end pt-2">
          <DeleteMyAudioButton
            sessionId={sessionId}
            displayName={displayName}
          />
        </section>
      </CardContent>
    </Card>
  );
}
