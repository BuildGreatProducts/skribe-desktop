# Skribe

Skribe is a Mac-native markdown writing app for people who build with AI. Open a local folder, write in a quiet Notion-style editor, and ask Claude Code to rewrite the active document with the rest of the folder as context.

## What It Does

- Opens a local folder and lists `.md` / `.markdown` files.
- Edits markdown through a Tiptap WYSIWYG editor while keeping plain markdown on disk.
- Auto-saves atomically after a short debounce.
- Runs a Claude Code sidecar from the open folder and streams AI edits into the editor.
- Stores settings locally in `~/Library/Application Support/Skribe/settings.json`.

## Build From Source

Requirements:

- macOS with Xcode Command Line Tools
- Rust stable
- Node.js 20+
- Claude Code installed for AI features

```bash
npm install
npm run sidecar:prepare
npm run tauri dev
```

For a production `.app` bundle:

```bash
npm run tauri build
```

The local build target is `Skribe.app`. **Do not distribute that build to others** — macOS will show “damaged and can’t be opened.” Use a signed, notarized DMG from GitHub Releases instead. Setup: [docs/release-signing.md](docs/release-signing.md).

## Verification

```bash
npm run typecheck
npm run lint
npm test
cd src-tauri && cargo test && cargo clippy -- -D warnings
npm run tauri build
```

## License

MIT. See [LICENSE](LICENSE).
