<p align="center">
  <img src="assets/branding/dsh-codex-desktop-banner.webp" alt="Banner do DSH Codex Desktop" width="100%">
</p>

<div align="center">

# DSH Codex Desktop

**Baixe uma vez. Abra um espaço de trabalho de IA local pronto para usar.**

[简体中文](README.zh-CN.md) · [English](README.en.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

[Downloads](https://github.com/MichengAI/dsh-codex-desktop/releases) · [Registro de alterações](CHANGELOG.md) · [Relatar problema](https://github.com/MichengAI/dsh-codex-desktop/issues)

[![Release](https://img.shields.io/github/v/release/MichengAI/dsh-codex-desktop?display_name=tag&label=release)](https://github.com/MichengAI/dsh-codex-desktop/releases)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Desktop package](https://github.com/MichengAI/dsh-codex-desktop/actions/workflows/desktop-package.yml/badge.svg?branch=main)](https://github.com/MichengAI/dsh-codex-desktop/actions/workflows/desktop-package.yml)
![Windows x64](https://img.shields.io/badge/Windows-x64-0078D4?logo=windows&logoColor=white)
![macOS](https://img.shields.io/badge/macOS-Apple%20Silicon%20%7C%20Intel-000000?logo=apple&logoColor=white)
![Linux](https://img.shields.io/badge/Linux-x64%20%7C%20ARM64-FCC624?logo=linux&logoColor=black)

</div>

> O DSH Codex Desktop é uma distribuição de desktop mantida pela comunidade para o DeepSeek Harness. Não é um produto oficial da DeepSeek AI.

O DSH Codex Desktop transforma o [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) em uma estação de trabalho desktop nativa e pronta para uso. O instalador inclui o runtime Node.js necessário e o runtime local do DSH: basta instalar, abrir e começar a trabalhar sem necessidade de configurações manuais.

## Download e inicialização

Obtenha o instalador mais recente no [GitHub Releases](https://github.com/MichengAI/dsh-codex-desktop/releases).

| Plataforma | Pacote | Como começar |
| --- | --- | --- |
| Windows x64 | Instalador `.exe` ou arquivo `.zip` | Execute o instalador e abra o **DSH Codex Desktop** no menu Iniciar. |
| macOS Apple Silicon / Intel | Instalador `.dmg` | Abra a imagem de disco, mova o app para Aplicativos e execute. |
| Linux x64 / ARM64 | `.AppImage` ou pacote `.deb` para Debian/Ubuntu | Execute o AppImage para sua arquitetura ou instale o pacote deb. |

1. Baixe o pacote para seu sistema operacional.
2. Instale e abra o **DSH Codex Desktop**.
3. Aguarde o serviço local do DSH terminar de inicializar.
4. Crie uma tarefa, escolha o modelo e comece a produzir em seus projetos.

O aplicativo preserva os dados do DSH na sua pasta de perfil habitual (`%USERPROFILE%\.dsh` no Windows), mantendo suas sessões e configurações após atualizações.

## Estação de trabalho completa

| Recurso | O que você obtém |
| --- | --- |
| **Espaço de conversas** | Navegação por projetos, sessões, seleção de modelos e controle de permissões em janela nativa. |
| **Perfis de especialistas** | Ative papéis especializados para revisão de código, arquitetura, frontend, backend e operações. |
| **Central de habilidades** | Visualize, ative, desative e gerencie habilidades locais e compartilhadas de Agent nas Configurações. |
| **Gestão de arquivos** | Pesquise conversas arquivadas, restaure sessões ou exclua registros com segurança. |
| **Assistente de mensagens (IM)** | Integre canais como DingTalk, Feishu, Lark, WeChat, QQ, Telegram em um só lugar. |
| **Mercado de extensões** | Descubra, instale e atualize plugins DSH sem sair do cliente desktop. |
| **Automação agendada** | Programe tarefas recorrentes diretamente do mesmo espaço de trabalho. |
| **Ambiente local seguro** | Inicialização em endereço loopback validado com interface protegida. |

## Plugins incluídos por padrão

| Funcionalidade | Pacote |
| --- | --- |
| Interface no estilo Codex | [`@michengai/dsh-codex-ui`](https://github.com/MichengAI/dsh-codex-ui) |
| Mascote desktop e notificações | [`@michengai/dsh-codex-pet`](https://github.com/MichengAI/dsh-codex-pet) |
| Gestão de especialistas | [`@michengai/dsh-agency-agents`](https://github.com/MichengAI/dsh-agency-agents) |
| Gestão de habilidades | [`@michengai/dsh-skills-manager`](https://github.com/MichengAI/dsh-skills-manager) |
| Gestão de arquivos | [`@michengai/dsh-archive-manager`](https://github.com/MichengAI/dsh-archive-manager) |
| Assistente de mensagens | [`@michengai/dsh-im-connect`](https://github.com/MichengAI/dsh-im-connect) |
| Automação de tarefas | [`@michengai/dsh-automation`](https://github.com/MichengAI/dsh-automation) |
| Barra lateral expansível | [`dsh-better-sidebar`](https://github.com/omdsh-dev/DSH-better-sidebar) |
| Perguntas secundárias rápidas | [`@michengai/dsh-btw`](https://github.com/MichengAI/dsh-btw) |
| Simplificação de código Git | [`@michengai/dsh-simplify`](https://github.com/MichengAI/dsh-simplify) |
| Diagnóstico e recuperação de falhas | [`@michengai/dsh-pua`](https://github.com/MichengAI/dsh-pua) |
| Revisão de código independente | [`@michengai/dsh-code-review`](https://github.com/MichengAI/dsh-code-review) |
| Mercado de extensões | [`dshmarket`](https://www.npmjs.com/package/dshmarket) |

## Licença

Este projeto está licenciado sob a [Licença Apache 2.0](LICENSE).
