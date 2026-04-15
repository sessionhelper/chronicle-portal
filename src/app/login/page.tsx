import { redirect } from "next/navigation";

import { SignInButton } from "@/components/sign-in-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";

type Props = { searchParams: Promise<{ callbackUrl?: string; error?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const session = await auth();
  const { callbackUrl, error } = await searchParams;
  if (session?.user?.pseudo_id) {
    redirect(callbackUrl ?? "/dashboard");
  }
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in to Chronicle</CardTitle>
          <CardDescription>
            We use your Discord identity to link you to the sessions you were in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-destructive">
              Sign-in failed: {error}. Try again.
            </p>
          )}
          <SignInButton callbackUrl={callbackUrl} />
        </CardContent>
      </Card>
    </div>
  );
}
