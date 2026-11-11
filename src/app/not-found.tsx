import type { Metadata } from "next";
import Link from "next/link";
import { AppMark } from "@/components/ui/app-mark";
import { BUTTON_CLASSES } from "@/components/ui/button-styles";

const TITLE = "Page not found · SprintProof";

export const metadata: Metadata = { title: TITLE };

// #100: unknown paths, and team pages that call notFound() for a team that
// doesn't exist or that the user isn't on. One sentence covers both, so an
// outsider can't tell whether a team exists.
export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      {/* The team layout calls notFound() after the page's shell, with its
          own <title>, has gone out. React puts this one first in <head>, so
          the tab and screen readers name the 404 page there too. */}
      <title>{TITLE}</title>
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-lg border border-border bg-surface p-4 text-center md:p-6">
        <AppMark size="lg" />
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Page not found
          </h1>
          <p className="text-sm text-text-muted">
            This page doesn&apos;t exist, or you don&apos;t have access to it.
          </p>
        </div>
        <Link href="/" className={BUTTON_CLASSES.primary}>
          Your teams
        </Link>
      </div>
    </main>
  );
}
