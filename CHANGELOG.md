# Changelog

[简体中文](CHANGELOG.zh-CN.md)

The five most recent published versions are listed below.

## 1.0.61 — 2026-09-14

- Fix offline upgrades from older install folders (for example 1.0.41) failing when the bundled plugin store lacks full package metadata. Startup no longer reports an incomplete built-in plugin update and then contacts the npm registry. The new build can finish bundled plugin updates without a network.

## 1.0.60 — 2026-09-14

- Update bundled Codex UI, IM Connect, automation, archive manager, Context, and MCP Connector plugins and their offline dependencies.
- Update the desktop runtime to Electron 44.3.0 and Node.js 24.21.0, and the bundled package manager to pnpm 11.26.0. DSH remains on 0.1.5-rc.2.

## 1.0.59 — 2026-09-14

- Fix plugin installation and updates failing when older profiles lack build permissions for `node-pty` or `protobufjs`. Startup after upgrading adds the required permissions and completes previously blocked builds for bundled dependencies, without deleting user configuration.

## 1.0.58 — 2026-09-14

- Bundle Code Review and PUA for offline installation. PUA starts with its global switch off when no saved choice exists; enable it in Settings → Plugins → PUA Configuration. Existing saved choices are preserved.

- Update bundled Codex UI to 1.1.5 and refresh its offline dependencies.

## 1.0.56 — 2026-09-14

- Update 12 bundled plugins, including Codex UI, IM Connect, automation, skills, archive management, agents, desktop pet, BTW, context, MCP connector, usage billing, and the plugin market, together with their offline dependencies.
