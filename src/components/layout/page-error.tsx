"use client";

import Link from "next/link";
import { BUTTON_CLASSES } from "@/components/ui/button-styles";

export function PageError({ retry }: { retry: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-8 md:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Couldn&apos;t load this page
      </h1>
      <p className="text-sm text-text-muted">Please try again.</p>
      <div className="flex gap-4">
        <button
          type="button"
          onClick={retry}
          className={BUTTON_CLASSES.primary}
        >
          Try again
        </button>
        <Link href="/" className={BUTTON_CLASSES.secondary}>
          Your teams
        </Link>
      </div>
    </main>
  );
}
