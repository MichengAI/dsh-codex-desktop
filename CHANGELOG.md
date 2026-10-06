# Changelog

[简体中文](CHANGELOG.zh-CN.md)

The five most recent published versions are listed below.

## Unreleased

**Host and bundled plugins**

- The DSH page now exposes the official `dshDesktop` marker, so Desktop shows the official account sign-in control at the bottom of the sidebar. Sign-in still uses the official account service; this shell does not store credentials.
- Menu surfaces in the desktop window are more opaque, so sidebar text no longer shows through the account menu.
- Bundled plugins are upgraded to their current latest versions: Codex UI 1.1.29, IM Connect 0.1.64, Automation 0.1.54, Skills Manager 1.1.10, Archive Manager 1.0.13, Agency Agents 1.0.9, Codex Pet 0.1.13, BTW 0.1.16, Simplify 0.1.14, Code Review 0.1.11, PUA 0.3.23, and dshmarket 1.66.9. Better Sidebar 0.24.1 and official DSH 0.2.0-rc.2 were already the latest versions and are unchanged. These are catalog pins only; the offline plugin store has not been restaged.

## 1.0.79 — 2026-10-01

**Fixes**

- Turning on LAN access no longer makes Desktop report a startup timeout after two minutes. The window still opens only the local 127.0.0.1 address.

**Host and bundled plugins**

- Bundled plugins are upgraded to their current latest versions: IM Connect 0.1.60, Skills Manager 1.1.8, Archive Manager 1.0.10, Simplify 0.1.13, Code Review 0.1.10, PUA 0.3.22, dshmarket 1.66.7. Codex UI 1.1.25, Automation 0.1.53, Agency Agents 1.0.7, Codex Pet 0.1.12, BTW 0.1.15, and Better Sidebar 0.24.1 were already the latest versions and are unchanged.

## 1.0.78 — 2026-09-30

**Host and bundled plugins**

- The bundled DSH runtime moves from 0.2.0-rc.1 to 0.2.0-rc.2, together with scope, timeout, invariants and the required launch dependencies.
- Bundled plugins are upgraded to their current latest versions: Codex UI 1.1.25, IM Connect 0.1.58, Automation 0.1.53, Skills Manager 1.1.7, Archive Manager 1.0.9, Agency Agents 1.0.7, Codex Pet 0.1.12, BTW 0.1.15, Simplify 0.1.12, Code Review 0.1.9, PUA 0.3.21, dshmarket 1.66.6. Better Sidebar 0.24.1 was already the latest version and is unchanged.

## 1.0.77 — 2026-09-29

**Host and bundled plugins**

- The bundled DSH runtime moves from 0.1.7-rc.2 to 0.2.0-rc.1, together with scope, timeout, invariants and the required launch dependencies.
- Bundled plugins are upgraded to their current latest versions: Codex UI 1.1.22, IM Connect 0.1.57, Automation 0.1.52, Skills Manager 1.1.5, Archive Manager 1.0.7, Agency Agents 1.0.6, Codex Pet 0.1.11, BTW 0.1.14, Simplify 0.1.11, Code Review 0.1.8, PUA 0.3.19, Better Sidebar 0.24.1, dshmarket 1.66.5.
- New installs no longer include the MCP connector. A copy you already installed is kept.
- Official scheduling is now an optional bundle and stays off unless enabled in plugin management. Saved tasks are kept.

**Updates**

- A Windows zip build no longer downloads or runs an installer. It opens the matching zip; quit and replace the current folder. Do not run the installer, or it will install a second copy elsewhere.

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



