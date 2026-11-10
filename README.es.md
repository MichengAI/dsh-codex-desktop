<p align="center">
  <img src="assets/branding/dsh-codex-desktop-banner.webp" alt="Banner de DSH Codex Desktop" width="100%">
</p>

<div align="center">

# DSH Codex Desktop

**Descarga una vez. Abre un espacio de trabajo de IA local listo para usar.**

[简体中文](README.zh-CN.md) · [English](README.en.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

[Descargas](https://github.com/MichengAI/dsh-codex-desktop/releases) · [Registro de cambios](CHANGELOG.md) · [Informar de un error](https://github.com/MichengAI/dsh-codex-desktop/issues)

[![Release](https://img.shields.io/github/v/release/MichengAI/dsh-codex-desktop?display_name=tag&label=release)](https://github.com/MichengAI/dsh-codex-desktop/releases)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Desktop package](https://github.com/MichengAI/dsh-codex-desktop/actions/workflows/desktop-package.yml/badge.svg?branch=main)](https://github.com/MichengAI/dsh-codex-desktop/actions/workflows/desktop-package.yml)
![Windows x64](https://img.shields.io/badge/Windows-x64-0078D4?logo=windows&logoColor=white)
![macOS](https://img.shields.io/badge/macOS-Apple%20Silicon%20%7C%20Intel-000000?logo=apple&logoColor=white)
![Linux](https://img.shields.io/badge/Linux-x64%20%7C%20ARM64-FCC624?logo=linux&logoColor=black)

</div>

> DSH Codex Desktop es una distribución de escritorio mantenida por la comunidad para DeepSeek Harness. No es un producto oficial de DeepSeek AI.

DSH Codex Desktop convierte [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) en un banco de trabajo de escritorio nativo y listo para ejecutarse. El instalador incluye el entorno Node.js y el runtime local de DSH: instálalo, ábrelo y empieza a trabajar de inmediato, sin necesidad de configurar Node.js ni iniciar DSH desde una terminal.

## Descarga e inicio

Obtén el instalador actual desde [GitHub Releases](https://github.com/MichengAI/dsh-codex-desktop/releases).

| Plataforma | Paquete | Cómo empezar |
| --- | --- | --- |
| Windows x64 | Instalador `.exe` o archivo `.zip` | Ejecuta el instalador y abre **DSH Codex Desktop** desde el menú Inicio. |
| macOS Apple Silicon / Intel | Instalador `.dmg` | Abre la imagen de disco, mueve la aplicación a Aplicaciones y ejecútala. |
| Linux x64 / ARM64 | `.AppImage` o paquete `.deb` de Debian/Ubuntu | Ejecuta el paquete correspondiente a tu arquitectura o instala el archivo deb. |

1. Descarga el paquete para tu sistema operativo.
2. Instala y abre **DSH Codex Desktop**.
3. Espera a que termine de iniciarse el servicio local de DSH.
4. Crea una tarea, selecciona el modelo y el modo de permisos, y comienza a trabajar.

La aplicación conserva los datos de DSH en tu perfil de usuario (`%USERPROFILE%\.dsh` en Windows), manteniendo tus sesiones y configuraciones tras las actualizaciones.

## Un entorno de trabajo completo

| Capacidad | Lo que obtienes |
| --- | --- |
| **Espacio de conversación** | Navegación de proyectos y tareas, sesiones de chat, selección de modelos, permisos y registros en una ventana nativa. |
| **Perfiles de expertos** | Activa especialistas para revisión de código, arquitectura, frontend, backend y operaciones. |
| **Centro de habilidades** | Revisa, activa, desactiva y gestiona habilidades locales y compartidas de Agent desde Configuración. |
| **Gestión de archivos** | Busca conversaciones archivadas, restaura sesiones o elimina registros antiguos de forma segura. |
| **Asistente de mensajería (IM)** | Configura DingTalk, Feishu, Lark, WeChat, WeCom, QQ, Telegram y más en un solo lugar. |
| **Mercado de complementos** | Descubre, instala, actualiza y diagnostica complementos de DSH sin salir de la app. |
| **Automatización programada** | Gestiona tareas periódicas desde el mismo espacio de trabajo mediante la programación de DSH. |
| **Entorno local seguro** | Inicia DSH en una dirección de loopback validada y mantiene la interfaz protegida. |

## Vista previa del producto

Explora el espacio de trabajo, la configuración en tema claro y las páginas de complementos. Haz clic en cualquier imagen para verla en resolución original.

<p align="center"><em>Inicio: navegación de proyectos, puntos de entrada y compositor.</em></p>

<p align="center"><a href="assets/screenshots/preview-home.webp"><img src="assets/screenshots/preview-home.webp" alt="Inicio: navegación de proyectos, puntos de entrada y compositor." width="960"></a></p>

<p align="center"><em>Conversación: mensajes, trayectoria, contexto y entrada de tareas.</em></p>

<p align="center"><a href="assets/screenshots/preview-conversation.webp"><img src="assets/screenshots/preview-conversation.webp" alt="Conversación: mensajes, trayectoria, contexto y entrada de tareas." width="960"></a></p>

<details>
<summary>Apariencia y mascotas de escritorio (2 capturas)</summary>

<p align="center"><em>Configuración en tema claro: permisos, idioma, apariencia y editor.</em></p>

<p align="center"><a href="assets/screenshots/preview-general-light.webp"><img src="assets/screenshots/preview-general-light.webp" alt="Configuración en tema claro: permisos, idioma, apariencia y editor." width="960"></a></p>

<p align="center"><em>Configuración de mascota: elección de compañero, gestión personalizada y tamaño.</em></p>

<p align="center"><a href="assets/screenshots/preview-pets.webp"><img src="assets/screenshots/preview-pets.webp" alt="Configuración de mascota: elección de compañero, gestión personalizada y tamaño." width="960"></a></p>

</details>

<details>
<summary>Nuestros complementos (6 capturas)</summary>

<p align="center"><em>Perfiles de expertos: filtrado, búsqueda y activación de roles.</em></p>

<p align="center"><a href="assets/screenshots/preview-experts.webp"><img src="assets/screenshots/preview-experts.webp" alt="Perfiles de expertos: filtrado, búsqueda y activación de roles." width="960"></a></p>

<p align="center"><em>Gestión de habilidades: gestión de Agent Skills en todas las fuentes.</em></p>

<p align="center"><a href="assets/screenshots/preview-skills.webp"><img src="assets/screenshots/preview-skills.webp" alt="Gestión de habilidades: gestión de Agent Skills en todas las fuentes." width="960"></a></p>

<p align="center"><em>Automatización programada: ejemplos, horarios e historial de ejecución.</em></p>

<p align="center"><a href="assets/screenshots/preview-automation.webp"><img src="assets/screenshots/preview-automation.webp" alt="Automatización programada: ejemplos, horarios e historial de ejecución." width="960"></a></p>

<p align="center"><em>Asistente de mensajería (IM): gestión de canales, cuentas y mensajes entrantes.</em></p>

<p align="center"><a href="assets/screenshots/preview-im-connect.webp"><img src="assets/screenshots/preview-im-connect.webp" alt="Asistente de mensajería (IM): gestión de canales, cuentas y mensajes entrantes." width="960"></a></p>

<p align="center"><em>Conversaciones archivadas: filtrado por proyecto, búsqueda y restauración.</em></p>

<p align="center"><a href="assets/screenshots/preview-archive.webp"><img src="assets/screenshots/preview-archive.webp" alt="Conversaciones archivadas: filtrado por proyecto, búsqueda y restauración." width="960"></a></p>

<p align="center"><em>Configuración de Codex UI: descripción general y estado de instalación.</em></p>

<p align="center"><a href="assets/screenshots/preview-codex-ui.webp"><img src="assets/screenshots/preview-codex-ui.webp" alt="Configuración de Codex UI: descripción general y estado de instalación." width="960"></a></p>

</details>

<details>
<summary>Complementos comunitarios (4 capturas)</summary>

<p align="center"><em>Configuración de contexto</em></p>

<p align="center"><a href="assets/screenshots/preview-context.webp"><img src="assets/screenshots/preview-context.webp" alt="Configuración de contexto" width="960"></a></p>

<p align="center"><em>Configuración de barra lateral</em></p>

<p align="center"><a href="assets/screenshots/preview-sidebar.webp"><img src="assets/screenshots/preview-sidebar.webp" alt="Configuración de barra lateral" width="960"></a></p>

<p align="center"><em>Mercado de complementos: descubrimiento e inspección de estado de instalación y actualización.</em></p>

<p align="center"><a href="assets/screenshots/preview-plugin-market.webp"><img src="assets/screenshots/preview-plugin-market.webp" alt="Mercado de complementos: descubrimiento e inspección de estado de instalación y actualización." width="960"></a></p>

</details>

## Complementos incluidos de fábrica

El instalador incluye el runtime local necesario para iniciar DSH. En el primer inicio, configura los complementos comunitarios orientados al escritorio en el perfil Web:

| Funcionalidad | Paquete |
| --- | --- |
| Interfaz estilo Codex | [`@michengai/dsh-codex-ui`](https://github.com/MichengAI/dsh-codex-ui) |
| Mascota de escritorio nativa y notificaciones | [`@michengai/dsh-codex-pet`](https://github.com/MichengAI/dsh-codex-pet) |
| Gestión de roles de expertos | [`@michengai/dsh-agency-agents`](https://github.com/MichengAI/dsh-agency-agents) |
| Centro de habilidades | [`@michengai/dsh-skills-manager`](https://github.com/MichengAI/dsh-skills-manager) |
| Gestión de archivos | [`@michengai/dsh-archive-manager`](https://github.com/MichengAI/dsh-archive-manager) |
| Asistente de mensajería | [`@michengai/dsh-im-connect`](https://github.com/MichengAI/dsh-im-connect) |
| Automatización programada | [`@michengai/dsh-automation`](https://github.com/MichengAI/dsh-automation) |
| Barra lateral extensible | [`dsh-better-sidebar`](https://github.com/omdsh-dev/DSH-better-sidebar) |
| Preguntas secundarias rápidas | [`@michengai/dsh-btw`](https://github.com/MichengAI/dsh-btw) |
| Simplificación de código en cambios Git | [`@michengai/dsh-simplify`](https://github.com/MichengAI/dsh-simplify) |
| Diagnóstico y reintentos ante fallos | [`@michengai/dsh-pua`](https://github.com/MichengAI/dsh-pua) |
| Revisión de código independiente | [`@michengai/dsh-code-review`](https://github.com/MichengAI/dsh-code-review) |
| Mercado de complementos | [`dshmarket`](https://www.npmjs.com/package/dshmarket) |

Posteriormente puedes gestionar complementos adicionales desde el mercado. La aplicación de escritorio mantiene su propio runtime separado de los complementos comunitarios del perfil, por lo que los cambios en estos no sobrescriben el runtime de la aplicación.

El bridge de escritorio se distribuye con la app y solo se inyecta cuando Desktop inicia DSH; no es necesario instalarlo en el perfil Web compartido. Ejecutar `dsh web` manualmente utiliza la ruta propia de gestión de plugins de la Web.

## Ecosistema de productos DSH

Para un entorno de trabajo completo, descarga [DSH Codex Desktop](https://github.com/MichengAI/dsh-codex-desktop/releases). Las instalaciones existentes de [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) pueden agregar complementos según sus necesidades siguiendo las instrucciones de cada README:

| Complemento | Qué puedes hacer |
| --- | --- |
| [Codex UI](https://github.com/MichengAI/dsh-codex-ui) | Organizar proyectos y conversaciones, buscar tareas y navegar por turnos de chat |
| [Agency Agents](https://github.com/MichengAI/dsh-agency-agents) | Elegir y convocar especialistas para tu tarea |
| [Skills Manager](https://github.com/MichengAI/dsh-skills-manager) | Buscar, activar, crear e importar habilidades locales |
| [Archive Manager](https://github.com/MichengAI/dsh-archive-manager) | Buscar, restaurar o limpiar conversaciones archivadas |
| [IM Connect](https://github.com/MichengAI/dsh-im-connect) | Enviar tareas y recibir respuestas mediante plataformas de mensajería |
| [Automation](https://github.com/MichengAI/dsh-automation) | Programar tareas y revisar cada ejecución |
| [BTW](https://github.com/MichengAI/dsh-btw) | Hacer preguntas secundarias sin interrumpir la tarea principal |
| [Simplify](https://github.com/MichengAI/dsh-simplify) | Usar `/simplify` para mejorar el código dentro de tus cambios de Git |
| [PUA](https://github.com/MichengAI/dsh-pua) | Guiar al Agent para probar nuevos enfoques tras fallos, investigar causas y verificar resultados |
| [Code Review](https://github.com/MichengAI/dsh-code-review) | Usar `/review` para solicitar una revisión de código independiente y recibir el informe en el chat |
| [Codex Pet](https://github.com/MichengAI/dsh-codex-pet) | Ver notificaciones de conversación y responder a aprobaciones de herramientas mediante una mascota |

La app también integra [DSH Better Sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) y [App Market](https://www.npmjs.com/package/dshmarket) como plugins de terceros.

## Actualizaciones y recuperación

- **Actualizaciones de escritorio**: Se comprueban automáticamente tras el inicio y te notifican si hay una nueva versión. En Configuración → Actualizaciones puedes activar la descarga automática o dejar solo la comprobación manual. La instalación siempre requiere confirmación.
- **Recarga de DSH**: Disponible desde el menú de la bandeja para reiniciar el servicio DSH local sin reinstalar la aplicación.
- **Actualización de complementos**: Se realiza en la configuración de DSH y el mercado.
- **Recuperación al inicio**: Desactiva complementos problemáticos que causan fallos de carga para que puedas restaurar el espacio de trabajo.

## Requisitos del sistema (System requirements)

| Elemento | Requisito |
| --- | --- |
| Sistema operativo | Windows 10/11, macOS o Linux |
| Arquitectura | Windows x64, macOS arm64/x64 o Linux x64/arm64 |
| Node.js | No requerido para usuarios finales (incluido en la app) |
| Conexión a red | Requerida únicamente para los proveedores de modelos y descargas de plugins |

## Privacidad y seguridad (Privacy and security)

- La configuración de DSH, sesiones y credenciales permanecen en el directorio del usuario. Desinstalar la app no los borra.
- El launcher solo acepta direcciones HTTP locales validadas `127.0.0.1` para su ventana integrada.
- Los enlaces externos HTTP(S) se abren en el navegador del sistema. Las URLs file, JavaScript y data están bloqueadas.
- Electron utiliza aislamiento de contexto y sandboxing, con la integración de Node.js desactivada en la página de DSH.
- Los proveedores de modelos y herramientas de DSH pueden realizar sus propias solicitudes de red. Revisa sus políticas de privacidad antes de utilizarlos.

## Desarrollo (Development)

Documentación de traspaso: [Resumen de la arquitectura base](docs/00-交接入口/05-技术架构基线.md) · [Arquitectura base del launcher de escritorio](docs/03-技术架构/00-桌面启动器架构基线.md).

El trabajo de empaquetado de Windows ejecuta `pnpm smoke:upgrade <old-exe> <new-exe>` antes de subir artefactos. El desarrollo requiere Windows, Node.js `24.21.0` y pnpm `11.26.0`.

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
pnpm install --frozen-lockfile
pnpm test
pnpm run dist
```

## Licencia (License)

Este proyecto está distribuido bajo la licencia [Apache 2.0](LICENSE).
