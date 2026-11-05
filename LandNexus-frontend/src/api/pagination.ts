import type { PageResponse } from './types'

/** The backend caps a page at 100 records. */
export const MAX_PAGE_SIZE = 100

/**
 * Reads every page of a list endpoint. Use it only for small reference lists
 * (districts, departments, talukas, villages) where the whole list is needed
 * for a drop-down. Paged screens use a single page instead.
 */
export async function readAllPages<T>(
  readPage: (page: number) => Promise<PageResponse<T>>,
): Promise<T[]> {
  const first = await readPage(0)
  const items = [...first.content]

  for (let page = 1; page < first.totalPages; page += 1) {
    items.push(...(await readPage(page)).content)
  }

  return items
}
