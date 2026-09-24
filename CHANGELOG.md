# Changelog

[简体中文](CHANGELOG.zh-CN.md)

The five most recent published versions are listed below.

## 1.0.75 — 2026-09-24

- Fixed upgrades from older versions failing to install their bundled plugins, including offline upgrades.
- Your existing plugin configuration is kept after upgrading.

## 1.0.74 — 2026-09-24

- Improved the dependency check used when upgrading from an older version. This build still fails on Windows; use 1.0.75 instead.

## 1.0.73 — 2026-09-24

- Fixed a false "bundled plugin seeding failed" report when upgrading from an older version on Windows.

## 1.0.72 — 2026-09-24

- Fixed Windows installs that could lack bundled plugin dependencies the first time the app starts.
- First-launch failures now leave a log so they can be reported.

## 1.0.71 — 2026-09-24

- Fixed installers on some platforms failing to start.
