# Contributing

Thanks for helping make Skribe calmer, sharper, and more useful.

## Local Setup

```bash
npm install
npm run sidecar:prepare
npm run tauri dev
```

Run checks before opening a pull request:

```bash
npm run typecheck
npm run lint
npm test
cd src-tauri && cargo test && cargo clippy -- -D warnings
```

## Product Principles

- Local-first: markdown files on disk are the source of truth.
- No telemetry in the MVP.
- The editor should feel editorial, paper-like, and quiet.
- Use `docs/design.md` as the visual source of truth.
- Keep permanent surfaces flat; reserve shadows for transient popups and modals.

## Pull Requests

Keep changes scoped and include manual verification notes. For release work, do not commit Apple credentials, Tauri private keys, API tokens, or notarization output.