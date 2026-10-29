# DESIGN.md — SprintProof

<!--
  UI tokens and component rules. AI tools: use ONLY these tokens through Tailwind classes.
  No arbitrary hex values, no one-off spacing. If a design need isn't covered here,
  propose an addition to this file instead of improvising.
  Matches the prototype screenshots in docs/design/; update both together.
-->

## 1. Design principles

1. **Calm, not alarming.** This app is about reducing stress. Use status color sparingly; the page should feel quiet when everything is fine.
2. **Facts, not judgments.** Numbers and status labels only. No rankings, no red badges on people, no comparison arrows.
3. **Glanceable.** A member should know "am I done for this sprint?" within two seconds of opening the dashboard.

## 2. Color tokens

Defined as CSS variables in `src/app/globals.css` and exposed to Tailwind v4 through `@theme`. Light and dark values are both required.

| Token | Tailwind class example | Light | Dark | Use |
| --- | --- | --- | --- | --- |
| `canvas` | `bg-canvas` | `#FAFAF9` | `#0C0A09` | Page background |
| `surface` | `bg-surface` | `#FFFFFF` | `#1C1917` | Cards, panels, inputs |
| `border` | `border-border` | `#E7E5E4` | `#292524` | Dividers, card borders |
| `text` | `text-text` | `#1C1917` | `#F5F5F4` | Primary text |
| `text-muted` | `text-text-muted` | `#57534E` | `#A8A29E` | Secondary text, labels |
| `primary` | `bg-primary` | `#0F766E` | `#2DD4BF` | Primary buttons, links, focus ring |
| `primary-fg` | `text-primary-fg` | `#FFFFFF` | `#042F2E` | Text on primary |
| `met` | `text-met` | `#15803D` | `#4ADE80` | Requirement met |
| `on-track` | `text-on-track` | `#1D4ED8` | `#60A5FA` | Not met yet, plenty of time |
| `at-risk` | `text-at-risk` | `#B45309` | `#FBBF24` | 2 or fewer days left |
| `missed` | `text-missed` | `#B91C1C` | `#F87171` | Sprint ended, not met |

All text tokens meet 4.5:1 contrast against `canvas` and `surface` in their mode.

### `globals.css` starting point

```css
@import "tailwindcss";

:root {
  --canvas: #FAFAF9;  --surface: #FFFFFF;  --border: #E7E5E4;
  --text: #1C1917;    --text-muted: #57534E;
  --primary: #0F766E; --primary-fg: #FFFFFF;
  --met: #15803D; --on-track: #1D4ED8; --at-risk: #B45309; --missed: #B91C1C;
  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root {
    --canvas: #0C0A09;  --surface: #1C1917;  --border: #292524;
    --text: #F5F5F4;    --text-muted: #A8A29E;
    --primary: #2DD4BF; --primary-fg: #042F2E;
    --met: #4ADE80; --on-track: #60A5FA; --at-risk: #FBBF24; --missed: #F87171;
    color-scheme: dark;
  }
}

@theme inline {
  --color-canvas: var(--canvas);
  --color-surface: var(--surface);
  --color-border: var(--border);
  --color-text: var(--text);
  --color-text-muted: var(--text-muted);
  --color-primary: var(--primary);
  --color-primary-fg: var(--primary-fg);
  --color-met: var(--met);
  --color-on-track: var(--on-track);
  --color-at-risk: var(--at-risk);
  --color-missed: var(--missed);
  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, monospace;
}
```

## 3. Requirement status

Status is always shown with **icon + text label + color**, never color alone. Icons come from `lucide-react`.

| Status | Label | Icon | Color token |
| --- | --- | --- | --- |
| `MET` | Met | `CircleCheck` | `met` |
| `ON_TRACK` | On track | `Clock` | `on-track` |
| `AT_RISK` | At risk | `TriangleAlert` | `at-risk` |
| `MISSED` | Missed | `CircleX` | `missed` |

Row format: `<icon> Standups  2 / 3  · On track · 1 to go`.

## 4. Typography

Fonts: Geist Sans for UI, Geist Mono for counts and dates, both loaded with `next/font`.

| Role | Class | Use |
| --- | --- | --- |
| Page title | `text-2xl font-semibold tracking-tight` | One per page |
| Section title | `text-lg font-semibold` | Card and panel headings |
| Body | `text-sm` | Default UI text |
| Small / meta | `text-xs text-text-muted` | Timestamps, helper text |
| Numbers | `font-mono tabular-nums` | Counts, dates, days left |

Never use font sizes outside this table.

## 5. Spacing, radius, elevation

- **Spacing:** 4 px base. Use Tailwind steps `1 2 3 4 6 8 12` only. Card padding `p-4` (mobile) / `p-6` (≥ md). Gap between cards `gap-4`.
- **Radius:** inputs and buttons `rounded-md`; cards `rounded-lg`; badges and pills `rounded-full`.
- **Elevation:** cards use `border border-border` with no shadow. Only menus and dialogs use `shadow-lg`.

## 6. Layout

- Content width `max-w-6xl mx-auto px-4 md:px-6`.
- Top bar: team mark, team name with the repo below it (repo hidden below `sm`), sprint selector, `LiveIndicator`, user menu.
- Page header: title on the left with a `text-sm text-text-muted` meta line below it; pills and at most one primary action on the right. Wraps on narrow screens.
- **Dashboard:** `lg:grid-cols-3`; member cards span 2 columns in their own `md:grid-cols-2` grid, activity feed 1 column. Below `lg`, the feed stacks under the cards.
- **Standups:** `lg:grid-cols-3`; form 1 column, history 2 columns.
- **Retro:** action items panel, then the two columns (`md:grid-cols-2`), then partner feedback, stacked with `gap-4`.
- **Review:** requirements table full width, then standups and retro side by side (`lg:grid-cols-2`), then peer feedback full width.
- **Settings:** `lg:grid-cols-2`; sprints and API tokens span both columns.
- Breakpoints: Tailwind defaults (`sm 640`, `md 768`, `lg 1024`). Must work at 360 px.

## 7. Components

| Component | Rules |
| --- | --- |
| `Button` | Variants: `primary` (bg-primary), `secondary` (surface + border), `ghost`, `destructive` (`missed` text on surface with a border, used only for delete/revoke). Height 36 px, 16 px leading icon optional. Hover: primary `bg-primary/90`, secondary and ghost `bg-text/5`, destructive `bg-missed/10`. One primary button per view. |
| `Card` | `bg-surface border border-border rounded-lg`. Title + optional action in the header row, optional `text-xs text-text-muted` subtitle under the title. |
| `Pill` | `rounded-full border border-border px-2 py-1 text-xs text-text-muted`, optional 12 px icon. For roles (Lead, Member, Instructor), "Read-only", retro Open/Closed, and the votes-left counter (`h-9 px-3 text-sm` there). Never uses status colors. |
| `Avatar` | Circle with initials, `bg-primary/10 text-primary text-xs font-semibold`: 36 px on cards, 32 px in lists, 28 px in the top bar. Decorative (`aria-hidden`); the name is always shown next to it. |
| `StatusLabel` | Icon + label from section 3. Size 16 px icon, `text-sm`. |
| `RequirementSummary` | One-row card, `rounded-lg border border-border bg-surface px-4 py-3 text-sm`: `StatusLabel` followed by one plain sentence. |
| `MemberCard` | Avatar, name, GitHub login and role pill; four counts (commits, PRs, reviews, standups) as tiles in a 2×2 grid (`rounded-md border border-border p-3`, label `text-xs text-text-muted`, value `font-mono text-lg font-semibold tabular-nums`); `RequirementChecklist` below a divider. No percentages, no ranking. |
| `RequirementChecklist` | One row per requirement using the format in section 3. |
| `ActivityFeed` | Rows of a 16 px `text-muted` icon, actor and action in `text-sm`, a truncated `text-xs text-text-muted` summary, and the time in `font-mono text-xs`. |
| `LiveIndicator` | Small dot + "Live" (`met` color) or "Reconnecting…" (`text-muted`). Dot pulses only if `prefers-reduced-motion` is not set. |
| `StandupForm` | Three labeled textareas, 3 rows each, 1000-char limit with counter. Submit button text: "Post standup" or "Update today's standup". Once posted, a `met` `CircleCheck` note above the fields gives the time. |
| `RetroColumn` | Column title, item count, item list sorted by votes (each item `rounded-md border border-border p-3`), "Add item" input with an "Add" button at the bottom. |
| `VoteButton` | `ThumbsUp` icon + count, 36 px. When the user has voted: filled icon, `border-primary bg-primary/10 text-primary`. With no votes left: `aria-disabled`, 60% opacity, tooltip "No votes left". |
| `Table` | `text-sm`, header row `text-xs font-medium text-text-muted` with a bottom border, rows split by `divide-border`, numbers `font-mono tabular-nums`. Wrapped in `overflow-x-auto` so it never widens the page. |
| `Select` | Same as inputs: 36 px high, `rounded-md border border-border bg-surface px-2 text-sm`. |
| `Dialog` | Native `<dialog>`, `rounded-lg border border-border bg-surface shadow-lg`, at most 36rem wide, backdrop `canvas` at 75% opacity. Title `text-lg font-semibold`, actions right-aligned: Cancel first, then the primary or destructive action. Focus returns to the trigger on close. |
| `Toast` | The page's single `aria-live="polite"` region: bottom center, `rounded-md bg-text text-canvas px-4 py-3 text-sm`, clears after about 4.5 s. Used for confirmations ("Standup posted.") and live update announcements. |
| `Tooltip` | `rounded-md bg-text text-canvas px-2 py-1 text-xs`, shown on hover and keyboard focus, linked with `aria-describedby`. |
| `EmptyState` | Bordered box (`rounded-md border border-border p-6`), centered 24 px muted icon, one-line explanation, at most one action link. |
| Forms | Visible label above every field; inputs 36 px high, `rounded-md border border-border bg-surface px-3 text-sm`, border turns `missed` on error; error text below in `missed` color with an icon, linked by `aria-describedby`. "(optional)" in `text-text-muted` after optional labels. |
| Secrets and codes | URLs, tokens and SHAs in `font-mono text-xs`; copyable values in `rounded-md border border-border bg-canvas px-2 py-1` with a "Copy" button. A newly created token sits in `rounded-md border border-primary bg-primary/10 p-3` until dismissed. |

## 8. Motion

- Transitions 150 ms ease-out for hover and focus.
- Live update: the changed count briefly gets a `bg-primary/10` highlight for 1 s.
- Respect `prefers-reduced-motion`: no pulse, no highlight animation.

## 9. Voice and copy

- Short, neutral, specific. "1 standup to go." not "You're behind!"
- Sentence case for everything, including buttons ("Post standup").
- Dates: "Nov 4" in UI ("Tue, Nov 3" for day headings), ISO `2026-11-04` in exports. Times: "9:05 AM".
- Never use words like "lazy", "slacking", "low contributor", "top contributor".

## 10. Accessibility checklist

- Focus ring: `focus-visible:ring-2 ring-primary ring-offset-2 ring-offset-canvas`.
- Hit targets at least 36 × 36 px.
- Live regions: one `aria-live="polite"` region per page for update announcements.
- All icons that carry meaning have text next to them; decorative icons get `aria-hidden="true"`.
