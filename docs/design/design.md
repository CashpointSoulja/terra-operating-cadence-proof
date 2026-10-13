# design.md — Operating Cadence Proof

Written before implementation. The rendered guide is `docs/design/visual-guide.html` with screenshots `docs/design/visual-guide-desktop.png` and `docs/design/visual-guide-mobile.png`.

## 1. Identity hierarchy

1. **Primary:** "Operating Cadence Proof" and "An independent concept by Ayo Ahmed". This is the first thing in the header and the page title.
2. **Secondary:** the Terra Industries wordmark, taken literally from the inline SVG on `terraindustries.co` (`public/brand/terra-wordmark.svg`, unmodified paths, `currentColor`). It sits after Ayo's name at about 60% of the title height, in mid-grey, with the label **"Unofficial · not affiliated with or endorsed by Terra Industries"** directly beside it. It never appears alone, never as a favicon, never as the largest mark on screen.
3. A footer repeats: synthetic data only, simulated onboarding only, no payment is made, nothing here is legal advice.

## 2. What I observed on terraindustries.co (desktop 1366 px and mobile 390 px)

| Element | Observed | Use here |
|---|---|---|
| Type | Rethink Sans 400/500/600/700; h1 54 px, weight 600, letter-spacing −0.04em; body 16–20 px | Rethink Sans (Google Fonts, OFL; self-hosted from the `@fontsource` package). Same tight negative tracking on display sizes only |
| Text colour | `#171717` body, `#000` headings, secondary text black at 50% | `--ink #171717`, `--ink-2 #737373`, `--ink-3 #a3a3a3` |
| Surfaces | White page, warm grey rounded panel `#f0efea` / `#f1f1f0`, borders `#ebebeb` | `--paper #fff`, `--panel #f0efea`, `--line #e3e3e3` |
| Structure | Careers page frames content in vertical **dashed guide lines** (`#d4d4d4`, 1 px dashed) | Dashed rails frame the workbench columns; dashed rules separate sections |
| Eyebrows | Small uppercase label, ~12 px, letter-spacing ~0.12em, grey ("CAREERS") | Section eyebrows: "VENDOR", "GATE", "CADENCE", "BRIEF", "EXPORT" |
| Buttons | Black pill, white text, 600 weight, ~48 px tall; secondary white with 1 px border, 8 px radius | Primary = black pill; secondary = white bordered pill |
| Accent | `#e40000` red (sparingly), `#008138` green | Red = **Blocked**, green = **Ready**, amber `#a15c00` = **Stale / hold**. Status is always text + colour, never colour alone |
| Imagery | Full-bleed product photography | **Not used.** No product, drone or field imagery anywhere in this build |

## 3. Layout

- Desktop (≥ 1024 px): header, then a 12-column grid inside dashed rails, max width 1280 px. Left column (5/12): vendor record and checklist. Right column (7/12): gate result, cadence, brief. Export strip full width.
- Tablet / mobile (< 1024 px): single column in task order — scenario controls, vendor, gate, cadence, brief, export. Tap targets ≥ 44 px. No horizontal scroll at 390 px; tables collapse to stacked rows with labels.
- Sticky header on desktop only.

## 4. Components

- **Status chip:** pill, 12 px uppercase text with a leading glyph: `■ BLOCKED`, `● READY`, `▲ STALE`, `◆ HOLD`. Colour + glyph + word.
- **Reason list:** every block lists machine code (`approval_stale`) and a plain sentence. Never "something went wrong".
- **KPI tile:** big numerator/denominator ("3 / 5"), percentage only when the denominator ≥ 1, an explicit "n = 5" line, and "No data — denominator 0" instead of 0% or 100%.
- **Revision badge:** `rev 14 · fp 3a9c…` in mono, on the brief and every export, so the reader can see which version they hold.
- **Simulated banner:** amber-on-panel strip on any action that would be real-world in production: "Simulated onboarding. No payment, no vendor contact."

## 5. Motion and states

- No decorative motion. 150 ms colour transitions on buttons only.
- Every action shows its result inline (gate re-evaluated, event appended); a 409 revision conflict shows "This view is out of date — reloaded rev N" and reloads.
- Focus ring: 2 px `#171717` outline with 2 px offset; never removed.

## 6. Accessibility

WCAG AA contrast for all text (secondary `#737373` on white = 4.7:1). Landmarks (`header`, `main`, `footer`), labelled form controls, `aria-live="polite"` region for gate and brief results.

## 7. Words

First person from Ayo in docs; neutral product voice in UI. Avoid "AI", "smart", "seamless". Say "simulated", "synthetic", "hypothesis" where they apply.
