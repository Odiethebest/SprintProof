import { z } from "zod";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

const LIMIT_MESSAGE = `Set limit to a whole number from 1 to ${MAX_PAGE_SIZE}.`;
const CURSOR_MESSAGE = "Set cursor to the nextCursor from the previous page.";

// ?limit= and ?cursor= on every list endpoint. Query values arrive as strings.
export const paginationQuerySchema = z.object({
  limit: z.coerce
    .number({ error: LIMIT_MESSAGE })
    .int(LIMIT_MESSAGE)
    .min(1, LIMIT_MESSAGE)
    .max(MAX_PAGE_SIZE, LIMIT_MESSAGE)
    .default(DEFAULT_PAGE_SIZE),
  cursor: z.string({ error: CURSOR_MESSAGE }).min(1, CURSOR_MESSAGE).optional(),
});

export type PaginationQuery = z.output<typeof paginationQuerySchema>;

export interface Page<T> {
  data: T[];
  nextCursor: string | null;
}

// Repositories fetch one row more than the limit; that extra row only says
// another page follows. The cursor is the id of the last row returned.
export function toPage<T extends { id: string }>({
  rows,
  limit,
}: {
  rows: T[];
  limit: number;
}): Page<T> {
  const data = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  return { data, nextCursor: hasMore ? (data.at(-1)?.id ?? null) : null };
}
