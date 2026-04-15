import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="max-w-xl space-y-6">
        <h1 className="text-4xl font-semibold tracking-tight">Chronicle</h1>
        <p className="text-lg text-muted-foreground">
          A shared archive of your tabletop sessions — transcripts, audio, and
          the story you and your table built together.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/login">
            <Button size="lg">Sign in</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
