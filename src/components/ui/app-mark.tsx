import { Check } from "lucide-react";

const BOX_CLASSES = {
  sm: "inline-flex size-8 items-center justify-center rounded-md bg-primary text-primary-fg",
  lg: "inline-flex size-12 items-center justify-center rounded-lg bg-primary text-primary-fg",
} as const;

const ICON_SIZES = { sm: 16, lg: 24 } as const;

// Decorative: the app name is always shown next to or near it.
export function AppMark({ size }: { size: keyof typeof BOX_CLASSES }) {
  return (
    <span aria-hidden="true" className={BOX_CLASSES[size]}>
      <Check size={ICON_SIZES[size]} strokeWidth={2.5} />
    </span>
  );
}
