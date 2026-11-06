// Suspense fallback while a page waits for the session and its data.
export function PageLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6">
      <p className="text-sm text-text-muted">Loading…</p>
    </main>
  );
}
