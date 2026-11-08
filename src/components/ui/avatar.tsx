// DESIGN.md §7: initials in a circle, decorative because the name is always shown
// next to it. 28 px in the top bar, 32 px in lists, 36 px on cards.
const SIZE_CLASSES = {
  sm: "inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary",
  md: "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary",
  lg: "inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary",
} as const;

export function Avatar({
  name,
  size,
}: {
  name: string;
  size: keyof typeof SIZE_CLASSES;
}) {
  const words = name.split(/\s+/).filter((word) => /^\p{L}/u.test(word));
  const initials = [words.at(0), words.length > 1 ? words.at(-1) : undefined]
    .map((word) => word?.charAt(0).toUpperCase() ?? "")
    .join("");

  return (
    <span aria-hidden="true" className={SIZE_CLASSES[size]}>
      {initials}
    </span>
  );
}
