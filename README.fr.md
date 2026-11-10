<p align="center">
  <img src="assets/branding/dsh-codex-desktop-banner.webp" alt="Bannière DSH Codex Desktop" width="100%">
</p>

<div align="center">

# DSH Codex Desktop

**Téléchargez une fois. Ouvrez un espace de travail IA local prêt à l'emploi.**

[简体中文](README.zh-CN.md) · [English](README.en.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

[Téléchargements](https://github.com/MichengAI/dsh-codex-desktop/releases) · [Journal des modifications](CHANGELOG.md) · [Signaler un problème](https://github.com/MichengAI/dsh-codex-desktop/issues)

[![Release](https://img.shields.io/github/v/release/MichengAI/dsh-codex-desktop?display_name=tag&label=release)](https://github.com/MichengAI/dsh-codex-desktop/releases)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Desktop package](https://github.com/MichengAI/dsh-codex-desktop/actions/workflows/desktop-package.yml/badge.svg?branch=main)](https://github.com/MichengAI/dsh-codex-desktop/actions/workflows/desktop-package.yml)
![Windows x64](https://img.shields.io/badge/Windows-x64-0078D4?logo=windows&logoColor=white)
![macOS](https://img.shields.io/badge/macOS-Apple%20Silicon%20%7C%20Intel-000000?logo=apple&logoColor=white)
![Linux](https://img.shields.io/badge/Linux-x64%20%7C%20ARM64-FCC624?logo=linux&logoColor=black)

</div>

> DSH Codex Desktop est une distribution de bureau maintenue par la communauté pour DeepSeek Harness. Ce n'est pas un produit officiel de DeepSeek AI.

DSH Codex Desktop transforme [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) en un environnement de bureau natif et immédiatement fonctionnel. Le programme d'installation inclut l'environnement Node.js requis et le runtime local DSH : installez, ouvrez et commencez à travailler sans configuration manuelle.

## Téléchargement et démarrage

Téléchargez la dernière version depuis [GitHub Releases](https://github.com/MichengAI/dsh-codex-desktop/releases).

| Plateforme | Fichier | Instructions |
| --- | --- | --- |
| Windows x64 | Fichier d'installation `.exe` ou archive `.zip` | Lancez l'installateur, puis ouvrez **DSH Codex Desktop** depuis le menu Démarrer. |
| macOS Apple Silicon / Intel | Fichier `.dmg` | Ouvrez l'image disque, glissez l'application dans Applications et lancez-la. |
| Linux x64 / ARM64 | Fichier `.AppImage` ou paquet Debian / Ubuntu `.deb` | Exécutez l'AppImage correspondant à votre architecture ou installez le paquet deb. |

1. Téléchargez le fichier adapté à votre système d'exploitation.
2. Installez et lancez **DSH Codex Desktop**.
3. Attendez la fin de l'initialisation du service local DSH.
4. Créez une tâche, choisissez un modèle et travaillez dans vos projets.

L'application conserve vos données DSH dans votre répertoire utilisateur habituel (`%USERPROFILE%\.dsh` sous Windows), préservant ainsi vos sessions et paramètres après les mises à jour.

## Un environnement complet

| Fonctionnalité | Ce qui est inclus |
| --- | --- |
| **Espace de travail de discussion** | Navigation par projets, sessions, choix des modèles, autorisations et journaux dans une fenêtre dédiée. |
| **Profils d'experts** | Activez des spécialistes pour la revue de code, l'architecture, le frontend, le backend et l'administration système. |
| **Centre de compétences (Skills)** | Consultez, activez, désactivez et gérez vos compétences d'Agent locales et partagées. |
| **Gestion des archives** | Recherchez, restaurez ou nettoyez vos discussions archivées en toute simplicité. |
| **Assistant de messagerie (IM)** | Intégrez DingTalk, Feishu, Lark, WeChat, WeCom, QQ, Telegram au même endroit. |
| **Marché d'extensions** | Découvrez, installez et mettez à jour des plugins DSH sans quitter l'application. |
| **Automatisation planifiée** | Planifiez vos tâches récurrentes directement depuis votre espace de travail. |
| **Exécution locale sécurisée** | Démarrage sur une adresse de bouclage locale validée avec interface confinée. |

## Extensions incluses par défaut

| Fonctionnalité | Paquet |
| --- | --- |
| Interface moderne style Codex | [`@michengai/dsh-codex-ui`](https://github.com/MichengAI/dsh-codex-ui) |
| Compagnon de bureau et notifications | [`@michengai/dsh-codex-pet`](https://github.com/MichengAI/dsh-codex-pet) |
| Gestion des profils experts | [`@michengai/dsh-agency-agents`](https://github.com/MichengAI/dsh-agency-agents) |
| Gestion des compétences | [`@michengai/dsh-skills-manager`](https://github.com/MichengAI/dsh-skills-manager) |
| Gestion des archives | [`@michengai/dsh-archive-manager`](https://github.com/MichengAI/dsh-archive-manager) |
| Assistant messagerie | [`@michengai/dsh-im-connect`](https://github.com/MichengAI/dsh-im-connect) |
| Tâches planifiées | [`@michengai/dsh-automation`](https://github.com/MichengAI/dsh-automation) |
| Barre latérale extensible | [`dsh-better-sidebar`](https://github.com/omdsh-dev/DSH-better-sidebar) |
| Questions secondaires instantanées | [`@michengai/dsh-btw`](https://github.com/MichengAI/dsh-btw) |
| Simplification du code Git | [`@michengai/dsh-simplify`](https://github.com/MichengAI/dsh-simplify) |
| Diagnostic et vérification des erreurs | [`@michengai/dsh-pua`](https://github.com/MichengAI/dsh-pua) |
| Revue de code indépendante | [`@michengai/dsh-code-review`](https://github.com/MichengAI/dsh-code-review) |
| Marché de plugins | [`dshmarket`](https://www.npmjs.com/package/dshmarket) |

## Licence

Ce projet est sous licence [Apache 2.0](LICENSE).
