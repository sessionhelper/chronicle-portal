import { redirect } from "next/navigation";

import { signOut } from "@/lib/auth";

/**
 * `/logout` — sign-out entry point. Signs the user out server-side and
 * bounces them to the landing page. Using `signOut`'s `redirectTo`
 * throws the Next.js redirect internally, so no explicit return is
 * needed in the happy path.
 */
export default async function LogoutPage() {
  await signOut({ redirectTo: "/" });
  // Defensive: should never reach here because signOut redirects.
  redirect("/");
}
