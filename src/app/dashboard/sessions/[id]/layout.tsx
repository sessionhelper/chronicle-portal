import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";

export default function SessionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1 font-sans text-sm text-ink-faint hover:text-ink-light transition-colors duration-100"
      >
        <ChevronLeftIcon className="size-3.5" />
        Back to sessions
      </Link>
      {children}
    </div>
  );
}
