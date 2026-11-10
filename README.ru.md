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

## Обзор интерфейса

Ознакомьтесь с рабочей областью, светлой темой настроек и управлением плагинами. Нажмите на любое изображение для просмотра в исходном разрешении.

<p align="center"><em>Главная: навигация по проектам, запуск задач и редактор ввода.</em></p>

<p align="center"><a href="assets/screenshots/preview-home.webp"><img src="assets/screenshots/preview-home.webp" alt="Главная: навигация по проектам, запуск задач и редактор ввода." width="960"></a></p>

<p align="center"><em>Диалоги: сообщения, траектория рассуждений, контекст и ввод.</em></p>

<p align="center"><a href="assets/screenshots/preview-conversation.webp"><img src="assets/screenshots/preview-conversation.webp" alt="Диалоги: сообщения, траектория рассуждений, контекст и ввод." width="960"></a></p>

<details>
<summary>Внешний вид и питомцы (2 снимка)</summary>

<p align="center"><em>Настройки светлой темы: права, язык, внешний вид и редактор.</em></p>

<p align="center"><a href="assets/screenshots/preview-general-light.webp"><img src="assets/screenshots/preview-general-light.webp" alt="Настройки светлой темы: права, язык, внешний вид и редактор." width="960"></a></p>

<p align="center"><em>Настройки питомца: выбор компаньона, управление и размер.</em></p>

<p align="center"><a href="assets/screenshots/preview-pets.webp"><img src="assets/screenshots/preview-pets.webp" alt="Настройки питомца: выбор компаньона, управление и размер." width="960"></a></p>

</details>

<details>
<summary>Наши плагины (6 снимков)</summary>

<p align="center"><em>Экспертные роли: фильтрация, поиск и включение ролей.</em></p>

<p align="center"><a href="assets/screenshots/preview-experts.webp"><img src="assets/screenshots/preview-experts.webp" alt="Экспертные роли: фильтрация, поиск и включение ролей." width="960"></a></p>

<p align="center"><em>Управление навыками: централизованное управление Agent Skills.</em></p>

<p align="center"><a href="assets/screenshots/preview-skills.webp"><img src="assets/screenshots/preview-skills.webp" alt="Управление навыками: централизованное управление Agent Skills." width="960"></a></p>

<p align="center"><em>Автоматизация: расписание задач и история запусков.</em></p>

<p align="center"><a href="assets/screenshots/preview-automation.webp"><img src="assets/screenshots/preview-automation.webp" alt="Автоматизация: расписание задач и история запусков." width="960"></a></p>

<p align="center"><em>Мессенджер-ассистент: каналы, аккаунты и входящие сообщения.</em></p>

<p align="center"><a href="assets/screenshots/preview-im-connect.webp"><img src="assets/screenshots/preview-im-connect.webp" alt="Мессенджер-ассистент: каналы, аккаунты и входящие сообщения." width="960"></a></p>

<p align="center"><em>Архив диалогов: фильтрация по проектам, поиск и восстановление.</em></p>

<p align="center"><a href="assets/screenshots/preview-archive.webp"><img src="assets/screenshots/preview-archive.webp" alt="Архив диалогов: фильтрация по проектам, поиск и восстановление." width="960"></a></p>

<p align="center"><em>Настройки Codex UI: обзор функций и статус плагинов.</em></p>

<p align="center"><a href="assets/screenshots/preview-codex-ui.webp"><img src="assets/screenshots/preview-codex-ui.webp" alt="Настройки Codex UI: обзор функций и статус плагинов." width="960"></a></p>

</details>

<details>
<summary>Плагины сообщества (4 снимка)</summary>

<p align="center"><em>Настройки контекста</em></p>

<p align="center"><a href="assets/screenshots/preview-context.webp"><img src="assets/screenshots/preview-context.webp" alt="Настройки контекста" width="960"></a></p>

<p align="center"><em>Настройки боковой панели</em></p>

<p align="center"><a href="assets/screenshots/preview-sidebar.webp"><img src="assets/screenshots/preview-sidebar.webp" alt="Настройки боковой панели" width="960"></a></p>

<p align="center"><em>Магазин плагинов: поиск плагинов и проверка обновлений.</em></p>

<p align="center"><a href="assets/screenshots/preview-plugin-market.webp"><img src="assets/screenshots/preview-plugin-market.webp" alt="Магазин плагинов: поиск плагинов и проверка обновлений." width="960"></a></p>

</details>

## Встроенные плагины

Установочный пакет включает локальную среду, необходимую для работы DSH. При первом запуске в профиле Web настраиваются следующие плагины:

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

Дополнительные плагины можно устанавливать через магазин. Десктопное приложение сохраняет собственную среду выполнения изолированной от плагинов профиля.

## Экосистема продуктов DSH

Для полноценного десктопного окружения скачайте [DSH Codex Desktop](https://github.com/MichengAI/dsh-codex-desktop/releases). Существующие установки [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) могут подключать плагины по отдельности:

| Плагин | Возможности |
| --- | --- |
| [Codex UI](https://github.com/MichengAI/dsh-codex-ui) | Организация проектов и чатов, поиск задач, навигация |
| [Agency Agents](https://github.com/MichengAI/dsh-agency-agents) | Выбор и вызов профильных специалистов |
| [Skills Manager](https://github.com/MichengAI/dsh-skills-manager) | Поиск, включение, создание и импорт навыков |
| [Archive Manager](https://github.com/MichengAI/dsh-archive-manager) | Поиск, восстановление и очистка архива |
| [IM Connect](https://github.com/MichengAI/dsh-im-connect) | Отправка задач и прием ответов через мессенджеры |
| [Automation](https://github.com/MichengAI/dsh-automation) | Планирование задач и просмотр истории |
| [BTW](https://github.com/MichengAI/dsh-btw) | Дополнительные вопросы без прерывания основной задачи |
| [Simplify](https://github.com/MichengAI/dsh-simplify) | Оптимизация кода в пределах изменений Git |
| [PUA](https://github.com/MichengAI/dsh-pua) | Автоматический поиск причин ошибок и проверка результата |
| [Code Review](https://github.com/MichengAI/dsh-code-review) | Независимый анализ кода через команду `/review` |
| [Codex Pet](https://github.com/MichengAI/dsh-codex-pet) | Уведомления и подтверждения через экранного питомца |

Приложение также интегрирует [DSH Better Sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) и [App Market](https://www.npmjs.com/package/dshmarket).

## Обновления и восстановление

- **Обновления приложения**: Проверяются автоматически при запуске. В Настройки → Обновления можно включить автозагрузку. Установка всегда требует вашего согласия.
- **Перезагрузка DSH**: Доступна в меню трея для быстрого перезапуска локальной службы DSH без переустановки приложения.
- **Обновление плагинов**: Управляется через настройки DSH и рынок расширений.
- **Режим восстановления**: Безопасно изолирует проблемные плагины, если они вызывают сбой запуска.

## Системные требования (System requirements)

| Параметр | Требование |
| --- | --- |
| Операционная система | Windows 10/11, macOS или Linux |
| Архитектура | Windows x64, macOS arm64/x64 или Linux x64/arm64 |
| Node.js | Не требуется для конечных пользователей (встроен в приложение) |
| Сеть | Требуется только для обращений к провайдерам моделей и загрузки плагинов |

## Конфиденциальность и безопасность (Privacy and security)

- Конфигурация DSH, сессии и ключи хранятся в каталоге пользователя. Удаление приложения их не стирает.
- Лаунчер принимает только проверенные локальные loopback-адреса `127.0.0.1`.
- Внешние ссылки открываются в системном браузере по умолчанию.
- Electron использует изоляцию контекста и песочницу без интеграции Node.js на страницах DSH.
- Настроенные модели и инструменты DSH могут выполнять свои сетевые запросы. Проверяйте их политики конфиденциальности.

## Разработка (Development)

Документация передачи: [Базовая архитектура](docs/00-交接入口/05-技术架构基线.md) · [Архитектура десктопного лаунчера](docs/03-技术架构/00-桌面启动器架构基线.md).

Для разработки требуются Windows, Node.js `24.21.0` и pnpm `11.26.0`.

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
pnpm install --frozen-lockfile
pnpm test
pnpm run dist
```

## Лицензия (License)

Проект распространяется под лицензией [Apache 2.0](LICENSE).
