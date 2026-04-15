/**
 * Auth.js (next-auth@5) setup. Discord OAuth provider, JWT session
 * strategy, 7-day TTL. On first sign-in we upsert the pseudo_id into
 * data-api and record the display name.
 *
 * The JWT holds only `pseudo_id` and `display_name`. `is_admin` is
 * re-read on every request from data-api (spec §Behavior: "Admin
 * privileges are runtime-evaluated"). We cache the lookup briefly
 * per-request via `resolveUser()` in `./server-auth.ts`.
 */

import NextAuth, { type NextAuthConfig } from "next-auth";
import Discord from "next-auth/providers/discord";

import { dataApiClient } from "@/lib/data-api-client";
import { deriveDiscordPseudoId } from "@/lib/env";
import { metrics } from "@/lib/metrics";

export const authConfig: NextAuthConfig = {
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    /** Upsert user + display name on every successful sign-in. */
    async signIn({ user, account }) {
      if (account?.provider !== "discord") return false;
      const discordId = account.providerAccountId;
      if (!discordId) return false;
      try {
        const pseudoId = await deriveDiscordPseudoId(discordId);
        await dataApiClient.upsertUser(pseudoId);
        if (user.name) {
          await dataApiClient.recordDisplayName(pseudoId, user.name);
        }
        metrics.portal_oauth_attempts_total.labels("success").inc();
        return true;
      } catch (err) {
        metrics.portal_oauth_attempts_total.labels("error").inc();
        console.error("signIn upsert failed", err);
        return false;
      }
    },

    /** Stamp pseudo_id + display_name into the JWT on first issue. */
    async jwt({ token, account, user }) {
      if (account?.provider === "discord" && account.providerAccountId) {
        token.pseudo_id = await deriveDiscordPseudoId(
          account.providerAccountId,
        );
        token.display_name = user?.name || token.display_name || null;
      }
      return token;
    },

    /** Expose pseudo_id + display_name on the client session. */
    async session({ session, token }) {
      if (token.pseudo_id && typeof token.pseudo_id === "string") {
        session.user = {
          ...session.user,
          pseudo_id: token.pseudo_id,
          display_name:
            (token.display_name as string | null | undefined) ??
            session.user?.name ??
            null,
        };
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
