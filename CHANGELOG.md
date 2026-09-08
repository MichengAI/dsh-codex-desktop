# Changelog

[简体中文](CHANGELOG.zh-CN.md)

The five most recent published versions are listed below.

## Unreleased

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

## 1.0.47 — 2026-09-06

- Plugin installation errors now remain separate from DSH startup: the desktop still attempts to load the workbench after a failed installation.
- Recovery identifies only plugins associated with the loading failure, including owners of broken dependencies. Unrelated plugins remain enabled, and candidates are shown before isolation is confirmed.
- Fixed noncritical plugin errors forcing a usable workbench into recovery. Failed plugins still produce diagnostic logs, and restored plugins must pass a complete health check before recovery backups are cleared.
- Retained recovery after a 30-second client loading timeout when recent plugin changes identify possible causes.
- Updated bundled plugins to Codex UI 0.2.103, Automation 0.1.31, Skills Manager 0.1.40, Archive Manager 0.1.30, Agency Agents 0.1.32, `dsh-context` 0.43.0, MCP Connector 0.2.35, and `dshmarket` 1.44.0. IM Connect remains at 0.1.34 and DSH Better Sidebar at 0.18.0.

Release tag: [`v1.0.47`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.47).

## 1.0.46 — 2026-09-04

- Fixed the Windows taskbar unread-completion badge so opening completed tasks clears them permanently; later session-list refreshes no longer count historical completed rows again.

Release tag: [`v1.0.46`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.46).
