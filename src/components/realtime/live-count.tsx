"use client";

import { useEffect, useState } from "react";

const HIGHLIGHT_DURATION_MS = 1000;

// DESIGN.md §8: a count that changes in a live update gets a bg-primary/10
// highlight for 1 s, and none when the user prefers reduced motion.
export function LiveCount({ value }: { value: number }) {
  const [shownValue, setShownValue] = useState(value);
  const [isHighlighted, setIsHighlighted] = useState(false);
  if (value !== shownValue) {
    setShownValue(value);
    setIsHighlighted(true);
  }

  useEffect(() => {
    if (!isHighlighted) {
      return;
    }
    const timer = setTimeout(
      () => setIsHighlighted(false),
      HIGHLIGHT_DURATION_MS
    );
    return () => clearTimeout(timer);
  }, [isHighlighted]);

  return (
    <span
      className={`-mx-1 rounded-sm px-1 motion-safe:transition-colors motion-safe:duration-150 ${isHighlighted ? "motion-safe:bg-primary/10" : ""}`}
    >
      {value}
    </span>
  );
}
