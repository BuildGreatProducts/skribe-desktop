---

version: alpha\
name: Skribe\
description: An editorial, paper-and-ink design system for a Mac-native markdown writing app where AI agents edit documents in real time. Single-typeface system built on IBM Plex Serif.

colors:
surface: "#FAF7F2"
on-surface: "#2A2A2A"
on-surface-muted: "#5A5A5A"
chrome: "#F2EEE6"
on-chrome: "#3D3D3D"
on-chrome-muted: "#7A7A7A"
hairline: "#E4DFD4"
primary: "#1E2A3A"
on-primary: "#FAF7F2"
accent: "#B8732A"
selection: "#D6E4D8"
highlight: "#EFE8D8"
overlay: "#2A2A2A66"
success: "#2D5F4A"
warning: "#8B5A1E"
error: "#8B2D2A"

typography:
display:
fontFamily: "IBM Plex Serif, Iowan Old Style, Georgia, serif"
fontSize: 3rem
fontWeight: 400
lineHeight: 1.15
letterSpacing: -0.01em
fontFeature: "'kern', 'liga', 'onum'"
h1:
fontFamily: "IBM Plex Serif, Iowan Old Style, Georgia, serif"
fontSize: 2.125rem
fontWeight: 700
lineHeight: 1.25
letterSpacing: -0.01em
h2:
fontFamily: "IBM Plex Serif, Iowan Old Style, Georgia, serif"
fontSize: 1.625rem
fontWeight: 600
lineHeight: 1.3
letterSpacing: -0.005em
h3:
fontFamily: "IBM Plex Serif, Iowan Old Style, Georgia, serif"
fontSize: 1.375rem
fontWeight: 600
lineHeight: 1.35
body:
fontFamily: "IBM Plex Serif, Iowan Old Style, Georgia, serif"
fontSize: 1.125rem
fontWeight: 400
lineHeight: 1.7
fontFeature: "'kern', 'liga', 'onum'"
body-emphasis:
fontFamily: "IBM Plex Serif, Iowan Old Style, Georgia, serif"
fontSize: 1.125rem
fontWeight: 600
lineHeight: 1.7
body-italic:
fontFamily: "IBM Plex Serif, Iowan Old Style, Georgia, serif"
fontSize: 1.125rem
fontWeight: 400
lineHeight: 1.7
fontVariation: "italic"
ui-base:
fontFamily: "IBM Plex Serif, Iowan Old Style, Georgia, serif"
fontSize: 1rem
fontWeight: 500
lineHeight: 1.5
ui-small:
fontFamily: "IBM Plex Serif, Iowan Old Style, Georgia, serif"
fontSize: 0.875rem
fontWeight: 500
lineHeight: 1.5
caption:
fontFamily: "IBM Plex Serif, Iowan Old Style, Georgia, serif"
fontSize: 0.75rem
fontWeight: 500
lineHeight: 1.4
letterSpacing: 0.01em
mono:
fontFamily: "IBM Plex Mono, SF Mono, Menlo, monospace"
fontSize: 0.9375rem
fontWeight: 400
lineHeight: 1.6

rounded:
none: 0px
sm: 4px
md: 6px
lg: 8px
pill: 999px

spacing:
px: 1px
0_5: 2px
1: 0.25rem
2: 0.5rem
3: 0.75rem
4: 1rem
5: 1.25rem
6: 1.5rem
8: 2rem
10: 2.5rem
12: 3rem
16: 4rem
20: 5rem
24: 6rem

## components:
button-primary:
backgroundColor: "{colors.primary}"
textColor: "{colors.on-primary}"
typography: "{typography.ui-small}"
rounded: "{rounded.md}"
padding: 0.75rem 1rem
height: 36px
button-primary-hover:
backgroundColor: "#162132"
textColor: "{colors.on-primary}"
typography: "{typography.ui-small}"
rounded: "{rounded.md}"
padding: 0.75rem 1rem
height: 36px
button-primary-disabled:
backgroundColor: "{colors.primary}"
textColor: "{colors.on-primary}"
typography: "{typography.ui-small}"
rounded: "{rounded.md}"
padding: 0.75rem 1rem
height: 36px
button-secondary:
backgroundColor: "{colors.chrome}"
textColor: "{colors.on-chrome}"
typography: "{typography.ui-small}"
rounded: "{rounded.md}"
padding: 0.5rem 0.75rem
height: 32px
button-link:
backgroundColor: "#00000000"
textColor: "{colors.primary}"
typography: "{typography.ui-small}"
rounded: "{rounded.none}"
padding: 0px
input:
backgroundColor: "{colors.surface}"
textColor: "{colors.on-surface}"
typography: "{typography.ui-base}"
rounded: "{rounded.md}"
padding: 0.5rem 0.75rem
height: 36px
input-focus:
backgroundColor: "{colors.surface}"
textColor: "{colors.on-surface}"
typography: "{typography.ui-base}"
rounded: "{rounded.md}"
padding: 0.5rem 0.75rem
height: 36px
modal:
backgroundColor: "{colors.surface}"
textColor: "{colors.on-surface}"
typography: "{typography.ui-base}"
rounded: "{rounded.lg}"
padding: "{spacing.6}"
width: 480px
tooltip:
backgroundColor: "{colors.primary}"
textColor: "{colors.on-primary}"
typography: "{typography.caption}"
rounded: "{rounded.sm}"
padding: 0.5rem 0.75rem
file-tree-item:
backgroundColor: "#00000000"
textColor: "{colors.on-chrome}"
typography: "{typography.ui-small}"
rounded: "{rounded.sm}"
padding: 0.5rem 0.75rem
height: 32px
file-tree-item-hover:
backgroundColor: "{colors.chrome}"
textColor: "{colors.on-chrome}"
typography: "{typography.ui-small}"
rounded: "{rounded.sm}"
padding: 0.5rem 0.75rem
height: 32px
file-tree-item-active:
backgroundColor: "{colors.chrome}"
textColor: "{colors.primary}"
typography: "{typography.ui-small}"
rounded: "{rounded.sm}"
padding: 0.5rem 0.75rem
height: 32px
ai-input-bar:
backgroundColor: "{colors.chrome}"
textColor: "{colors.on-chrome}"
typography: "{typography.ui-base}"
rounded: "{rounded.none}"
padding: 0.75rem 1rem
clarification-popup:
backgroundColor: "{colors.surface}"
textColor: "{colors.on-surface}"
typography: "{typography.ui-base}"
rounded: "{rounded.lg}"
padding: "{spacing.4}"
width: 400px
block-context-toolbar:
backgroundColor: "{colors.surface}"
textColor: "{colors.on-surface-muted}"
typography: "{typography.caption}"
rounded: "{rounded.md}"
padding: 0.25rem 0.375rem
height: 32px
inline-annotation-popover:
backgroundColor: "{colors.surface}"
textColor: "{colors.on-surface-muted}"
typography: "{typography.caption}"
rounded: "{rounded.md}"
padding: 0.25rem 0.375rem
height: 28px
status-line:
backgroundColor: "{colors.chrome}"
textColor: "{colors.on-chrome-muted}"
typography: "{typography.caption}"
rounded: "{rounded.none}"
padding: 0.25rem 0.5rem
height: 24px
word-count:
backgroundColor: "#00000000"
textColor: "{colors.on-chrome-muted}"
typography: "{typography.caption}"
rounded: "{rounded.none}"
padding: 0px
selection-highlight:
backgroundColor: "{colors.highlight}"
textColor: "{colors.on-surface}"
typography: "{typography.body}"
rounded: "{rounded.sm}"
padding: 0.125rem 0.25rem
hairline-divider:
backgroundColor: "{colors.hairline}"
textColor: "{colors.on-surface-muted}"
typography: "{typography.caption}"
rounded: "{rounded.none}"
height: 1px

# Skribe Design System

## Overview

Skribe is a Mac-native markdown writing app for people who build with AI. The product opens a local folder, presents a beautiful Notion-style WYSIWYG editor in the center, and lets a Claude Code agent stream edits into the active document in real time. The reader and the writer are the same person — a thoughtful builder who lives in their docs folder — so the design must feel calm, literary, and trustworthy rather than productized or busy. The emotional tone is editorial, focused, and quietly confident: the room hushes when you open the file.

The system is paper-and-ink in spirit. A warm cream document surface (`surface`) sits inside a slightly cooler chrome panel (`chrome`); the only ornaments are hairline dividers, generous whitespace, and a single deep-ink accent. The editor never competes with the writer's prose. Anti-patterns Skribe must avoid: looking like a bright pure-white SaaS product, leaning on heavy shadows or color-blocked surfaces, decorating the chrome with playful gradients or rounded "card" stacks, and crowding the writing column with persistent affordances. When in doubt, remove a line.

## Colors

The palette is built from two warm-neutral surfaces and a near-black ink, with two functional accents and a small set of semantic states. `surface` (`#FAF7F2`) is the document — a warm cream that reads as paper without tipping into yellow. `chrome` (`#F2EEE6`) is the surrounding application chrome (file tree, AI bar, status line) — slightly cooler and a touch darker so the eye still locates the document as the primary canvas. `on-surface` (`#2A2A2A`) is the body ink: not pure black, because true black on cream is harsh and breaks the editorial mood. `on-surface-muted` (`#5A5A5A`) is for inline annotations, captions, and de-emphasized prose; `on-chrome` and `on-chrome-muted` mirror that pairing inside chrome regions.

`primary` (`#1E2A3A`) is a deep ink-blue used sparingly: primary buttons, focus outlines, the streaming indicator on the AI bar, and the active state on file-tree items. It reads as authored, not branded — a fountain pen ink rather than a logo color. `accent` (`#B8732A`) is a warm amber used only as a notification tinge: the small dot on a dirty file, occasional inline attention, and the warning semantic. `selection` (`#D6E4D8`) is a calm sage green for text selection, which feels gentler on cream than a saturated blue. `highlight` (`#EFE8D8`) is the soft cream tone used for selected/highlighted blocks in the reading view, drawn directly from the reference image's selected paragraph treatment. Semantic colors (`success`, `warning`, `error`) are desaturated and aged so they coexist with the editorial palette instead of clashing with it. All text/background pairings clear WCAG AA at body size; the muted variants stay above 4.5:1 against their respective surfaces.

## Typography

Skribe is a single-typeface system. **IBM Plex Serif** does all the work — document body, headings, display, and every chrome label from the file tree to the status line. Plex Serif is a contemporary slab-influenced serif with a high x-height, open apertures, and unusually clean small-size legibility for a serif; that last property is what makes it survive at 0.75rem in chrome where a more traditional book serif would smear. The serif throughout gives the entire app one editorial voice: the chrome reads like marginalia in the same hand as the document, not like a different application wrapping a manuscript. **IBM Plex Mono** carries code blocks and inline code — it is the same family, so the visual handoff between prose and code feels like a tone shift rather than a context switch.

The scale has two parallel ladders, both in Plex Serif. The document ladder runs `display` → `h1` → `h2` → `h3` → `body`, with `body` set at 1.125rem / 1.7 leading for long-form readability and old-style figures (`'onum'`) enabled in body and display. The UI ladder runs `ui-base` → `ui-small` → `caption`, all at 500 (Medium) weight by default — heavier than a typical body weight because Plex Serif at small sizes (0.875rem and below) benefits from a touch more stem to hold the chrome labels confidently. Italics live in the editor only — never in chrome, never in buttons. Display sizes get a small negative tracking (`-0.01em`); body sizes use natural tracking; captions use a hint of positive tracking (`0.01em`) so tiny serifs at 0.75rem keep their counters open.

## Layout

Skribe is a three-region desktop window: file tree on the left (`chrome`), document column in the middle (`surface`), and the AI input bar pinned to the bottom of the document column (`chrome`). The document column has a soft max-width around 720–760px so a full line of body text holds at roughly 65–75 characters — the editorial sweet spot — with margin air on both sides at wider window widths. The file tree is resizable between 200 and 360px; default 240px.

The spacing scale is rem-based and ramps deliberately: `1` (4px), `2` (8px), `3` (12px), `4` (16px), `5` (20px), `6` (24px), `8` (32px), `10` (40px), `12` (48px), `16` (64px), `20` (80px), `24` (96px). Inside the document, vertical rhythm is generous — paragraphs separated by `space-6`, sections by `space-12`, top of the page padded by `space-16` so the first line is not glued to the chrome. Chrome elements use the lower half of the scale (`space-2` to `space-4`) to feel compact and quiet. Density philosophy: comfortable inside the document, snug inside chrome. The two registers are intentionally different — the document breathes; the chrome stays out of the way.

## Elevation & Depth

Skribe is essentially flat. Hierarchy is built from a one-step surface tonal contrast (cream document on slightly darker cream chrome) and 1px hairline dividers (`hairline` `#E4DFD4`) — never strokes thicker than 1px. There are no card stacks, no resting shadows, no glassmorphism.

The single sanctioned shadow is `shadow-modal` — `0 4px 24px rgba(42, 42, 42, 0.08)` — applied only to truly floating surfaces: modals, the clarification popup over the AI bar, the contextual block-type toolbar, and the inline annotation popover. These pieces float because they are transient; permanent surfaces never lift. The modal backdrop is `rgba(42, 42, 42, 0.4)` with `backdrop-filter: blur(2px)` to drop the document back without darkening it dramatically. Focus states use a 2px outline in `primary` with a 2px offset, never a glow.

## Shapes

The corner-radius philosophy is lightly rounded with intent. The `rounded` scale is small: `sm` 4px, `md` 6px, `lg` 8px, `pill` 999px. Buttons, inputs, file-tree items, contextual toolbars, and tooltips use 4–6px — soft enough to feel modern, sharp enough to respect the editorial type. Modals, the clarification popup, and any larger floating surface use 8px to read as a separate plane. The AI input bar, the status line, and hairline dividers are explicitly square (0px) — they're chrome edges, not pills. `pill` is reserved for any future status chip; it is not used in the MVP.

Avoid using radius to express decoration. Skribe never uses fully rounded "candy" shapes for cards or buttons; that visual language belongs to a different product family.

## Components

Components are quiet by default and lean on tonal contrast rather than weight or color. `button-primary` is a `primary`-on-`on-primary` rectangle with a 6px radius; its hover state nudges the background a touch darker (`#162132`) without changing the silhouette. `button-secondary` is text-only on `chrome` — no border, no fill in the resting state — and `button-link` is `primary` text that underlines on hover. Disabled states drop to 40% opacity and lose hover feedback. Focus is a 2px `primary` outline with a 2px offset for every interactive surface.

`input` is a 1px `hairline` border on `surface`; on focus the border becomes `primary` with no glow. `modal` is centered `surface` with the modal shadow and 8px radius; `tooltip` inverts to `primary` background with `on-primary` text and reads in the caption type. `file-tree-item` is 32px tall with `ui-small` text; the active state sits on `chrome` with a `primary` text tint, the hover state sits on `chrome` only, and the dirty indicator is a 6px `accent` dot, right-aligned. `ai-input-bar` is a full-width `chrome` strip with a 1px top hairline; while streaming, a thin `primary` line pulses along the top edge — the only animation in the chrome. `clarification-popup` floats above the AI bar with a small downward arrow.

`block-context-toolbar` and `inline-annotation-popover` are the two small floating chips lifted directly from the reference image — the former offers block-type switches (Heading, Quote, Link, List, Breakout Paragraph) when a block is selected; the latter offers inline transforms (Synonym, Transcriber, Translator, Decipherer) when a word or phrase is selected. Both render in the `caption` style (IBM Plex Serif at 0.75rem, Medium), on `surface` with the modal shadow and a 6px radius, separated by 1px hairlines between each pill. `selection-highlight` paints the soft `highlight` tone behind selected runs of body text — the same warm cream tint visible on the selected paragraphs in the reference. `status-line` is a 24px-tall `chrome` strip with `caption` text in `on-chrome-muted`; `word-count` lives at the bottom-right corner of the document column and uses the same caption style.

## Do's and Don'ts

**Do** keep the document column the visual hero — every chrome decision should make the document feel quieter, not the chrome louder. **Do** use 1px hairlines and tonal surface shifts for hierarchy before reaching for any other affordance. **Do** set body text in IBM Plex Serif at 1.125rem / 1.7 leading with old-style figures, and keep the line measure between 65 and 75 characters. **Do** restrict `primary` (deep ink) to genuinely primary moments — primary buttons, focus, the streaming indicator, the active file — so its presence still means something. **Do** let the soft cream `highlight` tone carry the "selected block" feeling in the reading surface; it's gentler than a colored band. **Do** keep transitions short (150ms) and quietly cubic-bezier; nothing in this product should bounce.

**Don't** introduce a pure-white surface anywhere in the editor or chrome — it breaks the paper metaphor instantly. **Don't** add resting shadows, gradients, or borders thicker than 1px to permanent UI; reserve `shadow-modal` for transient floating surfaces only. **Don't** introduce a second typeface — no Inter, no system sans, no display face. Hierarchy comes from size, weight, color, and italic within IBM Plex Serif; mixing in a sans breaks the single-voice premise. **Don't** decorate buttons or chips with full-pill radii, color-blocked badges, or icon-stuffed clusters; the toolbar in the reference image is a ceiling, not a floor. **Don't** layer surfaces three deep — Skribe lives at two surface levels (`chrome` and `surface`) plus floating elements; a third tier is a smell. **Don't** let `accent` (warm amber) creep beyond notification semantics; it is not a brand color and should never appear in a button or heading.