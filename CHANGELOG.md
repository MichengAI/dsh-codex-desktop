# Changelog

[简体中文](CHANGELOG.zh-CN.md)

The five most recent published versions are listed below.

## 1.0.81 — 2026-10-07

**Host and bundled plugins**

- Bundled plugins are upgraded to their current latest versions: Codex UI 1.1.30, IM Connect 0.1.66, Automation 0.1.58, Skills Manager 1.1.13, Archive Manager 1.0.15, Agency Agents 1.0.11, Codex Pet 0.1.15, BTW 0.1.17, Code Review 0.1.12, and PUA 0.3.24. Simplify 0.1.14, Better Sidebar 0.24.1, dshmarket 1.66.9, and official DSH 0.2.0-rc.2 were already the latest versions and are unchanged. The packaged build stages these exact versions.
- If you are upgrading from a version before 1.0.77, new installs still omit the Context and Usage Billing plugins. The desktop pet follows the cursor while idle. Upgrades from older versions can install the bundled plugins offline and keep your existing plugin configuration. A Windows install no longer lacks bundled plugin dependencies the first time it starts. Installers on the affected platforms start normally.

## 1.0.80 — 2026-10-06

**Host and bundled plugins**

- The DSH page now exposes the official `dshDesktop` marker, so Desktop shows the official account sign-in control at the bottom of the sidebar. Sign-in still uses the official account service; this shell does not store credentials.
- When sign-in is waiting for the browser, Desktop opens the official DeepSeek authorize page. The same page is not opened again until that attempt ends, the browser fails to open, or ten minutes pass.
- A completed sign-in that opens `dsh://open` returns to this desktop instead of the installed official DeepSeek Harness.
- Menu surfaces in the desktop window are more opaque, so sidebar text no longer shows through the account menu.
- Bundled plugins are upgraded to their current latest versions: Codex UI 1.1.29, IM Connect 0.1.64, Automation 0.1.54, Skills Manager 1.1.10, Archive Manager 1.0.13, Agency Agents 1.0.9, Codex Pet 0.1.13, BTW 0.1.16, Simplify 0.1.14, Code Review 0.1.11, PUA 0.3.23, and dshmarket 1.66.9. Better Sidebar 0.24.1 and official DSH 0.2.0-rc.2 were already the latest versions and are unchanged. The packaged build stages these exact versions.

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



