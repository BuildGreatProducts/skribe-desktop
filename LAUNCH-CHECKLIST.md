# Skribe Launch Checklist

## Pre-Release

- Confirm `npm run typecheck`, `npm run lint`, `npm test`, `cargo test`, and `cargo clippy -- -D warnings` pass.
- Confirm `npm run tauri build` creates `Skribe.app`.
- Replace the updater public key in `src-tauri/tauri.conf.json`.
- Configure `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` in CI.
- Configure Apple notarization secrets in CI.
- Run a real-folder AI test with Claude Code installed.
- Verify app launch, folder open, file CRUD, autosave, external edit handling, settings persistence, and AI cancel.

## Release

- Tag `v1.0.0`.
- Run the GitHub Actions release workflow.
- Download the produced artifact on a fresh Mac and verify Gatekeeper behavior.
- Publish the landing page and point the download CTA at the latest GitHub Release.

## Manual QA Script

1. Launch Skribe with no settings file.
2. Open a folder with at least three markdown files.
3. Edit a document and wait for autosave.
4. Create, rename, and delete a file.
5. Modify the active file externally and confirm reload behavior.
6. Ask Claude Code to rewrite the active document using sibling files for tone.
7. Cancel one long-running AI request.
8. Change editor settings and restart.
9. Run keyboard-only navigation through the file tree, editor, AI bar, and settings.
