"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api-client";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const savedState = sessionStorage.getItem("oauth_state");

    if (!code) {
      setError("No authorization code received from Discord.");
      return;
    }

    if (!state || state !== savedState) {
      setError("Invalid OAuth state. Please try signing in again.");
      return;
    }

    sessionStorage.removeItem("oauth_state");

    api.auth
      .discordCallback(code, state)
      .then(() => {
        router.push("/dashboard");
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Authentication failed.");
      });
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="flex min-h-full items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <p className="font-serif text-base text-ink">{error}</p>
          <a
            href="/auth/discord"
            className="mt-3 inline-block font-sans text-sm text-accent-brown hover:text-accent-light transition-colors duration-150"
          >
            Try again
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center">
      <p className="font-sans text-sm text-ink-faint">
        Completing sign in...
      </p>
    </div>
  );
}

export default function DiscordCallback() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full items-center justify-center">
          <p className="font-sans text-sm text-ink-faint">Loading...</p>
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
