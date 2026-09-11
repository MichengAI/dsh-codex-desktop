# Changelog

[简体中文](CHANGELOG.zh-CN.md)

The five most recent published versions are listed below.

## 1.0.52 — 2026-09-11

- Upgrade bundled DSH to `0.1.5-rc.2` and update 14 bundled plugins; the plugin market remains on the latest `1.45.1`.
- Adapt to the new DSH startup entry so the desktop app can launch the workspace correctly.
- The new DSH uses the Session V3 format. Back up important conversations before upgrading; conversations written by the new version cannot be read directly by older versions.

## 1.0.51 — 2026-09-09

This update brings a desktop pet and a Git commit graph, along with improvements to window appearance and startup reliability.

- **New desktop pet**: Choose a pet in pet settings and turn on visibility to bring it onto your desktop. Drag it into place, view notifications from multiple conversations, and respond to tool approvals and questions directly.
- **New Git commit graph**: Git Graph is now included, so you can visually explore commit history and branch relationships without installing it separately.
- **More reliable pet display**: Improve recovery after hiding, closing, or an unexpected exit to reduce cases where the pet disappears. Answers are checked against the current questions and options to help prevent actions on changed requests.
- **Updated Windows appearance**: Windows 11 22H2 and later support Mica backgrounds that follow the light or dark theme. Older systems continue to use solid backgrounds.
- **More reliable startup**: Fix page loading failures and HTTP 431 errors that could occur after repeated launches.
- **Updated bundled plugins**: Update 11 plugins covering the workspace UI, experts, skills, archives, IM assistant, scheduled tasks, context, sidebar, MCP connections, usage statistics, and plugin market. The desktop pet and Git Graph are both included in the installer.
- **New feature previews**: Add 14 screenshots to the project README showing the home page, conversations, and plugin settings.

Release tag: [v1.0.51](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.51).

## 1.0.50 — 2026-09-08

- Update bundled plugins to Codex UI 0.2.112, IM Connect 0.1.38, Automation 0.1.34, Skills Manager 0.1.43, Archive Manager 0.1.32, Agency Agents 0.1.34, BTW 0.1.4, `dsh-context` 0.46.0, MCP Connector 0.2.39, Usage Billing 1.0.42, and `dshmarket` 1.45.0. DSH Better Sidebar and Simplify remain at their current latest versions.
- Exclude subagent sessions from taskbar unread counts in both Codex UI unread records and fallback completion tracking, including existing unread entries and sessions whose origin becomes available later.

Release tag: [`v1.0.50`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.50).

## 1.0.49 — 2026-09-07

- Clean legacy bridge dependency declarations and package files before seeding plugins on startup, including files left by earlier migrations. File cleanup failures emit a warning and are retried on the next launch without blocking startup; the private dynamically injected bridge remains available.
- Repair bundled plugins listed only in an existing profile's bundle list instead of skipping installation and then removing their entries. Seeding now checks installation declarations in `dependencies`.
- Read pnpm 11 JSON state stored in `.modules.yaml` and preserve the original store when retrying an offline installation online, preventing `ERR_PNPM_UNEXPECTED_STORE`.
- Use the pnpm 11 offline environment setting in smoke tests and verify plugin files, dependency declarations, and bundle activation together.

Release tag: [`v1.0.49`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.49).

## 1.0.48 — 2026-09-07

- Inject the desktop bridge from the application's private directory when Desktop starts DSH. Standalone `dsh web` now uses Web plugin management, and legacy bridge configuration is migrated out of the shared profile with a backup.
- Validate Desktop environment and pnpm availability before exposing bridge services, and keep read-only pnpm queries from modifying the profile.
- Synchronize the Windows taskbar badge with Codex UI's unread records so reading a task clears the same state shown in the task list.
- Respect the updater's availability decision so older or currently ineligible releases are not offered as new updates or downloaded automatically.
- Include pnpm package metadata in the offline bundle so first launch works with an empty user cache. Preserve the initial offline installation error and timeout output for diagnosis.
- Bundle Usage Billing 1.0.31, BTW 0.1.3, and Simplify 0.1.2, bringing the bundled plugin catalog to 13 entries.
- Update Codex UI to 0.2.106, Automation to 0.1.32, `dsh-context` to 0.44.0, and MCP Connector to 0.2.37. Other bundled plugin versions remain unchanged.

Release tag: [`v1.0.48`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.48).
