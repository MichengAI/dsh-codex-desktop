# Changelog

[简体中文](CHANGELOG.zh-CN.md)

The five most recent published versions are listed below.

## 1.0.88 — 2026-10-21

**Fixes**

- Plugin reload protection: When installing, updating, or removing plugins via the marketplace or settings, the desktop shell now waits for in-flight operations, writer locks, and post-install bundle calibrations to completely settle before reloading DSH, preventing premature restarts during longer installations from causing missing plugins or landing on the recovery page.
- Startup dependency protection: Preserves user-installed official plugin bundles and dependency declarations in the Web profile across cold starts and reloads, preventing startup routines from inadvertently removing installed packages.

**Host and bundled plugins**

- Bundled plugins are upgraded to their current latest versions: Codex UI 1.1.45, IM Connect 1.0.10, Automation 1.0.5, Skills Manager 1.2.8, Archive Manager 1.1.6, Agency Agents 1.2.8, Codex Pet 1.0.2, dshmarket 1.66.44, and Context 0.73.3. BTW 1.0.0, Simplify 1.0.1, Code Review 1.0.1, PUA 1.0.1, Better Sidebar 0.28.0, and official DSH 0.2.1-rc.2 were already the latest versions and remain unchanged. The packaged build stages these exact versions.
- New installs continue to bundle Context. Usage Billing and the MCP connector are still not bundled; a copy you already installed is kept. Official scheduling stays off unless you turn it on, and saved tasks are kept. The desktop pet follows the cursor while idle. Upgrades from older versions can install the bundled plugins offline and keep your existing plugin configuration. A Windows install no longer lacks bundled plugin dependencies the first time it starts. A Windows zip build opens the matching zip; quit and replace the current folder, and do not run the installer.

## 1.0.87 — 2026-10-18

**Host and bundled plugins**

- The bundled DSH runtime moves from 0.2.1-alpha.3 to 0.2.1-rc.2, together with group, scope, timeout and the required launch dependencies.
- Bundled plugins are upgraded to their current latest versions: Codex UI 1.1.42, IM Connect 1.0.1, Automation 1.0.0, Skills Manager 1.2.5, Archive Manager 1.1.0, Agency Agents 1.2.1, Codex Pet 1.0.1, BTW 1.0.0, Simplify 1.0.1, Code Review 1.0.1, PUA 1.0.1, Better Sidebar 0.28.0, dshmarket 1.66.37, and Context 0.73.0. The packaged build stages these exact versions.
- New installs continue to bundle Context. Usage Billing and the MCP connector are still not bundled; a copy you already installed is kept. Official scheduling stays off unless you turn it on, and saved tasks are kept. The desktop pet follows the cursor while idle. Upgrades from older versions can install the bundled plugins offline and keep your existing plugin configuration. A Windows install no longer lacks bundled plugin dependencies the first time it starts. A Windows zip build opens the matching zip; quit and replace the current folder, and do not run the installer.

## 1.0.86 — 2026-10-15

**Host and bundled plugins**

- The bundled DSH runtime moves from 0.2.1-alpha.2 to 0.2.1-alpha.3, together with scope, timeout and the required launch dependencies.
- Bundled plugins are upgraded to their current latest versions: Codex UI 1.1.40, IM Connect 0.1.77, Automation 0.1.66, Skills Manager 1.1.21, Archive Manager 1.0.19, Agency Agents 1.0.19, Codex Pet 0.1.19, BTW 0.1.24, Simplify 0.1.16, Code Review 0.1.16, PUA 0.3.28, dshmarket 1.66.22, and Context 0.72.0. Better Sidebar 0.26.0 was already the latest version and is unchanged. The packaged build stages these exact versions.
- New installs include Context again. Usage Billing and the MCP connector are still not bundled; a copy you already installed is kept. Official scheduling stays off unless you turn it on, and saved tasks are kept. The desktop pet follows the cursor while idle. Upgrades from older versions can install the bundled plugins offline and keep your existing plugin configuration. A Windows install no longer lacks bundled plugin dependencies the first time it starts. A Windows zip build opens the matching zip; quit and replace the current folder, and do not run the installer.

## 1.0.83 — 2026-10-14

**Host and bundled plugins**

- This is the first release after 1.0.81.
- The bundled DSH runtime moves from 0.2.0-rc.2 to 0.2.1-alpha.2, together with scope, timeout and the required launch dependencies.
- Bundled plugins are upgraded to their current latest versions: Codex UI 1.1.37, IM Connect 0.1.75, Automation 0.1.64, Skills Manager 1.1.19, Archive Manager 1.0.18, Agency Agents 1.0.18, Codex Pet 0.1.18, BTW 0.1.20, Simplify 0.1.15, Code Review 0.1.14, PUA 0.3.27, Better Sidebar 0.26.0, and dshmarket 1.66.21. The packaged build stages these exact versions.
- If you are upgrading from a version before 1.0.77, new installs still omit the Context plugin, Usage Billing plugin, and MCP connector. A copy you already installed is kept. Official scheduling stays off unless you turn it on, and saved tasks are kept. The desktop pet follows the cursor while idle. Upgrades from older versions can install the bundled plugins offline and keep your existing plugin configuration. A Windows install no longer lacks bundled plugin dependencies the first time it starts. Installers on the affected platforms start normally. A Windows zip build opens the matching zip; quit and replace the current folder, and do not run the installer.

## 1.0.81 — 2026-10-07

**Host and bundled plugins**

- Bundled plugins are upgraded to their current latest versions: Codex UI 1.1.30, IM Connect 0.1.66, Automation 0.1.58, Skills Manager 1.1.13, Archive Manager 1.0.15, Agency Agents 1.0.11, Codex Pet 0.1.15, BTW 0.1.17, Code Review 0.1.12, and PUA 0.3.24. Simplify 0.1.14, Better Sidebar 0.24.1, dshmarket 1.66.9, and official DSH 0.2.0-rc.2 were already the latest versions and are unchanged. The packaged build stages these exact versions.
- If you are upgrading from a version before 1.0.77, new installs still omit the Context and Usage Billing plugins. The desktop pet follows the cursor while idle. Upgrades from older versions can install the bundled plugins offline and keep your existing plugin configuration. A Windows install no longer lacks bundled plugin dependencies the first time it starts. Installers on the affected platforms start normally.



