// Zod 4 measures strings in Unicode code points; standup fields trim first.
export function countStandupCharacters({ value }: { value: string }): number {
  return [...value.trim()].length;
}
