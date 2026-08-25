# Changelog

[简体中文](CHANGELOG.zh-CN.md)

The five most recent published versions are listed below.

## 1.0.33 — 2026-08-26

- Added a product preview showing `dsh-context` context management alongside the DSH Better Sidebar file explorer.

Release tag: [`v1.0.33`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.33).

## 1.0.32 — 2026-08-26

- Added `dsh-context` 0.32.0 for context inspection and management, and `dsh-better-sidebar` 0.16.1 for an extensible workspace sidebar.
- Updated the bundled MichengAI products to Codex UI 0.2.87, IM Connect 0.1.24, Automation 0.1.18, Skills Manager 0.1.24, Archive Manager 0.1.14, and Agency Agents 0.1.21.
- Updated the bundled plugin market to `dshmarket` 1.29.2.
- Extended the offline first-launch catalog so new and existing desktop profiles receive the two ecosystem plugins through the normal self-healing seed path.

Release tag: [`v1.0.32`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.32).

## 1.0.31 — 2026-08-26

- Added Codex-style task notifications for completed work, approvals, and questions, with per-task taskbar badges and notification preferences.
- Added native inline replies that return text to the exact task that produced the notification, including reliable Windows Action Center and cold-start activation handling.
- Added the DSH Codex Desktop notification identity, compact source icon, task-aware titles, and localized Reply and Close actions.
- Added a dedicated Notifications settings page with a styled completion-notification menu and independent approval and question controls.
- Made the entire desktop shell follow the language selected inside DeepSeek Harness, covering menus, Settings, Keyboard Shortcuts, About, the tray, notifications, badges, and updater dialogs.
- Fixed completion notifications showing a task's earliest text instead of its latest assistant result.

Release tag: [`v1.0.31`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.31).

## 1.0.30 — 2026-08-25

- When no Developer ID certificate is configured, an after-pack hook now runs `codesign --force --deep --sign -` on the complete Apple Silicon and Intel app bundles.
- Added strict whole-bundle signature verification before uploading macOS artifacts, preventing another DMG or ZIP that macOS reports as damaged.
- Scoped the loose installation-directory icon to Windows so an unrelated ICO can no longer enter the macOS app bundle and block signing.
- Preserved the future Developer ID signing path so configured release certificates replace the ad-hoc fallback automatically.

Release tag: [`v1.0.30`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.30).

## 1.0.26 — 2026-08-24

- Added a Codex-style desktop shell with back/forward navigation and File, Edit, View, and Help menus.
- Added new chat, open folder, chat traversal, keyboard shortcuts, zoom, fullscreen, reload, and tray controls.
- Expanded the About window and aligned product wording across desktop menus, the tray, and Help.
- Fixed incorrect workspace selection after opening a folder, overbroad Find actions, client-bridge fallback failures, and navigation races.
- Hardened IPC permissions between renderer windows and fixed the macOS traffic-light safe area and first-frame layout.

Release tag: [`v1.0.26`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.26).
