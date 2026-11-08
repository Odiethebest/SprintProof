// How long a toast stays up (DESIGN.md §7 Toast).
export const TOAST_DURATION_MS = 4500;

// DESIGN.md §7 Toast: the page's single polite live region, bottom center.
export function Toast({ message }: { message: string | null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center px-4"
    >
      {message !== null && (
        <p className="rounded-md bg-text px-4 py-3 text-sm text-canvas">
          {message}
        </p>
      )}
    </div>
  );
}
