// DESIGN.md §7 Button variants, for <button> and <Link> alike. One primary per view.
export const BUTTON_CLASSES = {
  primary:
    "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-fg transition-colors duration-150 ease-out hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-60",
  secondary:
    "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium transition-colors duration-150 ease-out hover:bg-text/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-60",
  destructive:
    "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium text-missed transition-colors duration-150 ease-out hover:bg-missed/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-60",
} as const;
