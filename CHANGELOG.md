# Changelog

[简体中文](CHANGELOG.zh-CN.md)

The five most recent published versions are listed below.

## 1.0.29 — 2026-08-25

- Ad-hoc signed the complete macOS app for both Apple Silicon and Intel builds when no Developer ID certificate is configured.
- Added strict whole-bundle signature verification before uploading macOS artifacts, preventing another DMG or ZIP that macOS reports as damaged.
- Scoped the loose installation-directory icon to Windows so an unrelated ICO can no longer enter the macOS app bundle and block signing.
- Preserved the future Developer ID signing path so configured release certificates replace the ad-hoc fallback automatically.

Release tag: [`v1.0.29`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.29).

## 1.0.26 — 2026-08-24

- Added a Codex-style desktop shell with back/forward navigation and File, Edit, View, and Help menus.
- Added new chat, open folder, chat traversal, keyboard shortcuts, zoom, fullscreen, reload, and tray controls.
- Expanded the About window and aligned product wording across desktop menus, the tray, and Help.
- Fixed incorrect workspace selection after opening a folder, overbroad Find actions, client-bridge fallback failures, and navigation races.
- Hardened IPC permissions between renderer windows and fixed the macOS traffic-light safe area and first-frame layout.

Release tag: [`v1.0.26`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.26).

## 1.0.25 — 2026-08-23

- Enlarged tray and taskbar icons for clearer system-shell presentation.

Release tag: [`v1.0.25`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.25).

## 1.0.24 — 2026-08-23

- Preserved line endings while patching the bundled runtime.
- Localized the rc.2 permission interface in the Desktop runtime.

Release tag: [`v1.0.24`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.24).

## 1.0.23 — 2026-08-22

- Skipped Desktop reloads when a plugin update resolves to an older or unchanged version.

Release tag: [`v1.0.23`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.23).
