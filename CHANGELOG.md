# Changelog

[简体中文](CHANGELOG.zh-CN.md)

The five most recent published versions are listed below.

## 1.0.68 — 2026-09-24

- First launch installs bundled plugins from the lockfile packed with the offline store, instead of re-resolving dependency ranges. A newly published transitive package, such as lucide-react 1.48.0, no longer blocks an offline start.

## 1.0.67 — 2026-09-24

- Desktop v2 pets turn their head toward the cursor while idle. The native window polls the screen cursor; the web overlay is unchanged.
- Update the bundled official DSH runtime from 0.1.6-alpha.2 to 0.1.7-rc.1, including scope, timeout, and invariants. cordis-plugin-group moves from 1.0.2 to 1.0.4 so the 0.1.7-rc.1 boot peer can install.
- Refresh all 14 bundled plugins to current npm latest: Codex UI 1.1.17, IM Connect 0.1.54, Automation 0.1.50, Skills Manager 1.1.3, Archive Manager 1.0.4, Agency Agents 1.0.3, Codex Pet 0.1.9, BTW 0.1.12, Simplify 0.1.9, Code Review 0.1.5, PUA 0.3.17, Better Sidebar 0.21.1, MCP Connector 0.2.58, and dshmarket 1.64.0.
- Stop shipping Context and Usage Billing in the offline store. They were already removed from the install catalog in 1.0.66.

## 1.0.66 — 2026-09-21

- Slim the bundled community catalog: drop Context and Usage Billing. New installs no longer ship those two plugins. The offline store still keeps them so older profiles can upgrade without lockfile resolution failures.
- Refresh 5 bundled plugins to current npm latest: Skills Manager 1.0.1, Archive Manager 1.0.2, Agency Agents 1.0.1, MCP Connector 0.2.54, and dshmarket 1.53.0. The other 9 bundled plugins were already latest. Official DSH remains 0.1.6-alpha.2.

## 1.0.65 — 2026-09-19

- Keep official profile layers that are not leftover Web-profile dependencies, instead of maintaining a Desktop allowlist of official optional bundles.
- Refresh 2 bundled plugins to current npm latest: Codex UI 1.1.14 and dshmarket 1.48.0. The other 14 bundled plugins and official DSH 0.1.6-alpha.2 were already latest.

## 1.0.64 — 2026-09-18

- Update the bundled official DSH runtime from 0.1.6-alpha.1 to 0.1.6-alpha.2, including the matching scope, timeout, and invariants launch peers.
- Refresh 13 bundled plugins to current npm latest: Codex UI 1.1.13, IM Connect 0.1.51, Automation 0.1.45, Skills Manager 0.1.53, Archive Manager 0.1.44, Agency Agents 0.1.44, Codex Pet 0.1.7, BTW 0.1.10, Simplify 0.1.7, Code Review 0.1.4, PUA 0.3.16, Context 0.53.3, and MCP Connector 0.2.51. Better Sidebar, Usage Billing, and dshmarket were already latest.

