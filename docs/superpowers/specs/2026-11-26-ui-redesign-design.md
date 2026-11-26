# UI redesign: "Leitstand"

Status: design for approval (2026-11-26)

## Intent

Blokhouse works, but its interface looks assembled rather than designed: the
colours do not fit together, items in the top navigation overlap, and every page
is styled by hand in its own way. Companies judge a tool by its first screen. The
goal is a coherent product design in one direction the user chose from three
mockups: **"Leitstand"**, a dark, technical console look for operations teams
(mockup B in the design canvas "Blokhouse Design-Entwürfe").

## Goals

- One visual language across every page: colours, type, spacing, components.
- Dark theme by default, a light theme in the same style, and "system" as an
  option (decided).
- Navigation that never overlaps: grouped sections, wraps or collapses on narrow
  screens.
- Solid interactive parts (dialogs, menus, selects, tooltips, tabs) with
  keyboard and screen-reader support.
- Every page usable at phone width.

## Non-goals

- New features, new pages, API or data changes. Behaviour stays as it is;
  this is a visual and structural rework of the UI only.
- Translations (the UI stays English).
- A public design system or Storybook.
- Redesigning the generated API docs page beyond the shell around it.

## Anti-goals

- A generic template look ("Bootstrap 2015", mockup A) or a hand-made look
  where pages differ (mockup C).
- Pages left in the old style after the second PR.
- Broken functionality: every action that works today works afterwards.
- Text or status colours below WCAG AA contrast in either theme, or status
  told apart by colour alone.

## Current state

- Next.js 16 App Router, Tailwind CSS 4 (`app/globals.css` with `@theme`;
  `tailwind.config.ts` is not loaded by Tailwind 4 and is dead), React 19.
- About 20 pages: `app/(root)/*` (dashboard, items, items/[id], graph, compare,
  types, tags, discovery, maintenance, notifications, reports, docs),
  `app/(admin)/admin/*` (overview, users, API tokens, webhooks, custom fields,
  audit logs, settings), `app/(auth)/*` (sign in, sign up).
- Styling: 421 uses of `brand-*` colours (wood brown, roof red, cream), about
  960 raw Tailwind palette classes (`bg-white`, `text-gray-800`, `bg-red-50`, …)
  and 135 `dark:` variants, mostly inline per page. One shared component
  (`components/ui/Button.tsx`).
- `dark:` utilities do not follow the theme today: `globals.css` has no
  `@custom-variant dark`, so Tailwind 4 applies them by the OS setting, while
  `ThemeProvider` sets a `dark` class on `<html>`. The theme switch therefore
  changes only the background and two `brand-*` colours.
- Two PostCSS configs: `postcss.config.js` (Tailwind 4 plugin, in use) and
  `postcss.config.mjs` (old v3 plugin name, dead).
- Shell: `components/Navbar.jsx` (one row of nine links plus "Admin Area",
  which overlaps),
  a separate sidebar layout for admin pages, `CommandPalette` (⌘K),
  `ToastProvider`, `ThemeProvider` (light/dark/system via a `dark` class on
  `<html>`, default "system"), `ThemeToggle`.
- `components/ThreeBackground.js` and the `three` dependency are unused.

## Approaches considered

1. Own components on Tailwind 4, no new dependencies. Full control, but
   dialogs, menus and selects would have to be made accessible by hand, which is
   where the current UI feels assembled.
2. **Own tokens and components, with Radix primitives for the hard parts**
   (shadcn/ui-style: the component code lives in the repo, Radix supplies
   behaviour without styling). Chosen: proven focus and keyboard behaviour,
   look entirely our own.
3. A full UI library (Mantine, MUI). Rejected: fights Tailwind and looks like
   someone else's product.

## Design

### Visual language

- **Type:** IBM Plex Sans for UI text, IBM Plex Mono for machine values (item
  names in tables, IPs, MACs, IDs, counters, code). Self-hosted via
  `@fontsource` packages, not Google Fonts at runtime or build time (my call:
  installations behind proxies and air-gapped builds must work).
- **Colour:** neutral blue-grey ground, one accent (cyan), status colours that
  also differ in lightness. All colours are semantic CSS variables; components
  never use raw hex values.

| Token | Dark (default) | Light |
|---|---|---|
| `--bg` page | `#0B0F14` | `#F6F8FA` |
| `--surface` panels | `#11161D` | `#FFFFFF` |
| `--surface-2` hover, selected | `#1A222C` | `#EEF2F6` |
| `--border` | `#1F2732` | `#D8DEE4` |
| `--border-strong` inputs | `#263140` | `#C3CBD4` |
| `--text` | `#E6EDF3` | `#0D1117` |
| `--text-muted` | `#9AA7B4` | `#57606A` |
| `--accent` | `#22D3EE` | `#0E7490` |
| `--accent-fg` text on accent | `#04141A` | `#FFFFFF` |
| `--success` | `#34D399` | `#1A7F37` |
| `--warning` | `#FBBF24` | `#9A6700` |
| `--danger` | `#F87171` | `#CF222E` |
| `--neutral` (deprecated, unknown) | `#94A3B8` | `#6E7781` |

  The builder may adjust shades to pass contrast (4.5:1 for text, 3:1 for UI
  borders and icons) and records any change in the token file.
- **Shape and density:** radius 6 px (inputs, buttons), 8 px (panels); 4 px
  spacing grid; table rows about 40 px; controls 32–36 px tall, touch targets
  at least 44 px on phone widths.
- **Status:** a dot plus the word (Active, Maintenance, Deprecated), never
  colour alone.
- **Icons:** `lucide-react` (stroke icons, one consistent set); no emoji.
- **Motion:** none beyond 150 ms hover/focus transitions; honours
  `prefers-reduced-motion`. The 0.3 s colour transition on `html`/`body` goes.
- **Focus:** a visible 2 px accent ring on every focusable element.

### Theme

- Tokens defined in `app/globals.css`: light values on `:root`, dark values on
  `.dark`, mapped into Tailwind with `@theme inline` so utilities read
  `bg-surface`, `text-muted`, `border-border`, `text-accent`, etc.
- `globals.css` gets `@custom-variant dark (&:where(.dark, .dark *));` so
  `dark:` follows the class, not the OS.
- `ThemeProvider` keeps light/dark/system; the default becomes **dark**
  (decided). My call: today's provider writes `"system"` to localStorage on
  every first visit, so nearly every stored value is not a real choice. The
  new provider uses a new key (`blokhouse-theme`), stores a value only when
  the user picks one, and ignores the old `theme` key, so existing users also
  land on dark once and can switch in the user menu. A small inline script in
  `app/layout.tsx` sets the class before first paint, so there is no flash of
  the wrong theme.
- The theme switch moves into the user menu.

### App shell

- One top bar for all signed-in pages (admin included; the separate admin
  sidebar layout goes):
  - logo and product name;
  - grouped navigation, each group a link or a dropdown menu (Radix):
    - **Overview** → `/dashboard`
    - **Inventory** → Items, Tags, Compare, Maintenance
    - **Topology** → Graph
    - **Model** → Types, Custom fields
    - **Automation** → Discovery, Webhooks, API tokens
    - **Reports** → `/reports`
    - **Admin** → Overview, Users, Audit log, Settings
  - search field that opens the command palette (`/` and ⌘K);
  - notifications bell;
  - user menu: name, role, theme (dark/light/system), API docs, sign out.
- Entries follow what each role may open (`proxy.ts` and the page checks),
  my call:
  - ADMIN: everything.
  - USER, READONLY: no Admin group, no Webhooks, no Custom fields; API tokens
    (their own) stays under Automation.
  - AUDIT: as READONLY, plus Audit log; its Admin group then holds only Audit
    log and renders as a plain link.
  - A group left with one entry for a role renders as a plain link, not a
    one-item menu.
  The navigation is one config (label, href, roles) used by the bar, the mobile
  sheet and the command palette.
- Below about 1024 px the group links collapse into a menu button that opens
  the navigation in a sheet (Radix Dialog); the bar never overlaps or wraps
  into a second row of crowded links.
- Content area: max width 1440 px, 28 px side padding (16 px on phones).

### Components (`components/ui/`)

Built on the tokens, one file each, typed:

- Button (primary, secondary, ghost, danger; sm, md; icon-only with
  `aria-label`), IconButton
- Input, Textarea, Select (Radix), Checkbox, Switch, Field (label, hint, error)
- Badge, StatusDot (status → colour and label), Kbd
- Panel (surface with border), StatTile (label, mono value, optional tone)
- Table (header, row, cell; dense; sortable header affordance; horizontal
  scroll box on narrow screens)
- PageHeader (title, description, actions), Toolbar / FilterBar
- Tabs (Radix), Dialog and ConfirmDialog (Radix), DropdownMenu (Radix),
  Tooltip (Radix), Sheet (Radix Dialog from the side)
- EmptyState, Skeleton (existing, restyled), Toast (existing provider,
  restyled)

Radix comes from the `radix-ui` package. The existing `Button` is replaced;
its call sites move to the new one.

### Pages

Every page is rebuilt from these components without changing what it does.
Notable points:

- **Items:** dense table with mono name and IP columns, status dots, filter bar,
  bulk actions in a toolbar that appears on selection.
- **Item detail:** header with name, status, type and actions; sections for
  fields, tags, relations, history as panels.
- **Dashboard:** the data it shows today, restyled: stat tiles for its
  existing numbers (items, types, per-status counts), status overview, recent
  activity and upcoming maintenance. No new data (my call; "stale items" from
  the mockup would be a new feature).
- **Graph:** canvas colours read from the tokens (so both themes work); the
  graph is centred on the actual canvas size instead of a fixed point.
- **Sign in / sign up:** centred panel on the dark ground with logo, SSO
  button and password form; no Three.js.
- **Admin pages:** same shell; an admin overview with tiles linking to the
  admin pages.

### Delivery (decided: two PRs)

1. **Foundation and core pages:** tokens and fonts, theme default and
   no-flash script, `components/ui/*`, the new shell and navigation, and the
   pages Items, Item detail, Dashboard, Graph, Sign in, Sign up. The old
   `brand-*` tokens stay as aliases of the new ones. My call: pages not yet
   migrated may look uneven between the two PRs (their raw `gray`/`white`
   classes are not remapped); PR 2 follows directly and there is no release in
   between. PR 1's UI check covers only PR 1's pages.
2. **Remaining pages** (Compare, Types, Tags, Discovery, Maintenance,
   Notifications, Reports, Docs, all admin pages), then removal of the
   `brand-*` aliases, `tailwind.config.ts`, `postcss.config.mjs`,
   `ThreeBackground.js`, the `three` dependency, the old `Navbar`,
   `ThemeToggle` and the admin sidebar layout.

### Tests

- Existing unit, integration and e2e tests stay green; the UI change must not
  alter API behaviour. The SSO e2e test (`scripts/e2e/sso.spec.mjs`) relies on
  the Users page markup (table rows, native select, "Edit" button); its
  selectors may be updated to the new markup as long as it checks the same
  behaviour (my call).
- New Playwright UI check in CI (docker job, against the compose stack with
  the seeded admin and a few items and relations): for every page in both
  themes, at 1280 px and 390 px width:
  - no console errors or page errors;
  - no horizontal page overflow;
  - top-bar items do not overlap (bounding boxes);
  - screenshots uploaded as a CI artifact for review.
  PR 1 covers its pages; PR 2 extends the list to all pages.
- Unit tests for components with logic (StatusDot mapping, theme default and
  stored choice).
- Contrast of the token pairs checked by a small unit test (text, muted,
  status and accent on bg and surface, both themes).

### Docs

- README gets a short screenshots section (Dashboard and Items, dark), taken
  from the UI check's artifacts (my call; it has none today).
- CHANGELOG entry (Changed: new interface; dark theme default).

## Left to the builder

- Exact component APIs and file layout inside `components/ui/`.
- Shade adjustments needed to meet contrast (recorded in the tokens).
- How each page's existing logic is split while rebuilding it, as long as
  behaviour stays the same.
- Seed data for the UI check.
