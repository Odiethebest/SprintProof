# DESIGN.md — SprintProof

<!--
  UI tokens and component rules. AI tools: use ONLY these tokens through Tailwind classes.
  No arbitrary hex values, no one-off spacing. If a design need isn't covered here,
  propose an addition to this file instead of improvising.
  Update after the mockups in docs/design/ are final.
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
- Top bar: team name, sprint selector, `LiveIndicator`, user menu.
- **Dashboard:** `lg:grid-cols-3`; member cards span 2 columns, activity feed 1 column. Below `lg`, the feed stacks under the cards.
- Breakpoints: Tailwind defaults (`sm 640`, `md 768`, `lg 1024`). Must work at 360 px.

## 7. Components

| Component | Rules |
| --- | --- |
| `Button` | Variants: `primary` (bg-primary), `secondary` (surface + border), `ghost`, `destructive` (missed color, used only for delete/revoke). Height 36 px. One primary button per view. |
| `Card` | `bg-surface border border-border rounded-lg`. Title + optional action in the header row. |
| `StatusLabel` | Icon + label from section 3. Size 16 px icon, `text-sm`. |
| `MemberCard` | Avatar, name, GitHub login; four counts (commits, PRs, reviews, standups) in a 2×2 grid; `RequirementChecklist` below. No percentages, no ranking. |
| `RequirementChecklist` | One row per requirement using the format in section 3. |
| `LiveIndicator` | Small dot + "Live" (`met` color) or "Reconnecting…" (`text-muted`). Dot pulses only if `prefers-reduced-motion` is not set. |
| `StandupForm` | Three labeled textareas, 3 rows each, 1000-char limit with counter. Submit button text: "Post standup" or "Update today's standup". |
| `RetroColumn` | Column title, item list sorted by votes, "Add item" input at the bottom. |
| `VoteButton` | `ThumbsUp` icon + count. Filled when the user has voted. Disabled with tooltip "No votes left" when out of votes. |
| `EmptyState` | Icon, one-line explanation, one action link. |
| Forms | Visible label above every field; error text below in `missed` color with an icon, linked by `aria-describedby`. |

## 8. Motion

- Transitions 150 ms ease-out for hover and focus.
- Live update: the changed count briefly gets a `bg-primary/10` highlight for 1 s.
- Respect `prefers-reduced-motion`: no pulse, no highlight animation.

## 9. Voice and copy

- Short, neutral, specific. "1 standup to go." not "You're behind!"
- Sentence case for everything, including buttons ("Post standup").
- Dates: "Nov 4" in UI, ISO `2026-11-04` in exports.
- Never use words like "lazy", "slacking", "low contributor", "top contributor".

## 10. Accessibility checklist

- Focus ring: `focus-visible:ring-2 ring-primary ring-offset-2 ring-offset-canvas`.
- Hit targets at least 36 × 36 px.
- Live regions: one `aria-live="polite"` region per page for update announcements.
- All icons that carry meaning have text next to them; decorative icons get `aria-hidden="true"`.
