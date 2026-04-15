/**
 * Vitest setup — stubs for Next-specific modules that aren't resolvable
 * outside the Next.js build. We never exercise the OAuth flow in unit
 * tests; only the BFF handlers, schemas, and filters.
 */

import { vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => null),
  handlers: { GET: async () => new Response(), POST: async () => new Response() },
  signIn: vi.fn(),
  signOut: vi.fn(),
  authConfig: {},
}));

vi.mock("next-auth", () => ({
  default: () => ({
    auth: vi.fn(async () => null),
    handlers: {},
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("next-auth/providers/discord", () => ({
  default: () => ({}),
}));
