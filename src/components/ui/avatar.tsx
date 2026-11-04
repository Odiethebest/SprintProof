// DESIGN.md §7: initials in a circle, decorative because the name is always shown
// next to it. Top-bar size (28 px); card and list sizes come with #12.
export function Avatar({ name }: { name: string }) {
  const words = name.split(/\s+/).filter((word) => /^\p{L}/u.test(word));
  const initials = [words.at(0), words.length > 1 ? words.at(-1) : undefined]
    .map((word) => word?.charAt(0).toUpperCase() ?? "")
    .join("");

  return (
    <span
      aria-hidden="true"
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
    >
      {initials}
    </span>
  );
}
