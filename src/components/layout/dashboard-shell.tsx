import { Nav } from "./nav";
import { Footer } from "./footer";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pt-16 pb-8">
        {children}
      </main>
      <Footer />
    </div>
  );
}
