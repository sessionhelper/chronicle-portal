"use client";

import { useEffect } from "react";

export default function DiscordAuthRedirect() {
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
    const redirectUri = process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return;
    }

    const state = crypto.randomUUID();
    sessionStorage.setItem("oauth_state", state);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "identify",
      state,
    });

    window.location.href = `https://discord.com/oauth2/authorize?${params}`;
  }, []);

  return (
    <div className="flex min-h-full items-center justify-center">
      <p className="font-sans text-sm text-ink-faint">
        Redirecting to Discord...
      </p>
    </div>
  );
}
