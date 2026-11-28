# Items list usability and impact analysis — design

Date: 2026-11-28. Approved in conversation.

## Intent

The items list is the most used page. Filters are lost on reload, the list cannot be sorted,
and the data automation already reports (`source`, `lastSeenAt`) is invisible. Separately,
operators want to know "what breaks if this item fails" without tracing the graph by hand.

Two independent PRs: **A — items list**, then **B — impact analysis**.

## Goals

A — items list
1. Filters, sort, page and page size live in the URL (`/items?status=ACTIVE&tagId=…&sort=name&order=asc&page=2&limit=25`). Reload, back button and shared links restore the view.
2. Server-side sorting by clicking column headers: name, IP, status, type, last seen, updated. Default: created, newest first (as today).
3. Filter by tag; page size selectable 10 / 25 / 50 / 100.
4. New columns "Source" and "Last seen" (relative, exact timestamp on hover); both also in the item page details.

B — impact analysis
- `GET /api/configuration-items/:id/impact` returns the items affected if this item fails, grouped by depth, each with the path from the failed item.
- Panel "Impact if this fails" on the item page.
- "Y is affected when X fails" when: Y DEPENDS_ON X, Y RUNS_ON X, or X CONTAINS Y. CONNECTED_TO, MANAGES and PART_OF are not followed.

## Non-goals

Saved views, stale-item detection, recurring maintenance, graph highlighting (later).
No schema migration. Existing API callers keep working (new query params are optional;
unknown sort values fall back to the default).

## Constraints

- `limit` stays capped at 1000; the UI offers 10/25/50/100 only. Invalid URL values fall back to defaults instead of erroring.
- Sorting by "last seen" puts never-seen items last in both directions.
- Impact traversal: breadth-first, each item visited once (cycles terminate), max depth 10, result capped at 500 items with a `truncated: true` flag. Read scope required. 404 for unknown id.

## Approaches (B)

1. **Server endpoint + panel (chosen):** BFS in app code over `AssetRelation`, one query per depth level. Testable with mocked prisma, reusable from scripts.
2. Recursive SQL CTE: faster on huge graphs, harder to test; not needed at this size.
3. Graph-page highlighting only: no list, no API; can be layered on (1) later.

For A there is one sensible way: URL as the source of truth for list state, API gains optional `sort`, `order`, `tagId`.

## Left to the builder

Exact column widths, relative-time wording, how the path is rendered in the panel, empty-state copy (sentence case).
