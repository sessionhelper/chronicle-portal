import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth";

export function SignInButton({ callbackUrl }: { callbackUrl?: string }) {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("discord", { redirectTo: callbackUrl ?? "/dashboard" });
      }}
    >
      <Button type="submit">Sign in with Discord</Button>
    </form>
  );
}
