/**
 * Environment variable access, centralized. Each accessor throws if a
 * required var is missing. Keep this file small — the goal is that
 * `process.env` appears nowhere else in the codebase.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing required env var: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const env = {
  get DATA_API_URL() {
    return required("DATA_API_URL");
  },
  get SHARED_SECRET() {
    return required("SHARED_SECRET");
  },
  get WORKER_ADMIN_URL() {
    return optional("WORKER_ADMIN_URL", "http://worker:8020");
  },
  get NEXTAUTH_URL() {
    return required("NEXTAUTH_URL");
  },
  get NEXTAUTH_SECRET() {
    return required("NEXTAUTH_SECRET");
  },
  get DISCORD_CLIENT_ID() {
    return required("DISCORD_CLIENT_ID");
  },
  get DISCORD_CLIENT_SECRET() {
    return required("DISCORD_CLIENT_SECRET");
  },
  get NODE_ENV() {
    return optional("NODE_ENV", "production");
  },
};

/**
 * Derive a stable pseudo_id from a Discord user_id. Mirrors the
 * chronicle-data-api rule: `hex(sha256(discord_user_id_utf8))[0:24]`.
 *
 * Using Web Crypto so this works in Edge + Node runtimes.
 */
export async function deriveDiscordPseudoId(
  discordUserId: string,
): Promise<string> {
  const buf = new TextEncoder().encode(discordUserId);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex.slice(0, 24);
}
