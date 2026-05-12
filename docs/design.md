---
version: alpha
name: Skribe
description: Current design system for a Mac-native markdown writing app where Claude Code edits local documents in real time.
source_of_truth:
  tokens: src/styles/tokens.css
  tailwind: tailwind.config.ts
  app_shell: src/components/chrome/AppShell.tsx
  editor: src/components/editor/Editor.tsx
  ai_composer: src/components/ai/AIInputBar.tsx
---

# Skribe Design System

## Overview

Skribe is a Mac-native markdown writing app for people who build with AI. The app opens a local folder, shows markdown documents in a compact file tree, presents a warm paper-like writing surface, and keeps a Claude Code composer floating near the bottom of the document. The design should feel calm, literary, and capable: a writing room with useful instruments nearby.

The current product is still paper-and-ink at its core, but the implementation has evolved from the original fully flat system. Permanent chrome remains quiet and warm. The editor remains the visual hero. Floating AI surfaces are allowed to feel more tactile: white, rounded, lightly shadowed, and closer to a modern command composer than a status strip. Treat that as an intentional exception, not a license to make every surface glossy.

Use the runtime tokens in `src/styles/tokens.css` as the source of truth. Tailwind aliases in `tailwind.config.ts` mirror those CSS variables.

## Color Tokens

```yaml
paper: "#FAF7F2"
ink: "#2A2A2A"
ink-soft: "#5A5A5A"
chrome-bg: "#F2EEE6"
chrome-text: "#3D3D3D"
chrome-text-soft: "#7A7A7A"
hairline: "#E4DFD4"
accent: "#1E2A3A"
accent-deep-green: "#2D5F4A"
accent-warm: "#B8732A"
selection: "#D6E4D8"
highlight: "#EFE8D8"
overlay: "#2A2A2A66"
success: "#2D5F4A"
warning: "#8B5A1E"
error: "#8B2D2A"
ai-surface: "#FFFFFF"
ai-reference-bg: "#E8F3FF"
ai-reference-text: "#1F5D88"
ai-reference-hover: "#CFE8FF"
ai-reference-ring: "#7DBDEB"
submit: "#000000"
submit-hover: "#1F1F1F"
```

`paper` is the document and app background. `chrome-bg` is the left navigation and preflight banner. `ink`, `ink-soft`, `chrome-text`, and `chrome-text-soft` define the text hierarchy. `hairline` is the default divider and border color.

`accent` defaults to deep ink and drives primary buttons, focus, active document state, links, drag rings, spinners, and important controls. The settings modal can switch it to deep green by setting `:root[data-accent='deep-green']`. Always use the `accent` token for interactive color unless a component intentionally needs a fixed semantic color.

`accent-warm` is reserved for unsaved-file dots. `selection` is browser text selection and the selected-text chip in the AI composer. `highlight` is the hover/active wash used in the file tree, inline code background, attachment chips, and quiet badges. Semantic colors are intentionally aged so they sit inside the editorial palette.

The current app also uses a small set of non-tokenized AI colors: pure white surfaces for the floating composer, stream preview, and mention menu; black for the circular submit button; and a pale blue pair for document reference chips. Keep these localized to AI reference/composer UI until they are promoted to formal tokens.

## Typography

```yaml
font-editor: "IBM Plex Serif, Iowan Old Style, Georgia, serif"
font-ui: "IBM Plex Serif, Iowan Old Style, Georgia, serif"
font-mono: "IBM Plex Mono, SF Mono, Menlo, monospace"

text-xs: 0.75rem
text-sm: 0.875rem
text-base: 1rem
text-doc: 1.125rem
text-doc-h3: 1.375rem
text-doc-h2: 1.625rem
text-doc-h1: 2.125rem
text-display: 3rem

leading-tight: 1.25
leading-normal: 1.5
leading-relaxed: 1.7
```

IBM Plex Serif is used for both the editor and the UI. IBM Plex Mono is used for inline code and code blocks. The app imports Plex Serif weights 400, 400 italic, 500, 600, 700 and Plex Mono weights 400 and 600 from `@fontsource`.

The global body enables `kern`, `liga`, and `onum`. Letter spacing is normally `0`; do not bring back the old negative display tracking. Small uppercase labels may add positive tracking when needed, as the empty-state recent-folder label currently does.

The editor default is 18px text with 1.7 line height, but users can choose 14, 16, 18, or 20px and line heights 1.5, 1.7, or 1.9. Design work should tolerate all of those settings without text overlap.

## Spacing, Radius, Motion

```yaml
space-0-5: 0.125rem
space-1: 0.25rem
space-2: 0.5rem
space-3: 0.75rem
space-4: 1rem
space-5: 1.25rem
space-6: 1.5rem
space-8: 2rem
space-10: 2.5rem
space-12: 3rem
space-16: 4rem
space-20: 5rem
space-24: 6rem

radius-sm: 4px
radius: 6px
radius-md: 6px
radius-lg: 8px
radius-pill: 999px

shadow-modal: "0 4px 24px rgb(42 42 42 / 8%)"
transition: "150ms cubic-bezier(0.4, 0, 0.2, 1)"
```

Most permanent chrome uses 0-8px radii and 1px hairlines. The explicit pill exception is the AI composer family: collapsed AI launcher, expanded prompt surface, icon buttons, selected-text chips, toggles, and submit/cancel circles.

The app uses transitions sparingly. Sidebar width and opacity animate over 200ms. AI prompt expansion animates width/max-width over 200ms. Stream preview dismisses with transform/opacity over 220ms. Global reduced-motion support forces animations and transitions down to 1ms.

## Layout

Skribe has two primary modes:

- Empty state: centered paper surface with logo, `Skribe` display wordmark, tagline, primary open-folder action, and recent folders.
- Project state: optional preflight banner, left file navigation, central editor, floating AI composer, settings/project-instructions modals.

The app root is `paper` with `ink` text. The sidebar is `chrome-bg`, bordered on the right with a 1px `hairline`, and resizes between 200px and 360px with a 240px default. It can collapse to 0px while keeping floating top controls available.

The editor column sits on `paper`. The ProseMirror document is centered at `max-width: 44rem`, uses `px-8`, `pt-16`, and `pb-40` so content stays clear of the floating AI composer. The toolbar is sticky at the top, also constrained to 44rem internally.

The AI composer is absolutely positioned at `bottom: 2rem`, centered, and capped at 44rem. It collapses to a 48px logo button and expands into a white rounded composer.

The status line is no longer a bottom strip. It is a zero-height sticky overlay below the toolbar, with document stats and save status aligned to the upper-right of the editor viewport.

## Elevation And Depth

Skribe is mostly flat, but not completely flat anymore.

Flat surfaces:

- App background and editor document.
- Sidebar and preflight banner.
- Editor toolbar.
- Settings tab panels.
- Permanent text and file tree regions.

Lifted surfaces:

- Modals and confirmation dialogs use `shadow-modal`.
- File and folder context menus use paper, hairline border, 6px radius, and `shadow-modal`.
- Clarification popup uses paper, 8px radius, arrow, and `shadow-modal`.
- The AI composer uses a stronger custom shadow: `0 10px 30px rgb(42 42 42 / 12%)`.
- The AI mention menu uses `0 16px 40px rgb(42 42 42 / 16%)`.
- File preview thumbnails use a small resting shadow: `0 1px 2px rgb(42 42 42 / 8%)`.
- The stream preview uses translucent white, `shadow-modal`, and `backdrop-blur-xl`.

Do not add new shadows to large permanent page regions. Shadows should identify a floating control, a transient menu, the AI composer, or a tiny document thumbnail.

## Components

### App Shell

The shell is a full-height flex column on `paper`. The optional preflight banner is `min-height: 3rem`, `chrome-bg`, `chrome-text`, with a bottom hairline and compact link buttons. Top chrome controls use Phosphor icons inside 32px transparent buttons with `chrome-text-soft` resting color and `ink` hover color.

The sidebar reserves a 48px top row for drag space and create actions. Icon controls do not use filled backgrounds in the resting state.

### Empty State

The empty state is centered on `paper` with a 480px max width. It shows `/logo.png` at 9rem tall, then the `Skribe` wordmark in `text-display`, Plex Serif, medium weight, zero tracking, and `ink`. The tagline is `text-base` in `chrome-text-soft`. Recent folders render as small text rows with `rounded-sm`, `px-2`, `py-2`, and `chrome-bg` hover.

### Buttons

Base button:

- `inline-flex`, 36px height, centered content, 8px gap.
- 6px radius.
- `px-4`, `text-sm`, medium weight.
- Disabled controls drop to 40% opacity and disable pointer events.

Variants:

- Primary: `accent` background, `paper` text, hover `#162132`.
- Secondary: transparent background, `px-3`, `chrome-text`, hover `paper/50`.
- Link: auto height, no radius, no horizontal padding, `accent` text, underline on hover.
- Danger: `error` background, `paper` text, slight brightness reduction on hover.

Special icon buttons in the shell override secondary styling to be 32px square, transparent, borderless, shadowless, and icon-only.

### Inputs, Selects, Textareas

Inputs are 36px tall, full width by default, 6px radius, 1px `hairline` border, `paper` background, `ink` text, and `chrome-text-soft` placeholder. Focus changes the border to `accent` with no glow. Selects match the same border, radius, and paper fill, using `text-sm`. Textareas in settings and project instructions use the same visual language with relaxed line height.

### Modals

The modal backdrop is `#2A2A2A66` with `backdrop-blur-[2px]` and 24px viewport padding. Default modal panels are `paper`, `ink`, 8px radius, 24px padding, `shadow-modal`, and 480px max width. Settings increases to 560px; delete confirmation reduces to 360px.

Modal titles use `text-doc-h3`, semibold, tight leading. The close control is an icon-only secondary button.

### Tooltips

Tooltips appear after 500ms hover. They use `accent` background, `paper` text, `text-xs`, 4px radius, `px-3`, `py-2`, `shadow-modal`, and nowrap layout. They currently support top and bottom placement.

### Toggles

Toggles are full-width rows with `py-2`, `text-sm`, and `ink` text. The switch is 44px by 24px, pill-shaped, with a 1px hairline border. Checked state fills with `accent`; unchecked state fills with `chrome-bg`. The knob is 16px, pill-shaped, and `paper`.

### Settings

Settings lives inside the modal system. Tabs are a four-column tablist with a bottom hairline. Active tabs use a 2px `accent` bottom border, semibold `ink`, and near-full opacity. Inactive tabs use `chrome-text`, medium weight, 65% opacity, and hover toward `ink`.

Panels are not carded. They occupy the same grid cell and hide inactive panels with `invisible` and disabled pointer events. The Claude Code status panel is the one intentionally framed section: `chrome-bg`, hairline border, 6px radius, 12px padding.

### File Tree

The file tree is virtualized and scrolls inside the sidebar with `px-2` and `py-2`.

Folder rows:

- 36px row height.
- 32px internal button.
- `text-xs`, semibold, `chrome-text-soft`.
- Hover uses `highlight` and `chrome-text`.
- Expanded folders shift text to `chrome-text`.
- File counts render in tiny paper pills with hairline borders.

File rows:

- 64px height.
- `rounded-sm`, `px-2`, `py-2`, `text-sm`.
- Hover uses `highlight`.
- Active state uses `highlight`, `accent` title text, and `accent/75` folder label.
- Unsaved state is a 6px `accent-warm` dot at the lower-right.
- Actions menu is hidden until hover and opens as a paper popover with hairline border, 6px radius, and `shadow-modal`.

Each file row includes a 40px by 48px document preview thumbnail. The thumbnail uses `paper`, a hairline or `accent/30` border, 2px radius, and a small document-like shadow. While AI is running on that file, the thumbnail becomes an accent spinner.

### Editor

The editor scroll container owns the user-configurable font size and line height. ProseMirror itself is centered, maxed at 44rem, and uses `font-editor`, `text-doc`, and `ink`.

Editor text rules:

- Paragraphs: no top margin, `space-6` bottom margin.
- Headings: `space-12` top margin, `space-4` bottom margin, `ink`, zero letter spacing.
- H1: `text-doc-h1`, 1.25 line height.
- H2: `text-doc-h2`, 1.3 line height.
- H3: `text-doc-h3`, 1.35 line height.
- Lists: `space-6` left padding and bottom margin.
- Blockquotes: 1px `hairline` left border, `ink-soft`, `space-8` vertical margin, `space-4` left padding.
- Inline code: `highlight` background, 4px radius, Plex Mono, `0.9em`, compact horizontal padding.
- Code blocks: `chrome-bg`, hairline border, 8px radius, Plex Mono, 0.9375rem, 1.6 line height, `space-4` padding.
- Links: `accent`, underline, 0.15em underline offset.
- Empty placeholder: `chrome-text-soft`.

The formatting toolbar is sticky at the top on `paper` with a bottom hairline. Its controls are text buttons, `text-base`, `chrome-text-soft`, 32px tall, 4px radius, and spaced with a 20px gap. Active controls become semibold `ink`. Disabled controls drop to 40% opacity.

### Status Overlay

The status overlay appears only when enabled in settings. It is sticky below the toolbar (`top: 57px`) with zero layout height. The actual text block is absolutely positioned at the upper-right with `text-xs`, normal leading, `chrome-text-soft`, right alignment, and pointer events disabled. It can show word count plus reading time, character count, reading level, and save status.

### AI Composer

The AI composer is the most tactile part of the app.

Collapsed state:

- 48px circular logo button.
- White background, hairline border, 12% large shadow.
- 8px padding.
- Slight scale on hover.

Expanded state:

- Centered, `max-width: 44rem`, minimum height 48px.
- White background, 24px pill radius, 1px ring.
- Ring is `hairline` at rest and `accent` while dragging files over it.
- 4px padding with 48px reserved on the right for submit/cancel.
- Large 12% shadow.
- Wraps controls when content, chips, or attachments need more space.

Controls:

- Attach button is a 40px circular icon button.
- Prompt editor is a contenteditable region with `text-base`, normal leading, `ink`, and `chrome-text-soft` empty state.
- Submit is a 40px black circular button with white paper-plane icon; hover is `#1F1F1F`.
- Streaming cancel is a 40px circular secondary button on `paper/50`.
- Error messages sit below the composer in `text-xs` `error`, with link buttons for recovery actions.

Chips:

- Selected text chip: 32px high, pill, `selection` background, `success` text.
- Attachment chip: 36px high, 6px radius, `highlight` background, semibold `ink`, thumbnail or file icon, small metadata in `ink-soft`.
- Document reference chip: 24px high, 6px radius, `#E8F3FF` background, `#1F5D88` text.
- Mention menu: white, 8px radius, hairline border, 16% large shadow; active option uses the same pale blue reference color.

### AI Stream Preview

The stream preview sits directly above the composer. It is capped at 34rem wide and 11rem tall, uses translucent white (`white/75`), `backdrop-blur-xl`, a top-only 8px radius, hairline border with no bottom border, 12px padding, and `shadow-modal`. While waiting for content, it type-animates status words and shows an accent caret. During streaming, it shows an accent spinner. Once complete, it exposes a circular dismiss button.

### Clarification Popup

Clarification prompts float above the composer. The popup is `paper`, `ink`, 8px radius, 16px padding, `shadow-modal`, max width 400px or viewport minus 48px, and includes a small rotated-paper arrow. Options are full-width rows with 6px radius, hairline border, and hover states that move toward `accent` and `chrome-bg`.

## Accessibility

Use semantic roles already present in the app: tree/treeitem for file navigation, toolbar for editor formatting, tablist/tab/tabpanel for settings, dialog for modals, switch for toggles, status/live regions for AI stream preview and save/status feedback.

Global `:focus-visible` is a 2px `accent` outline with 2px offset. Some AI controls use Tailwind focus rings instead; keep them visibly equivalent. Do not remove visible focus states.

Every icon-only button must keep an `aria-label`. Text must fit inside compact controls at every supported editor font size and common desktop window width.

## Do And Don't

Do keep the document column as the quiet center of gravity.

Do use `paper`, `ink`, `chrome-bg`, `hairline`, `highlight`, and `accent` tokens instead of ad hoc colors for normal app UI.

Do treat the white, pill-shaped, shadowed AI composer as a deliberate product signature.

Do keep file rows generous enough for previews: 64px for documents, 36px for folders.

Do use Phosphor icons for chrome and action buttons.

Do preserve the 44rem editor/composer measure and the editor bottom padding that keeps prose clear of the floating composer.

Don't describe or rebuild the AI bar as a full-width bottom strip; that is obsolete.

Don't reintroduce the unused block-context toolbar or inline annotation popover as if they already exist.

Don't make the status line a 24px chrome strip; it is currently a floating stats overlay.

Don't add broad new white surfaces outside the AI composer family without making a deliberate token/design decision.

Don't expand the pale blue reference-chip colors into general app accents.

Don't use negative letter spacing or heavy decorative gradients. The product should still feel editorial, even where the AI composer is more tactile.
