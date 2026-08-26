# Changelog

[简体中文](CHANGELOG.zh-CN.md)

The five most recent published versions are listed below.

## 1.0.34 — 2026-08-26

- Added `dsh-mcp-connector` 0.2.21 to the bundled offline catalog for OAuth, API-key, HTTP, stdio, and JSON-based MCP connection management.
- Added a dedicated Updates settings page with automatic check-and-notify, automatic download with install confirmation, and manual-only policies.
- Added a delayed, non-blocking startup update check for packaged builds. New versions notify in the background, while installation and restart always require an explicit user action.
- Updated Codex UI to 0.2.88 and refreshed compatible development dependencies.
- Aligned community-store assembly with the Web profile's isolated official-runtime model so prerelease DSH peers are not duplicated into the plugin profile.

Release tag: [`v1.0.34`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.34).

## 1.0.33 — 2026-08-26

- Added a product preview showing `dsh-context` context management alongside the DSH Better Sidebar file explorer.
- Retried transient Windows file replacement failures so profile updates are not interrupted by short-lived file locks.

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
