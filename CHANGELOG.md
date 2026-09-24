# Changelog

[简体中文](CHANGELOG.zh-CN.md)

The five most recent published versions are listed below.

## 1.0.74 — 2026-09-24

- Merging an existing Profile also pulls in that machine's own pnpm metadata cache, so an offline upgrade can verify the old lockfile. 1.0.73 failed on the 1.0.41 Windows check because that lockfile referenced packages the bundled store no longer carries, such as cosmokit 1.8.1.

## 1.0.73 — 2026-09-24

- The upgrade smoke reads the PUA default from the Profile patch, where DSH 0.1.7 keeps global plugin settings. `settings.yaml` is legacy and is no longer written, so 1.0.72 aborted the Windows 1.0.51 upgrade check on a missing file.
- The packaged smokes retry the first local HTTP request. Provisioning the profile restarts the local server, and the reset used to fail the macOS Intel check.

## 1.0.72 — 2026-09-24

- Package the offline store from a link-free copy, then install from that archive the same way Windows startup does. 1.0.71 still checked the live directory, so the packaged store could omit lucide-react 1.48.0.

## 1.0.71 — 2026-09-24

- Accept the 0.1.7 bundle patch list. 1.0.70 treated `@deepseek-ai/dsh-web-app` as missing because its patch field is an array, so every platform aborted before the HTTP server started.

## 1.0.70 — 2026-09-24

- Copy hardlinked store files into the package before archiving. 1.0.69 verified the live store, then Windows tar dropped lucide-react 1.48.0 because it was a link outside the archive.
- Write first-launch failures to the smoke log, and give Linux packaged startup the same 180 seconds as macOS.

