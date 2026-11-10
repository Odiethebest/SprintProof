"use client";

import "./globals.css";
import { PageError } from "@/components/layout/page-error";

export default function GlobalError({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas text-text">
        <title>Page unavailable · SprintProof</title>
        <PageError retry={retry} />
      </body>
    </html>
  );
}
