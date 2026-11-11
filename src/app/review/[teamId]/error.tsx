"use client";

import { PageError } from "@/components/layout/page-error";

// Next 16.4 retry re-fetches the server content; reset only re-renders it.
export default function ReviewError({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return <PageError retry={retry} />;
}
