# Changelog

[简体中文](CHANGELOG.zh-CN.md)

The five most recent published versions are listed below.

## 1.0.76 — 2026-09-25

**Host and bundled plugins**

- The bundled DSH runtime moves from 0.1.7-rc.1 to 0.1.7-rc.2, together with scope, timeout, invariants and the required launch dependencies.
- Bundled plugins are upgraded to their current latest versions: Codex UI 1.1.18, IM Connect 0.1.55, Automation 0.1.51, Skills Manager 1.1.4, Archive Manager 1.0.5, Agency Agents 1.0.5, Codex Pet 0.1.10, BTW 0.1.13, Simplify 0.1.10, Code Review 0.1.7, PUA 0.3.18, dshmarket 1.65.1. Better Sidebar 0.21.1 and MCP Connector 0.2.58 were already the latest versions and are unchanged.

## 1.0.75 — 2026-09-24

This is the first release after 1.0.66 and includes everything shipped since then.

**Host and bundled plugins**

- The bundled DSH runtime moves from 0.1.6-alpha.2 to 0.1.7-rc.1, together with scope, timeout, invariants and the required launch dependencies.
- All 14 bundled plugins are upgraded to their current latest versions: Codex UI 1.1.17, IM Connect 0.1.54, Automation 0.1.50, Skills Manager 1.1.3, Archive Manager 1.0.4, Agency Agents 1.0.3, Codex Pet 0.1.9, BTW 0.1.12, Simplify 0.1.9, Code Review 0.1.5, PUA 0.3.17, Better Sidebar 0.21.1, MCP Connector 0.2.58, dshmarket 1.64.0.
- New installs no longer bundle the Context and Usage Billing plugins.

**New**

- Desktop pet v2: the pet turns its head to follow the cursor while idle.

**Fixes**

- Upgrades from older versions no longer fail to install their bundled plugins, including offline upgrades; your existing plugin configuration is kept.
- Windows installs no longer lack bundled plugin dependencies the first time the app starts.
- Installers on some platforms no longer fail to start.

## 1.0.74 — 2026-09-24

- Improved the dependency check used when upgrading from an older version. This build still fails on Windows; use 1.0.75 instead.

## 1.0.73 — 2026-09-24

- Fixed a false "bundled plugin seeding failed" report when upgrading from an older version on Windows.

## 1.0.72 — 2026-09-24

- Fixed Windows installs that could lack bundled plugin dependencies the first time the app starts.
- First-launch failures now leave a log so they can be reported.

