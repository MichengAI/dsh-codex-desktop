<p align="center">
  <img src="assets/branding/dsh-codex-desktop-banner.webp" alt="Баннер DSH Codex Desktop" width="100%">
</p>

<div align="center">

# DSH Codex Desktop

**Скачайте один раз. Откройте готовое локальное рабочее пространство ИИ.**

[简体中文](README.zh-CN.md) · [English](README.en.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

[Загрузки](https://github.com/MichengAI/dsh-codex-desktop/releases) · [История изменений](CHANGELOG.md) · [Сообщить об ошибке](https://github.com/MichengAI/dsh-codex-desktop/issues)

[![Release](https://img.shields.io/github/v/release/MichengAI/dsh-codex-desktop?display_name=tag&label=release)](https://github.com/MichengAI/dsh-codex-desktop/releases)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Desktop package](https://github.com/MichengAI/dsh-codex-desktop/actions/workflows/desktop-package.yml/badge.svg?branch=main)](https://github.com/MichengAI/dsh-codex-desktop/actions/workflows/desktop-package.yml)
![Windows x64](https://img.shields.io/badge/Windows-x64-0078D4?logo=windows&logoColor=white)
![macOS](https://img.shields.io/badge/macOS-Apple%20Silicon%20%7C%20Intel-000000?logo=apple&logoColor=white)
![Linux](https://img.shields.io/badge/Linux-x64%20%7C%20ARM64-FCC624?logo=linux&logoColor=black)

</div>

> DSH Codex Desktop — это поддерживаемый сообществом десктопный дистрибутив DeepSeek Harness. Не является официальным продуктом DeepSeek AI.

DSH Codex Desktop превращает [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) в нативное десктопное рабочее место, готовое к работе сразу после установки. Установочный пакет уже включает Node.js и локальную среду DSH — вам не нужно настраивать окружение вручную или запускать DSH через терминал.

## Загрузка и запуск

Скачайте актуальный установщик со страницы [GitHub Releases](https://github.com/MichengAI/dsh-codex-desktop/releases).

| Платформа | Пакет | Как запустить |
| --- | --- | --- |
| Windows x64 | Установщик `.exe` или архив `.zip` | Запустите установщик и откройте **DSH Codex Desktop** из меню «Пуск». |
| macOS Apple Silicon / Intel | Установщик `.dmg` | Откройте образ диска, перетащите приложение в «Программы» и запустите. |
| Linux x64 / ARM64 | Пакет `.AppImage` или `.deb` | Запустите AppImage для вашей архитектуры или установите пакет deb. |

1. Скачайте пакет для вашей системы.
2. Установите и откройте **DSH Codex Desktop**.
3. Дождитесь запуска встроенной службы DSH.
4. Создайте задачу, выберите модель и приступайте к работе.

Приложение хранит данные DSH в вашей стандартной папке профиля (`%USERPROFILE%\.dsh` в Windows), поэтому диалоги и настройки сохраняются при обновлениях.

## Возможности рабочего пространства

| Область | Что включено |
| --- | --- |
| **Десктопные диалоги** | Навигация по проектам, сессии чата, выбор моделей, управление правами в нативном окне. |
| **Экспертные роли** | Профили специалистов для код-ревью, архитектуры, фронтенда, бэкенда и DevOps. |
| **Центр навыков** | Управление локальными и общими навыками Agent через настройки. |
| **Управление архивом** | Поиск, восстановление или удаление архивных сессий. |
| **Мессенджер-ассистент** | Интеграция DingTalk, Feishu, Lark, WeChat, QQ, Telegram в одном месте. |
| **Каталог плагинов** | Поиск, установка и обновление плагинов прямо в приложении. |
| **Автоматизация** | Планирование периодических задач с помощью встроенного планировщика. |
| **Безопасная среда** | Запуск DSH на локальном адресе с изолированной оболочкой. |

## Встроенные плагины

| Возможность | Пакет |
| --- | --- |
| Интерфейс в стиле Codex | [`@michengai/dsh-codex-ui`](https://github.com/MichengAI/dsh-codex-ui) |
| Десктопный питомец и уведомления | [`@michengai/dsh-codex-pet`](https://github.com/MichengAI/dsh-codex-pet) |
| Экспертные пресеты | [`@michengai/dsh-agency-agents`](https://github.com/MichengAI/dsh-agency-agents) |
| Управление навыками | [`@michengai/dsh-skills-manager`](https://github.com/MichengAI/dsh-skills-manager) |
| Управление архивом | [`@michengai/dsh-archive-manager`](https://github.com/MichengAI/dsh-archive-manager) |
| Подключение мессенджеров | [`@michengai/dsh-im-connect`](https://github.com/MichengAI/dsh-im-connect) |
| Запланированные задачи | [`@michengai/dsh-automation`](https://github.com/MichengAI/dsh-automation) |
| Боковая панель | [`dsh-better-sidebar`](https://github.com/omdsh-dev/DSH-better-sidebar) |
| Быстрые вопросы | [`@michengai/dsh-btw`](https://github.com/MichengAI/dsh-btw) |
| Упрощение кода Git | [`@michengai/dsh-simplify`](https://github.com/MichengAI/dsh-simplify) |
| Диагностика и автоисправление | [`@michengai/dsh-pua`](https://github.com/MichengAI/dsh-pua) |
| Независимое код-ревью | [`@michengai/dsh-code-review`](https://github.com/MichengAI/dsh-code-review) |
| Магазин плагинов | [`dshmarket`](https://www.npmjs.com/package/dshmarket) |

## Лицензия

Проект распространяется под лицензией [Apache 2.0](LICENSE).
