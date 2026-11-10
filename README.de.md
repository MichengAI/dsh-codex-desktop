<p align="center">
  <img src="assets/branding/dsh-codex-desktop-banner.webp" alt="DSH Codex Desktop Produktbanner" width="100%">
</p>

<div align="center">

# DSH Codex Desktop

**Einmal herunterladen. Sofort einsatzbereite lokale KI-Workstation öffnen.**

[简体中文](README.zh-CN.md) · [English](README.en.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

[Downloads](https://github.com/MichengAI/dsh-codex-desktop/releases) · [Änderungsprotokoll](CHANGELOG.md) · [Problem melden](https://github.com/MichengAI/dsh-codex-desktop/issues)

[![Release](https://img.shields.io/github/v/release/MichengAI/dsh-codex-desktop?display_name=tag&label=release)](https://github.com/MichengAI/dsh-codex-desktop/releases)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Desktop package](https://github.com/MichengAI/dsh-codex-desktop/actions/workflows/desktop-package.yml/badge.svg?branch=main)](https://github.com/MichengAI/dsh-codex-desktop/actions/workflows/desktop-package.yml)
![Windows x64](https://img.shields.io/badge/Windows-x64-0078D4?logo=windows&logoColor=white)
![macOS](https://img.shields.io/badge/macOS-Apple%20Silicon%20%7C%20Intel-000000?logo=apple&logoColor=white)
![Linux](https://img.shields.io/badge/Linux-x64%20%7C%20ARM64-FCC624?logo=linux&logoColor=black)

</div>

> DSH Codex Desktop ist eine von der Community gepflegte Desktop-Distribution für DeepSeek Harness. Es ist kein offizielles Produkt von DeepSeek AI.

DSH Codex Desktop macht [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) zu einer nativen, sofort startbereiten Arbeitsumgebung. Das Installationsprogramm bündelt die erforderliche Node.js-Laufzeitumgebung und das lokale DSH-System: installieren, starten und direkt loslegen.

## Download und Einstieg

Laden Sie das aktuelle Installationspaket von den [GitHub Releases](https://github.com/MichengAI/dsh-codex-desktop/releases) herunter.

| Plattform | Paket | Anleitung |
| --- | --- | --- |
| Windows x64 | `.exe`-Installer oder `.zip`-Archiv | Installer ausführen und **DSH Codex Desktop** über das Startmenü öffnen. |
| macOS Apple Silicon / Intel | `.dmg`-Installer | Disk-Image öffnen, App in den Programme-Ordner ziehen und starten. |
| Linux x64 / ARM64 | `.AppImage` oder Debian / Ubuntu `.deb` | Entsprechendes AppImage ausführen oder `.deb`-Paket installieren. |

1. Paket für Ihre Plattform herunterladen.
2. **DSH Codex Desktop** installieren und öffnen.
3. Warten, bis der integrierte DSH-Dienst hochgefahren ist.
4. Aufgabe erstellen, Modell auswählen und am Projekt arbeiten.

## Umfassende Desktop-Funktionen

| Bereich | Funktion |
| --- | --- |
| **Arbeitsbereich** | Projekt- und Aufgabenverwaltung, Chats, Modellwahl und Berechtigungssteuerung in einem nativen Fenster. |
| **Experten-Profile** | Spezialisierte Rollen für Code-Reviews, Architektur, Frontend, Backend und DevOps aktivieren. |
| **Skill-Center** | Lokale und geteilte Agent-Skills zentral verwalten, aktivieren und hochladen. |
| **Archivverwaltung** | Frühere Chats durchsuchen, wiederherstellen oder sicher entfernen. |
| **IM-Assistent** | Messaging-Kanäle wie DingTalk, Feishu, Lark, WeChat, QQ, Telegram an zentraler Stelle einrichten. |
| **Plugin-Marktplatz** | DSH-Erweiterungen direkt in der Desktop-App entdecken, installieren und aktualisieren. |
| **Automatisierung** | Wiederkehrende Aufgaben mit integriertem Scheduler steuern. |
| **Sichere Laufzeit** | Lokale Loopback-Bindung mit geschützter App-Hülle. |

## Vorinstallierte Plugins

| Funktion | Paket |
| --- | --- |
| Codex-Oberfläche | [`@michengai/dsh-codex-ui`](https://github.com/MichengAI/dsh-codex-ui) |
| Desktop-Begleiter & Benachrichtigungen | [`@michengai/dsh-codex-pet`](https://github.com/MichengAI/dsh-codex-pet) |
| Expertenverwaltung | [`@michengai/dsh-agency-agents`](https://github.com/MichengAI/dsh-agency-agents) |
| Skill-Verwaltung | [`@michengai/dsh-skills-manager`](https://github.com/MichengAI/dsh-skills-manager) |
| Archiv-Manager | [`@michengai/dsh-archive-manager`](https://github.com/MichengAI/dsh-archive-manager) |
| IM-Assistent | [`@michengai/dsh-im-connect`](https://github.com/MichengAI/dsh-im-connect) |
| Aufgabenplanung | [`@michengai/dsh-automation`](https://github.com/MichengAI/dsh-automation) |
| Erweiterbare Seitenleiste | [`dsh-better-sidebar`](https://github.com/omdsh-dev/DSH-better-sidebar) |
| Nebenfragen stellen | [`@michengai/dsh-btw`](https://github.com/MichengAI/dsh-btw) |
| Code-Vereinfachung für Git | [`@michengai/dsh-simplify`](https://github.com/MichengAI/dsh-simplify) |
| Fehlerdiagnose & Wiederholungen | [`@michengai/dsh-pua`](https://github.com/MichengAI/dsh-pua) |
| Unabhängiges Code-Review | [`@michengai/dsh-code-review`](https://github.com/MichengAI/dsh-code-review) |
| Plugin-Marktplatz | [`dshmarket`](https://www.npmjs.com/package/dshmarket) |

## Lizenz

Dieses Projekt ist unter der [Apache-2.0-Lizenz](LICENSE) lizenziert.
