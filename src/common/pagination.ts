export type CursorPage<T> = {
  items: T[];
  // Pass it as ?cursor= to get the next page; null means this was the last one
  nextCursor: string | null;
};

/**
 * Repositories fetch limit + 1 rows: if the extra row exists, there is a
 * next page. This drops it and points nextCursor at the last row we return.
 */
export function toCursorPage<T extends { id: string }>(
  rows: T[],
  limit: number,
): CursorPage<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  };
}
