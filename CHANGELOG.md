# Changelog

[简体中文](CHANGELOG.zh-CN.md)

The five most recent published versions are listed below.

## 1.0.63 — 2026-09-16

- Update the bundled official DSH runtime from 0.1.5-rc.2 to 0.1.6-alpha.1, including the matching scope, timeout, and invariants launch peers.
- Refresh 15 bundled plugins to current npm latest: Codex UI 1.1.11, IM Connect 0.1.50, Automation 0.1.44, Skills Manager 0.1.52, Archive Manager 0.1.43, Agency Agents 0.1.43, Codex Pet 0.1.6, BTW 0.1.8, Simplify 0.1.5, Code Review 0.1.2, PUA 0.3.13, Context 0.53.0, MCP Connector 0.2.49, Usage Billing 1.4.0, and dshmarket 1.47.0. Better Sidebar was already latest.

## 1.0.62 — 2026-09-15

- Fix first launch on an intranet when the shared Web profile already has a `node_modules` folder but no recorded pnpm store. Desktop now uses the bundled offline plugin store instead of contacting the npm registry, so experts, plugins, and skills can install without a network.
- Give cold starts more time: DSH now waits up to 120 seconds for the process to become ready (was 45) and up to 90 seconds for the workbench to finish loading plugins (was 30). A slow first launch no longer replaces the workbench with an error screen. If the page is still blank after another 90 seconds, the failure window returns with the log path. If the workbench becomes healthy during that wait, Desktop returns to it automatically. Help → Open Recovery Page is available once a profile exists.
- `pack` and `dist` now delete leftover runtime folders and extra `release-*` directories first, so a stale bundled plugin store cannot be reused.
- Skip empty pending-update, desktop-bridge, and bundle-reconcile scans on a normal launch.
- Startup no longer auto-repairs community plugins that are listed in the profile but missing on disk. Those installs follow the client pending list. Bundled plugins are still seeded as before.

## 1.0.61 — 2026-09-14

- Fix offline upgrades from older install folders (for example 1.0.41) failing when the bundled plugin store lacks full package metadata. Startup no longer reports an incomplete built-in plugin update and then contacts the npm registry. The new build can finish bundled plugin updates without a network.

## 1.0.60 — 2026-09-14

- Update bundled Codex UI, IM Connect, automation, archive manager, Context, and MCP Connector plugins and their offline dependencies.
- Update the desktop runtime to Electron 44.3.0 and Node.js 24.21.0, and the bundled package manager to pnpm 11.26.0. DSH remains on 0.1.5-rc.2.

## 1.0.59 — 2026-09-14

- Fix plugin installation and updates failing when older profiles lack build permissions for `node-pty` or `protobufjs`. Startup after upgrading adds the required permissions and completes previously blocked builds for bundled dependencies, without deleting user configuration.

