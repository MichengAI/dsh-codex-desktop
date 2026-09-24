# Changelog

[简体中文](CHANGELOG.zh-CN.md)

The five most recent published versions are listed below.

## 1.0.72 — 2026-09-24

- Package the offline store from a link-free copy, then install from that archive the same way Windows startup does. 1.0.71 still checked the live directory, so the packaged store could omit lucide-react 1.48.0.

## 1.0.71 — 2026-09-24

- Accept the 0.1.7 bundle patch list. 1.0.70 treated `@deepseek-ai/dsh-web-app` as missing because its patch field is an array, so every platform aborted before the HTTP server started.

## 1.0.70 — 2026-09-24

- Copy hardlinked store files into the package before archiving. 1.0.69 verified the live store, then Windows tar dropped lucide-react 1.48.0 because it was a link outside the archive.
- Write first-launch failures to the smoke log, and give Linux packaged startup the same 180 seconds as macOS.

## 1.0.69 — 2026-09-24

- Frozen offline install no longer passes `--allow-build`. That flag is only valid for `pnpm add`, so 1.0.68 rejected the first-launch install command.

## 1.0.68 — 2026-09-24

- First launch installs bundled plugins from the lockfile packed with the offline store, instead of re-resolving dependency ranges. A newly published transitive package, such as lucide-react 1.48.0, no longer blocks an offline start.

