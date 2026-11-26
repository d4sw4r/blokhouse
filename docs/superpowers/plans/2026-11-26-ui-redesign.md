# UI Redesign ("Leitstand") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Blokhouse's hand-styled UI with one coherent dark-first console design (light theme included), delivered in two PRs.

**Architecture:** Semantic CSS variables in `app/globals.css` (light on `:root`, dark on `.dark`) mapped into Tailwind 4 with `@theme inline`; typed components in `components/ui/` (Radix from the `radix-ui` package for dialog, menu, select, tooltip, tabs, checkbox, switch); one app shell with a role-aware navigation config; every page rebuilt from these parts without behaviour changes. Pure logic (theme, status, navigation, contrast) lives in `lib/ui/` with unit tests; the rendered UI is checked by a Playwright script in CI.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS 4, `radix-ui`, `lucide-react`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`, vitest, Playwright 1.63.0.

**Spec:** `docs/superpowers/specs/2026-11-26-ui-redesign-design.md`

## Global Constraints

- No behaviour, API or data changes; every action that works today still works. API tests (unit, integration, e2e) stay green.
- Colours only through the semantic tokens (`--bg`, `--surface`, `--surface-2`, `--border`, `--border-strong`, `--text`, `--text-muted`, `--accent`, `--accent-fg`, `--success`, `--warning`, `--danger`, `--neutral`) with the spec's values; no raw hex or Tailwind palette colours (`gray-*`, `white`, `red-*`, …) in rebuilt pages or components.
- Text contrast ≥ 4.5:1, UI borders/icons ≥ 3:1, in both themes; status never by colour alone (dot + word).
- Fonts: IBM Plex Sans (UI), IBM Plex Mono (names in tables, IPs, MACs, IDs, counters, code), self-hosted via `@fontsource`; no Google Fonts.
- Icons: `lucide-react` only; no emoji in the UI.
- Radius 6 px (controls), 8 px (panels); controls 32–36 px tall; touch targets ≥ 44 px below 640 px width; visible 2 px accent focus ring; transitions ≤ 150 ms and none with `prefers-reduced-motion`.
- Theme: default dark; storage key `blokhouse-theme` (values `dark`|`light`|`system`), written only when the user picks; the old `theme` key is ignored.
- Navigation groups and entries exactly as the spec's App shell section; role filtering as its role list.
- Content max width 1440 px, side padding 28 px (16 px below 640 px). Below 1024 px the nav collapses into a menu button + sheet.
- English UI copy; no model identifiers anywhere in the repo.

## Review Focus

1. Long values (a 60-character item name, an IPv6 address, ten tags) must not push the page wider than the viewport: Task 6's UI check seeds such an item and asserts no horizontal overflow on Items and Item detail at 390 px.
2. A theme picked in the user menu survives a reload with no flash of the other theme: Task 6's UI check picks light, reloads, and asserts `<html>` has class `light` before hydration (checked on `DOMContentLoaded`).
3. A READONLY user sees no admin or admin-only entries and no link leads to a 403/redirect: Task 6's UI check runs the navigation pass as a READONLY user and asserts every visible nav link answers 200 and none points under `/admin` except `/admin/api`.
4. Menus and dialogs work by keyboard: Task 5's UI-check steps Tab to a nav group, open it with Enter, move with ArrowDown, close with Escape and assert focus returns to the trigger.
5. A fresh install with no items renders every page with empty states and no console errors: Task 6's UI check runs one pass before seeding.

## Local tooling

PostgreSQL on 127.0.0.1:5433 (`su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/bhpg -o '-p 5433 -k /tmp' start"` if down). Database `ans` for the dev server, `bh_test` for integration tests. Dev server: `DATABASE_URL=postgresql://postgres@127.0.0.1:5433/ans NEXTAUTH_URL=http://localhost:3100 NEXTAUTH_SECRET=dev npx next dev -p 3100` (background). Chromium + Playwright are preinstalled (`require('playwright')`). No Docker daemon: the compose-based CI step runs only in CI.

---

## PR 1: foundation and core pages

### Task 1: Tokens, fonts and dependencies

**Files:**
- Modify: `app/globals.css`, `app/layout.tsx`, `package.json`, `package-lock.json`
- Create: `lib/ui/contrast.ts`
- Test: `__tests__/ui/contrast.test.js`

**Interfaces:**
- Produces: CSS variables listed in Global Constraints; Tailwind utilities `bg-bg`, `bg-surface`, `bg-surface-2`, `border-border`, `border-border-strong`, `text-text`, `text-muted`, `text-accent`, `bg-accent`, `text-accent-fg`, `text-success|warning|danger|neutral`, `bg-success|warning|danger|neutral`; `font-sans` = IBM Plex Sans, `font-mono` = IBM Plex Mono; `dark:` follows the `.dark` class.
- Produces: `contrastRatio(hexA: string, hexB: string): number` and `readTokens(css: string): { light: Record<string,string>, dark: Record<string,string> }` in `lib/ui/contrast.ts`.

- [ ] **Step 1: Write the failing test** `__tests__/ui/contrast.test.js`: read `app/globals.css`, `readTokens`; for both themes assert `contrastRatio(text, bg) >= 4.5`, `(text, surface) >= 4.5`, `(text-muted, bg) >= 4.5`, `(text-muted, surface) >= 4.5`, `(accent-fg, accent) >= 4.5`, each of `success|warning|danger|neutral|accent` against `bg` and `surface` `>= 3`, `(border-strong, surface) >= 3`. Plus `contrastRatio("#000000", "#FFFFFF")` ≈ 21 and `contrastRatio("#777777","#777777") === 1`.
- [ ] **Step 2: Run** `npx vitest run __tests__/ui/contrast.test.js`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement.** `lib/ui/contrast.ts` (WCAG relative luminance; `readTokens` parses the `:root { … }` and `.dark { … }` blocks for `--name: #hex;`). In `globals.css`: `@custom-variant dark (&:where(.dark, .dark *));`, the token blocks with the spec's values (adjust a shade only if the test fails; note the change in a CSS comment), `@theme inline` mapping, `--font-sans`/`--font-mono`, base layer (`body` bg/text/font, focus-visible ring `2px solid var(--accent)` with offset 2px, `@media (prefers-reduced-motion: reduce)` disabling transitions), remove the 0.3 s html/body transitions, keep the `--color-brand-*` names as aliases (`--color-brand-primary: var(--accent)`, `--color-brand-background: var(--bg)`, `--color-brand-text: var(--text)`, `--color-brand-secondary: var(--text-muted)`, `--color-brand-accent: var(--accent)`) and delete the old `.dark` brand overrides. Install `radix-ui`, `lucide-react`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono` (exact current versions); import weights 400/500/600 sans and 400/500 mono in `app/layout.tsx`.
- [ ] **Step 4: Run** the test, `npm test`, `npm run build`. Expected: PASS, build succeeds.
- [ ] **Step 5: Commit** `feat(ui): design tokens, fonts and dark variant`.

### Task 2: Theme (default dark, no flash)

**Files:**
- Create: `lib/ui/theme.ts`
- Modify: `components/ThemeProvider.tsx`, `app/layout.tsx`
- Test: `__tests__/ui/theme.test.js`

**Interfaces:**
- Produces: `THEME_KEY = "blokhouse-theme"`; `type ThemeChoice = "dark"|"light"|"system"`; `readThemeChoice(value: string|null): ThemeChoice` (invalid/missing → `"dark"`); `resolveTheme(choice: ThemeChoice, systemDark: boolean): "dark"|"light"`; `themeInitScript(): string` (inline script source that applies the class before paint). `useTheme()` keeps `{ theme, setTheme, resolvedTheme }`; `setTheme` is the only writer of `THEME_KEY`.

- [ ] **Step 1: Write the failing tests:** `readThemeChoice(null) === "dark"`, `readThemeChoice("bogus") === "dark"`, `readThemeChoice("light") === "light"`; `resolveTheme("system", true) === "dark"`, `resolveTheme("system", false) === "light"`, `resolveTheme("light", true) === "light"`; `themeInitScript()` contains `"blokhouse-theme"` and does not contain `localStorage.setItem`; evaluating it in a fake `{ localStorage, matchMedia, document.documentElement.classList }` with nothing stored adds `dark`, with `"light"` stored adds `light`, with old key `theme="system"` only still adds `dark`.
- [ ] **Step 2: Run** `npx vitest run __tests__/ui/theme.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `lib/ui/theme.ts`; rewrite `ThemeProvider` on it (no write on mount; listen to `matchMedia` only for `system`); in `app/layout.tsx` add `<script dangerouslySetInnerHTML={{ __html: themeInitScript() }} />` in `<head>`.
- [ ] **Step 4: Run** the test and `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(ui): dark theme by default without flash`.

### Task 3: Base components

**Files:**
- Create: `components/ui/{Button,IconButton,Input,Textarea,Field,Badge,StatusDot,Kbd,Panel,StatTile,PageHeader,Toolbar,Table,EmptyState}.tsx`, `lib/ui/status.ts`
- Modify: `components/ui/Button.tsx` (replaced), `components/Skeleton.tsx` (restyled, same exports)
- Test: `__tests__/ui/status.test.js`

**Interfaces:**
- Produces: `statusTone(status: string): { tone: "success"|"warning"|"neutral"; label: string }` — `ACTIVE`→`success`/"Active", `MAINTENANCE`→`warning`/"Maintenance", `DEPRECATED`→`neutral`/"Deprecated", anything else→`neutral` with the status title-cased.
- Produces components (all forward `className` and native props): `Button({ variant?: "primary"|"secondary"|"ghost"|"danger"; size?: "sm"|"md"; loading?: boolean })` — also accepts the legacy `variant="outline"`→secondary, `"destructive"`→danger and `size="lg"`→md until Task 16; default export kept for existing imports; `IconButton({ label: string; icon: LucideIcon; … })` (renders `aria-label={label}`); `Input`, `Textarea`; `Field({ label, htmlFor, hint?, error?, children })`; `Badge({ tone?: "neutral"|"accent"|"success"|"warning"|"danger" })`; `StatusDot({ status: string })` (dot + label from `statusTone`); `Kbd`; `Panel({ title?, actions?, padded? })`; `StatTile({ label, value, tone? })` (value in mono); `PageHeader({ title, description?, actions? })`; `Toolbar`; `Table`, `THead`, `TBody`, `TR`, `TH({ sortable?, sorted?: "asc"|"desc"|false, onSort? })`, `TD({ mono?: boolean })` inside an `overflow-x-auto` wrapper; `EmptyState({ icon?, title, description?, action? })`.

- [ ] **Step 1: Write the failing test** for `statusTone` with the four cases above (`"RETIRED"` → `{ tone: "neutral", label: "Retired" }`).
- [ ] **Step 2: Run** `npx vitest run __tests__/ui/status.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `lib/ui/status.ts` and the components (tokens only, Global Constraints sizes).
- [ ] **Step 4: Run** the test, `npm test`, `npx tsc --noEmit`, `npm run lint`. Expected: PASS, 0 errors.
- [ ] **Step 5: Commit** `feat(ui): base components`.

### Task 4: Radix-based components

**Files:**
- Create: `components/ui/{Select,Checkbox,Switch,Tabs,Dialog,ConfirmDialog,DropdownMenu,Tooltip,Sheet}.tsx`
- Modify: `components/ToastProvider.tsx` (restyle only, same API)

**Interfaces:**
- Produces thin styled wrappers keeping Radix part names: `Select({ value, onValueChange, options: {value,label}[], placeholder?, id? })`; `Checkbox`, `Switch` (Radix props); `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`; `Dialog`, `DialogTrigger`, `DialogContent({ title, description?, children, footer? })`; `ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, tone?: "danger", onConfirm })`; `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`; `Tooltip({ content, children })` (provider included); `Sheet({ open, onOpenChange, side?: "left"|"right", title, children })`.

- [ ] **Step 1: Implement** the wrappers (tokens only; Dialog/Sheet with overlay, focus trap and Escape from Radix; content portals to `body`).
- [ ] **Step 2: Run** `npx tsc --noEmit`, `npm run lint`, `npm run build`. Expected: no errors. (Behaviour is Radix's; the keyboard behaviour is asserted in Task 5's UI-check steps.)
- [ ] **Step 3: Commit** `feat(ui): dialog, menu, select and other interactive components`.

### Task 5: Navigation config and app shell

**Files:**
- Create: `lib/ui/nav.ts`, `components/shell/{AppShell,TopBar,NavMenu,MobileNav,UserMenu,Logo}.tsx`
- Modify: `components/ClientWrapper.jsx` (render `AppShell` instead of `Navbar`), `app/(admin)/admin/layout.tsx` (use the same shell; drop the sidebar), `components/CommandPalette.tsx` (restyle; its page list comes from `navForRole`)
- Test: `__tests__/ui/nav.test.js`

**Interfaces:**
- Produces: `type NavEntry = { label: string; href: string; roles?: Role[] }`, `type NavGroup = { label: string; href?: string; entries: NavEntry[] }`, `NAV: NavGroup[]` (groups and entries exactly as the spec, entry `roles` from the spec's role list; no `roles` = all signed-in roles except `API`), `navForRole(role: string): Array<{ label: string; href: string } | { label: string; entries: NavEntry[] }>` — filters entries by role, drops empty groups, turns one-entry groups into a link with the entry's href.
- Produces: `AppShell({ children })` (top bar + `<main>` with max width/padding); every top-bar link/trigger carries `data-nav-item`; search field opens the command palette (`/` and ⌘K); `UserMenu` shows name and role, theme radio (dark/light/system via `useTheme().setTheme`), "API docs" (`/docs`), "Sign out".

- [ ] **Step 1: Write the failing tests:** `navForRole("ADMIN")` labels are `["Overview","Inventory","Topology","Model","Automation","Reports","Admin"]`; Inventory entries `["Items","Tags","Compare","Maintenance"]`; `navForRole("READONLY")`: no `Admin`, `Model` is a link to `/types`, `Automation` entries `["Discovery","API tokens"]`, no href starting with `/admin` except `/admin/api`; `navForRole("AUDIT")`: `Admin` is a link to `/admin/audit-logs`; `navForRole("API")` is `[]`; every href in `NAV` starts with `/`.
- [ ] **Step 2: Run** `npx vitest run __tests__/ui/nav.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `lib/ui/nav.ts`, then the shell (Radix DropdownMenu per group; below 1024 px a menu IconButton opens `Sheet` with the same groups; `aria-current="page"` on the active entry).
- [ ] **Step 4: Run** the test, `npm test`, `npm run build`; start the dev server and check `/dashboard` and `/admin/users` render the new top bar (Playwright screenshot for yourself, 1280 and 390 px).
- [ ] **Step 5: Commit** `feat(ui): app shell with role-aware navigation`.

### Task 6: UI check (Playwright) in CI

**Files:**
- Create: `scripts/e2e/ui-check.mjs`, `scripts/e2e/ui-pages.json`, `scripts/e2e/ui-seed.mjs`
- Modify: `.github/workflows/ci.yml` (docker job: steps after the smoke test), `.gitignore` (`ui-screenshots/`)

**Interfaces:**
- Consumes: `data-nav-item` (Task 5), `blokhouse-theme` (Task 2).
- Produces: `node scripts/e2e/ui-check.mjs [--empty]` with env `BASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `READONLY_EMAIL`, `READONLY_PASSWORD`; reads `ui-pages.json` (`[{ "path": "/items", "title": "Items" }, …]`, later tasks append); exits 1 on any failure; writes `ui-screenshots/<theme>-<width>-<slug>.png`. `node scripts/e2e/ui-seed.mjs` (same env) creates via API the READONLY user, 8 items incl. one named with 60 characters, one with IPv6 `2001:db8:85a3::8a2e:370:7334` and ten tags, and 5 relations.

- [ ] **Step 1: Write** `ui-check.mjs` in the style of `scripts/e2e/sso.spec.mjs` (plain Node + Playwright, `check(name, fn)`), checking for each page in `ui-pages.json` × theme (`dark`, `light`, set via `localStorage["blokhouse-theme"]` before load) × width (1280, 390) as admin: no `console` errors and no `pageerror`; `document.documentElement.scrollWidth <= innerWidth`; at 1280 px no two `[data-nav-item]` boxes intersect; screenshot. Extra checks (Review Focus): theme persistence (pick Light in the user menu, reload, `html.classList.contains("light")` at `DOMContentLoaded`); keyboard (Tab to the first nav group, Enter opens, ArrowDown moves, Escape closes and focus is back on the trigger); as READONLY every visible nav link answers 200 and none points under `/admin` except `/admin/api`. `--empty` runs only the per-page pass (before seeding).
- [ ] **Step 2: Start** with `ui-pages.json` = `[{"path":"/dashboard"}]` and run locally against the dev server (empty pass, seed, full pass). Expected: all `ok`.
- [ ] **Step 3: Add the CI steps** to the docker job after the smoke test: install Playwright as the SSO step does, `--empty` pass, seed, full pass, then `actions/upload-artifact` (pinned v4.x or newer) of `ui-screenshots/` with `if: always()`.
- [ ] **Step 4: Commit** `test(ui): Playwright UI check for layout, themes and navigation`.

### Task 7: Items page

**Files:**
- Modify: `app/(root)/items/page.tsx` (split into `app/(root)/items/_components/*.tsx` as needed), `scripts/e2e/ui-pages.json` (`/items`)

- [ ] **Step 1: Rebuild** with PageHeader (title, count, Import/Export/New item actions as today), Toolbar filter bar (existing filters), Table (mono name and IP, StatusDot, tags as Badges, existing columns and sorting), bulk actions toolbar shown on selection (existing `BulkOperations` restyled), existing dialogs as `Dialog`/`ConfirmDialog`, EmptyState when no items. Every handler and fetch stays as it is.
- [ ] **Step 2: Verify** behaviour by hand in the dev server against `ans` (create, edit, delete, filter, bulk tag, CSV import), then `node scripts/e2e/ui-check.mjs` (both passes). Expected: all `ok`.
- [ ] **Step 3: Commit** `feat(ui): items page`.

### Task 8: Item detail

**Files:**
- Modify: `app/(root)/items/[id]/page.tsx`, `components/{AssetRelations,FavoriteButton,CopyButton}.tsx`, `scripts/e2e/ui-pages.json` (an item detail path resolved by the seed: `"/items/:first"`, the check replaces `:first` with the first item's id)

- [ ] **Step 1: Rebuild** with a header (name in mono, StatusDot, type Badge, actions), Panels for fields, custom fields, tags, relations (AssetRelations restyled, its add-relation picker as `Select`/`Dialog`), maintenance and history. Behaviour unchanged.
- [ ] **Step 2: Verify** by hand (edit fields, add/remove relation, favorite, copy) and run the UI check. Expected: all `ok`.
- [ ] **Step 3: Commit** `feat(ui): item detail page`.

### Task 9: Dashboard

**Files:**
- Modify: `app/(root)/dashboard/page.tsx`, `components/FavoritesWidget.tsx`, `scripts/e2e/ui-pages.json`

- [ ] **Step 1: Rebuild** with StatTiles for today's numbers (items, types, per status with tones), status overview, recent activity, upcoming maintenance, favorites; no new data.
- [ ] **Step 2: Verify** and run the UI check. Expected: all `ok`.
- [ ] **Step 3: Commit** `feat(ui): dashboard`.

### Task 10: Graph

**Files:**
- Modify: `app/(root)/graph/page.tsx`, `scripts/e2e/ui-pages.json`
- Create: `lib/ui/cssVar.ts`

**Interfaces:**
- Produces: `cssVar(name: string, el?: Element): string` (reads a computed custom property, trimmed).

- [ ] **Step 1: Rebuild** the controls in Panels; canvas colours from `cssVar` (status tones, edge colours from accent/success/warning/danger/neutral, labels `--text`, background `--surface`), re-read on theme change; simulation centre = canvas width/2, height/2 (resize-aware) instead of the fixed `(500, 400)`; EmptyState when there are no relations.
- [ ] **Step 2: Verify** in both themes with the seeded relations (nodes centred, readable labels) and run the UI check. Expected: all `ok`.
- [ ] **Step 3: Commit** `feat(ui): relationship graph`.

### Task 11: Sign in and sign up

**Files:**
- Modify: `app/(auth)/layout.tsx`, `app/(auth)/signin/page.jsx`, `app/(auth)/signup/page.jsx`, `scripts/e2e/ui-check.mjs` (signed-out pass for `/signin`, `/signup`)

- [ ] **Step 1: Rebuild** as a centred Panel on `--bg` with logo, SSO button (when configured), password form (when enabled), error messages, signup link (when enabled); same texts and logic as today (the SSO e2e test finds "Sign in with …" and the error messages).
- [ ] **Step 2: Verify** sign in/out by hand and run the UI check (signed-out pass). Expected: all `ok`.
- [ ] **Step 3: Commit** `feat(ui): sign-in and sign-up pages`.

### Task 12: PR 1 wrap-up

- [ ] **Step 1:** CHANGELOG `[Unreleased]` → `### Changed`: "New interface: dark console design with a light theme, grouped navigation and accessible menus and dialogs (dark is the default; switch in the user menu)." Run `npm test`, `npm run lint`, `npx tsc --noEmit`, integration tests, `npm run build`.
- [ ] **Step 2:** Commit `docs: changelog for the new interface`, push `feat/ui-redesign`, open the PR (title `feat(ui): new interface, part 1`), watch CI; merge when green.

## PR 2: remaining pages and cleanup

Branch `feat/ui-redesign-2` from `main` after PR 1 is merged. Each page task: rebuild from the components with behaviour unchanged, verify by hand, add the path(s) to `ui-pages.json`, run the UI check, commit `feat(ui): <pages>`.

### Task 13: Inventory pages — Compare, Tags, Maintenance

**Files:** `app/(root)/compare/page.tsx`, `app/(root)/tags/page.tsx`, `app/(root)/maintenance/page.tsx`, `scripts/e2e/ui-pages.json`

- [ ] **Step 1:** Rebuild the three pages; verify; UI check; commit.

### Task 14: Types, Discovery, Notifications, Reports, Docs

**Files:** `app/(root)/types/page.jsx` (may become `.tsx`), `app/(root)/discovery/page.tsx`, `app/(root)/notifications/page.tsx`, `components/NotificationBell.tsx`, `app/(root)/reports/page.tsx`, `app/(root)/docs/page.tsx` (shell around the generated docs only), `scripts/e2e/ui-pages.json`

- [ ] **Step 1:** Rebuild; verify; UI check; commit.

### Task 15: Admin pages

**Files:** `app/(admin)/admin/{page,users/page,api/page,webhooks/page,custom-fields/page,audit-logs/page,settings/page}.tsx`, `scripts/e2e/sso.spec.mjs`, `scripts/e2e/ui-pages.json`

- [ ] **Step 1:** Admin overview as StatTile-style links to the admin pages; rebuild the others (users table with role `Select`, SSO badge, activate/deactivate via `ConfirmDialog`; tokens; webhooks; custom fields; audit logs with filters; settings).
- [ ] **Step 2:** Update `sso.spec.mjs` selectors to the new Users markup (role select, edit action, SSO badge) keeping every assertion's meaning; it runs in CI only (Keycloak).
- [ ] **Step 3:** Verify by hand (change a role, deactivate/activate, create/revoke a token, create a webhook), UI check; commit.

### Task 16: Remove the old styling

**Files:**
- Delete: `components/Navbar.jsx`, `components/ThemeToggle.tsx`, `components/ThreeBackground.js`, `tailwind.config.ts`, `postcss.config.mjs`
- Modify: `app/globals.css` (drop `--color-brand-*` aliases), `components/ui/Button.tsx` (drop legacy variant/size values), `package.json` (remove `three`)
- Test: `__tests__/ui/no-legacy-styles.test.js`

- [ ] **Step 1: Write the failing test:** scan `app/**` and `components/**` (`.tsx/.jsx/.ts/.js`) and assert no match of `/\bbrand-/`, `/\b(?:bg|text|border|ring|from|to|via)-(?:white|black|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?\b/`, `variant="outline"`, `variant="destructive"`, `size="lg"`, `from "three"`.
- [ ] **Step 2: Run** it. Expected: FAIL only where leftovers remain; fix each, delete the files above.
- [ ] **Step 3: Run** the test, `npm test`, lint, typecheck, `npm run build`, UI check. Expected: PASS.
- [ ] **Step 4: Commit** `chore(ui): remove the old styling`.

### Task 17: Docs and PR 2

- [ ] **Step 1:** README: section "Screenshots" with Dashboard and Items (dark, 1280 px) from the UI check, stored under `docs/images/`; CHANGELOG entry extended (all pages; removed Three.js).
- [ ] **Step 2:** Full verification as in Task 12; push, open the PR (`feat(ui): new interface, part 2`), watch CI, merge when green.
