# Items list usability and impact analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Items list keeps its state in the URL, sorts server-side, filters by tag, shows source/last seen; item page shows what is affected if the item fails.

**Architecture:** Part A (branch `feat/items-list-ux`, own PR): optional `sort`/`order`/`tagId` on `GET /api/configuration-items`; a pure URL-state module; the items page reads/writes state via `useSearchParams` + `router.replace`. Part B (branch `feat/impact-analysis` from main after A merges, own PR): BFS in `lib/impact.ts`, route `GET /api/configuration-items/[id]/impact`, panel on the item page.

**Tech Stack:** Next.js 16 (read `node_modules/next/dist/docs/` for `useSearchParams`/Suspense rules before Task A3), React 19, Prisma (PostgreSQL), Vitest, existing `components/ui/*`.

**Spec:** `docs/superpowers/specs/2026-11-28-items-list-and-impact-design.md`

## Global Constraints

- UI copy in sentence case; English UI strings.
- No schema migration. Existing query params and response shape of `GET /api/configuration-items` unchanged; new params optional.
- Invalid URL/query values fall back to defaults, never error.
- Page sizes offered: 10, 25, 50, 100 (API cap stays 1000). Default sort: `created` desc.
- Impact: follow Y DEPENDS_ON X, Y RUNS_ON X, X CONTAINS Y only. Max depth 10, max 500 items, `truncated` flag.
- Postgres for tests: `su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/bhpg -o '-p 5433 -k /tmp' -l /tmp/pg2.log start"` (never the system cluster). Unit tests: `npx vitest run`. Lint: `npm run lint`. Type check: `npx tsc --noEmit`.
- Add CHANGELOG `[Unreleased]` entries for user-visible changes.

## Review Focus

1. Sorting by last seen with many never-seen items: nulls always last, pagination stable (tiebreak by `id`).
2. Typing in search must not push a history entry per keystroke (use `router.replace`), and changing any filter resets page to 1.
3. A URL with a deleted tag/type id or `page=999` shows an empty/last page, not a crash (existing "page no longer exists" fallback must keep working with URL state).
4. Relation cycles (A depends on B, B depends on A) and diamonds: each item listed once at its shortest depth.
5. Impact of an item with no relations: empty state, not an error; unknown id: 404.

---

## Part A — branch `feat/items-list-ux`

### Task A1: API sort, order, tag filter

**Files:**
- Modify: `app/api/configuration-items/route.js` (GET + swagger block)
- Test: `__tests__/configuration-items.test.js`

**Interfaces:**
- Produces: query params `sort` ∈ `name|ip|status|type|lastSeen|updated|created` (default `created`), `order` ∈ `asc|desc` (default `desc` for `created`, otherwise `asc`), `tagId` (string). Item objects already include `source`, `lastSeenAt`, `updatedAt` (full model) — keep it so.

- [ ] **Step 1: Write failing tests** (mocked prisma, as in the file):
  - `sort=name&order=asc` → `findMany` called with `orderBy: [{ name: "asc" }, { id: "asc" }]`
  - `sort=type&order=desc` → `orderBy: [{ itemType: { name: "desc" } }, { id: "asc" }]`
  - `sort=lastSeen&order=desc` → `orderBy: [{ lastSeenAt: { sort: "desc", nulls: "last" } }, { id: "asc" }]`
  - no sort → `orderBy: [{ createdAt: "desc" }, { id: "asc" }]`; `sort=bogus&order=sideways` → same default
  - `tagId=t1` → `where.tags` equals `{ some: { id: "t1" } }`, and `count` gets the same `where`
- [ ] **Step 2: Run** `npx vitest run __tests__/configuration-items.test.js` → new tests FAIL
- [ ] **Step 3: Implement** a sort-key → orderBy map (`updated`→`updatedAt`, `created`→`createdAt`, `lastSeen` with `nulls: "last"`), whitelisted; add `tagId` to `where`; document the three params in the swagger block.
- [ ] **Step 4: Run** the test file and `npx vitest run` → all PASS
- [ ] **Step 5: Commit** `feat(api): sort and tag filter for configuration items`

### Task A2: URL state and relative time helpers

**Files:**
- Create: `lib/ui/itemsQuery.ts`, `lib/ui/relativeTime.ts`
- Test: `__tests__/ui/itemsQuery.test.js`, `__tests__/ui/relativeTime.test.js`

**Interfaces:**
- Produces:
  ```ts
  export type ItemSort = "name" | "ip" | "status" | "type" | "lastSeen" | "updated" | "created";
  export interface ItemsQuery { search: string; typeId: string; status: "ALL" | AssetStatus; tagId: string; sort: ItemSort; order: "asc" | "desc"; page: number; limit: 10 | 25 | 50 | 100; }
  export const PAGE_SIZES: readonly [10, 25, 50, 100];
  export const DEFAULT_ITEMS_QUERY: ItemsQuery; // "", "", "ALL", "", "created", "desc", 1, 10
  export function parseItemsQuery(params: URLSearchParams): ItemsQuery;
  export function serializeItemsQuery(q: ItemsQuery): string; // omits defaults; "" for all-default
  export function toApiParams(q: ItemsQuery): URLSearchParams; // page, limit always; others only if set; status omitted when ALL
  export function defaultOrder(sort: ItemSort): "asc" | "desc"; // desc for created/updated/lastSeen, else asc
  export function formatRelativeTime(date: Date | string, now?: Date): string; // "just now", "5 min ago", "3 h ago", "2 days ago", "4 months ago"... via Intl.RelativeTimeFormat("en", { numeric: "auto" }) is acceptable
  ```
  `AssetStatus` from `app/(root)/items/_components/types.ts` (move type import as needed; no circular import into `lib` from `app` — if needed, redeclare the status union in `lib/ui/itemsQuery.ts` and have `types.ts` re-export it).
- [ ] **Step 1: Failing tests:** round-trip of a full query; `page=0`, `page=abc`, `limit=7`, `sort=x`, `order=y`, `status=FOO` → defaults; `serializeItemsQuery(DEFAULT_ITEMS_QUERY) === ""`; `toApiParams` omits `status` for ALL. Relative time: fixed `now`, 30 s → "now"/"just now" (pick one, assert it), 2 h, 3 days, future date does not throw.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(ui): items list URL state helpers`

### Task A3: Items page wiring, sortable headers, new columns, detail fields

**Files:**
- Modify: `app/(root)/items/page.tsx`, `app/(root)/items/_components/ItemFilters.tsx`, `app/(root)/items/_components/ItemsTable.tsx`, `app/(root)/items/_components/types.ts` (`ConfigItem` gains `source?: string | null; lastSeenAt?: string | null; updatedAt?: string`), `app/(root)/items/[id]/page.tsx` (Details panel: Source, Last seen — "Never" when null), `CHANGELOG.md`
- Possibly: `scripts/e2e/ui-check.mjs` / `ui-pages.json` if headings/labels it asserts change.

**Interfaces:**
- Consumes: A1 params, A2 helpers.
- `ItemFilters` gains `selectedTagId`, `onTagChange`, `availableTags` (Select "All tags"). Page size Select ("Rows per page", options from `PAGE_SIZES`) sits with the pagination controls in `ItemsTable`.
- `ItemsTable` gains `sort: ItemSort`, `order`, `onSort(sort: ItemSort)`. Sortable headers (Name, IP, Type, Status, Last seen, Updated? — at least Name, IP, Type, Status, Last seen) are buttons inside `TH` with `aria-sort` on the `TH` (`ascending|descending|none`) and a lucide arrow icon; clicking the active column toggles order, another column sets `defaultOrder(sort)`.
- New columns "Source" (mono, muted, "—" none) and "Last seen" (`formatRelativeTime`, `title` = locale string; "Never" when null). Update the empty-row `colSpan`.

- [ ] **Step 1:** Replace local search/type/status/page state with `parseItemsQuery(useSearchParams())`; updates go through one `setQuery(patch)` that resets `page` to 1 unless the patch sets `page`, and calls `router.replace(pathname + (qs ? "?" + qs : ""), { scroll: false })`. Search input keeps local state, debounced 300 ms into the URL. Wrap the page body in `<Suspense>` if Next 16 requires it for `useSearchParams` (check docs; `npm run build` must not fail on prerender). Keep the "page no longer exists → last page" fallback, now via `setQuery({ page })`. Clear filters → `router.replace(pathname)`.
- [ ] **Step 2:** Filters, table headers, columns, page-size select, detail fields as above.
- [ ] **Step 3: Verify:** `npx tsc --noEmit`, `npm run lint`, `npx vitest run` all clean; `npm run build` succeeds; start dev/prod on DB `ans`, sign in as admin@example.com / graph-test-pw and check with Playwright: sort by name toggles, reload keeps `?sort=name&order=desc&limit=25`, tag filter narrows, back button restores previous filter, typing "web" creates one history entry. Run `node scripts/e2e/ui-check.mjs` (see its header for env) → passes.
- [ ] **Step 4:** CHANGELOG `[Unreleased]` → Added: sortable items list, tag filter and page size, filters kept in the URL, source and last-seen columns.
- [ ] **Step 5: Commit** `feat(items): URL state, sorting, tag filter, source and last seen`

---

## Part B — branch `feat/impact-analysis` (from main after Part A is merged)

### Task B1: Impact traversal and API

**Files:**
- Create: `lib/impact.ts`, `app/api/configuration-items/[id]/impact/route.ts`
- Test: `__tests__/impact.test.js`

**Interfaces:**
- Produces:
  ```ts
  export const IMPACT_MAX_DEPTH = 10;
  export const IMPACT_MAX_ITEMS = 500;
  export interface ImpactEdge { sourceId: string; targetId: string; type: string; }
  export interface ImpactNode { id: string; depth: number; via: { fromId: string; type: string }; path: string[]; } // path = ids from the failed item to this one, inclusive
  /** Pure BFS. `neighbours(ids)` returns relations touching ids. */
  export function affectedBy(edge: ImpactEdge, failedId: string): string | null; // DEPENDS_ON/RUNS_ON with targetId===failed → sourceId; CONTAINS with sourceId===failed → targetId; else null
  export async function computeImpact(rootId: string, loadEdges: (ids: string[]) => Promise<ImpactEdge[]>): Promise<{ nodes: ImpactNode[]; truncated: boolean }>;
  ```
  Route response: `{ item: { id, name }, affected: Array<{ id, name, ip, status, itemType: { name } | null, depth, relationType, path: { id, name }[] }>, truncated: boolean }` sorted by depth then name. `loadEdges` queries `assetRelation.findMany({ where: { OR: [{ targetId: { in: ids }, type: { in: ["DEPENDS_ON","RUNS_ON"] } }, { sourceId: { in: ids }, type: "CONTAINS" }] } })`. `requireAuth(request, "read")`; 404 `{ error: "Configuration item not found" }`; params is a Promise (await it).
- [ ] **Step 1: Failing tests** for `computeImpact` with an in-memory edge list: chain A←B←C (B depends on A, C runs on B) → B depth 1, C depth 2, C.path `[A,B,C]`; CONTAINS direction (A contains D → D affected; D contains A → not); CONNECTED_TO/MANAGES/PART_OF ignored; cycle A↔B terminates, root never in result; diamond lists shared node once at depth 2; depth > 10 cut off with `truncated: true`; > 500 nodes truncated. Route tests (mocked prisma, pattern of `__tests__/configuration-items-id.test.js`): 401 without auth, 404 unknown id, 200 shape with names in `path`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (one `loadEdges` call per depth level; visited set seeded with root). **Step 4: Run** `npx vitest run` → PASS; `npx tsc --noEmit`, `npm run lint` clean.
- [ ] **Step 5: Commit** `feat(api): impact analysis for configuration items`

### Task B2: Impact panel on the item page

**Files:**
- Create: `components/ImpactPanel.tsx`
- Modify: `app/(root)/items/[id]/page.tsx` (Panel "Impact if this fails" after "Relations"), `CHANGELOG.md`, `docs/api.md` (document the endpoint), `scripts/e2e/ui-seed.mjs` only if the UI check needs a relation to render the panel

**Interfaces:** Consumes B1 route. `ImpactPanel({ itemId }: { itemId: string })` fetches on mount and when `itemId` changes.

- [ ] **Step 1:** Render: loading skeleton; error Callout; empty state "Nothing depends on this item."; otherwise a summary line ("N items affected") and groups "Direct" (depth 1) and "Indirect" (depth ≥ 2), each row: link to the item (mono name), status dot, type badge, relation label via `relationType()`, and for depth ≥ 2 the path as muted "via A → B". `truncated` → Callout "Showing the first 500 affected items."
- [ ] **Step 2: Verify:** tsc, lint, vitest clean; Playwright on dev with seeded relations: panel shows direct/indirect groups; both themes readable; `node scripts/e2e/ui-check.mjs` passes.
- [ ] **Step 3:** CHANGELOG Added: "Impact if this fails" on the item page and `GET /api/configuration-items/{id}/impact`.
- [ ] **Step 4: Commit** `feat(items): impact panel on the item page`
