<p align="center">
  <img src="assets/branding/dsh-codex-desktop-banner.webp" alt="DSH Codex Desktop プロダクトバナー" width="100%">
</p>

<div align="center">

# DSH Codex Desktop

**一度ダウンロードすれば、すぐに使えるローカル AI ワークスペース。**

[简体中文](README.zh-CN.md) · [English](README.en.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

[ダウンロード](https://github.com/MichengAI/dsh-codex-desktop/releases) · [更新履歴](CHANGELOG.md) · [問題を報告](https://github.com/MichengAI/dsh-codex-desktop/issues)

[![Release](https://img.shields.io/github/v/release/MichengAI/dsh-codex-desktop?display_name=tag&label=release)](https://github.com/MichengAI/dsh-codex-desktop/releases)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Desktop package](https://github.com/MichengAI/dsh-codex-desktop/actions/workflows/desktop-package.yml/badge.svg?branch=main)](https://github.com/MichengAI/dsh-codex-desktop/actions/workflows/desktop-package.yml)
![Windows x64](https://img.shields.io/badge/Windows-x64-0078D4?logo=windows&logoColor=white)
![macOS](https://img.shields.io/badge/macOS-Apple%20Silicon%20%7C%20Intel-000000?logo=apple&logoColor=white)
![Linux](https://img.shields.io/badge/Linux-x64%20%7C%20ARM64-FCC624?logo=linux&logoColor=black)

</div>

> DSH Codex Desktop はコミュニティによってメンテナンスされている DeepSeek Harness のデスクトップディストリビューションであり、DeepSeek AI の公式製品ではありません。

DSH Codex Desktop は [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) をネイティブですぐに実行できるデスクトップワークベンチにします。インストーラーには必要な Node.js ランタイムとローカル DSH ランタイムが含まれており、インストールして開くだけですぐに作業を開始できます。Node.js 環境を個別に用意したり、ターミナルから DSH を起動したりする必要はありません。

## ダウンロードと開始

[GitHub Releases](https://github.com/MichengAI/dsh-codex-desktop/releases) から最新のインストーラーを入手してください。

| プラットフォーム | パッケージ | 開始手順 |
| --- | --- | --- |
| Windows x64 | `.exe` インストーラーまたは `.zip` アーカイブ | インストーラーを実行し、スタートメニューから **DSH Codex Desktop** を開きます。 |
| macOS Apple Silicon / Intel | `.dmg` インストーラー | ディスクイメージを開き、アプリケーションフォルダーに移動して起動します。 |
| Linux x64 / ARM64 | `.AppImage` または Debian / Ubuntu `.deb` | CPU アーキテクチャに一致するパッケージを実行するか、deb パッケージをインストールして起動します。 |

1. ご利用のプラットフォームに対応するパッケージをダウンロードします。
2. **DSH Codex Desktop** をインストールして開きます。
3. 内蔵のローカル DSH サービスが起動完了するまで待ちます。
4. タスクを作成し、モデルと権限モードを選択してプロジェクト作業を開始します。

本アプリケーションは既存のユーザープロファイル（Windows では `%USERPROFILE%\.dsh`）に DSH データを保持するため、アプリアップデート後もセッションや設定はそのまま維持されます。

## 完全なデスクトップワークベンチ

| 機能 | 提供内容 |
| --- | --- |
| **デスクトップ対話ワークスペース** | プロジェクトおよびタスクナビゲーション、対話セッション、モデル選択、権限管理、セッションログ、集中できるデスクトップウィンドウ。 |
| **専門家プリセット** | コードレビュー、アーキテクチャ、フロントエンド、バックエンド、インフラ運用など、業務に応じた専門家ロールの呼び出し。 |
| **スキルセンター** | 設定からローカルおよび共有 Agent スキルの確認、有効化、無効化、アップロード、一元管理。 |
| **アーカイブ管理** | 過去の会話の検索、必要に応じたセッションの復元、またはアーカイブの完全削除。 |
| **IM アシスタント** | DingTalk、Feishu、Lark、WeChat、WeCom、QQ、Telegram など利用可能なチャネルを一箇所で設定。 |
| **プラグインマーケット** | デスクトップクライアントから離れることなく、DSH プラグインの発見、インストール、更新、有効化、診断が可能。 |
| **定期自動化** | 内蔵の DSH スケジューリング機能を使用して、同じワークスペースから反復タスクを管理。 |
| **安全なローカルランタイム** | 検証済みのループバックアドレスで DSH を起動し、ブラウザ UI をデスクトップシェル内に安全に保護。 |

## 製品プレビュー

デスクトップワークスペース、ライトテーマ設定、プラグイン管理ページをご確認いただけます。画像をクリックすると元の解像度で表示されます。

<p align="center"><em>ホーム：プロジェクトナビゲーション、タスク入口、コンポーザー。</em></p>

<p align="center"><a href="assets/screenshots/preview-home.webp"><img src="assets/screenshots/preview-home.webp" alt="ホーム：プロジェクトナビゲーション、タスク入口、コンポーザー。" width="960"></a></p>

<p align="center"><em>対話画面：メッセージ、実行軌跡、コンテキスト、タスク入力。</em></p>

<p align="center"><a href="assets/screenshots/preview-conversation.webp"><img src="assets/screenshots/preview-conversation.webp" alt="対話画面：メッセージ、実行軌跡、コンテキスト、タスク入力。" width="960"></a></p>

<details>
<summary>外観とデスクトップペット（スクリーンショット 2 枚）</summary>

<p align="center"><em>ライトテーマ設定：権限、言語、外観、エディター設定。</em></p>

<p align="center"><a href="assets/screenshots/preview-general-light.webp"><img src="assets/screenshots/preview-general-light.webp" alt="ライトテーマ設定：権限、言語、外観、エディター設定。" width="960"></a></p>

<p align="center"><em>ペット設定：仲間の選択、カスタムペットの管理、サイズ調整。</em></p>

<p align="center"><a href="assets/screenshots/preview-pets.webp"><img src="assets/screenshots/preview-pets.webp" alt="ペット設定：仲間の選択、カスタムペットの管理、サイズ調整。" width="960"></a></p>

</details>

<details>
<summary>自研プラグインページ（スクリーンショット 6 枚）</summary>

<p align="center"><em>専門家プリセット：専門家ロールの絞り込み、検索、有効化。</em></p>

<p align="center"><a href="assets/screenshots/preview-experts.webp"><img src="assets/screenshots/preview-experts.webp" alt="専門家プリセット：専門家ロールの絞り込み、検索、有効化。" width="960"></a></p>

<p align="center"><em>スキル管理：各ソースのローカル Agent スキルを一元管理。</em></p>

<p align="center"><a href="assets/screenshots/preview-skills.webp"><img src="assets/screenshots/preview-skills.webp" alt="スキル管理：各ソースのローカル Agent スキルを一元管理。" width="960"></a></p>

<p align="center"><em>定期自動化：タスクスケジュールおよび実行履歴へのアクセス。</em></p>

<p align="center"><a href="assets/screenshots/preview-automation.webp"><img src="assets/screenshots/preview-automation.webp" alt="定期自動化：タスクスケジュールおよび実行履歴へのアクセス。" width="960"></a></p>

<p align="center"><em>IM アシスタント：メッセージングチャネル、アカウント、受信メッセージの管理。</em></p>

<p align="center"><a href="assets/screenshots/preview-im-connect.webp"><img src="assets/screenshots/preview-im-connect.webp" alt="IM アシスタント：メッセージングチャネル、アカウント、受信メッセージの管理。" width="960"></a></p>

<p align="center"><em>アーカイブ会話：プロジェクトごとの絞り込み、検索、過去のチャットの復元。</em></p>

<p align="center"><a href="assets/screenshots/preview-archive.webp"><img src="assets/screenshots/preview-archive.webp" alt="アーカイブ会話：プロジェクトごとの絞り込み、検索、過去のチャットの復元。" width="960"></a></p>

<p align="center"><em>Codex UI 設定：機能の概要と連携プラグインのインストール状態。</em></p>

<p align="center"><a href="assets/screenshots/preview-codex-ui.webp"><img src="assets/screenshots/preview-codex-ui.webp" alt="Codex UI 設定：機能の概要と連携プラグインのインストール状態。" width="960"></a></p>

</details>

<details>
<summary>コミュニティプラグインページ（スクリーンショット 4 枚）</summary>

<p align="center"><em>コンテキスト設定</em></p>

<p align="center"><a href="assets/screenshots/preview-context.webp"><img src="assets/screenshots/preview-context.webp" alt="コンテキスト設定" width="960"></a></p>

<p align="center"><em>サイドバー設定</em></p>

<p align="center"><a href="assets/screenshots/preview-sidebar.webp"><img src="assets/screenshots/preview-sidebar.webp" alt="サイドバー設定" width="960"></a></p>

<p align="center"><em>プラグインマーケット：コミュニティプラグインの発見とインストール・更新状況の確認。</em></p>

<p align="center"><a href="assets/screenshots/preview-plugin-market.webp"><img src="assets/screenshots/preview-plugin-market.webp" alt="プラグインマーケット：コミュニティプラグインの発見とインストール・更新状況の確認。" width="960"></a></p>

</details>

## 初回起動時の同梱プラグイン

インストーラーには DSH の起動に必要なローカルランタイムが含まれています。初回起動時に、Web プロファイル内に以下のコミュニティプラグインが自動配置されます：

| 同梱機能 | パッケージ |
| --- | --- |
| Codex 風ワークスペース UI | [`@michengai/dsh-codex-ui`](https://github.com/MichengAI/dsh-codex-ui) |
| ネイティブデスクトップペット＆通知 | [`@michengai/dsh-codex-pet`](https://github.com/MichengAI/dsh-codex-pet) |
| 専門家プリセット管理 | [`@michengai/dsh-agency-agents`](https://github.com/MichengAI/dsh-agency-agents) |
| スキル管理 | [`@michengai/dsh-skills-manager`](https://github.com/MichengAI/dsh-skills-manager) |
| アーカイブ管理 | [`@michengai/dsh-archive-manager`](https://github.com/MichengAI/dsh-archive-manager) |
| IM アシスタント | [`@michengai/dsh-im-connect`](https://github.com/MichengAI/dsh-im-connect) |
| 定期自動化 | [`@michengai/dsh-automation`](https://github.com/MichengAI/dsh-automation) |
| 拡張可能サイドバー | [`dsh-better-sidebar`](https://github.com/omdsh-dev/DSH-better-sidebar) |
| 読み取り専用サイド質問 | [`@michengai/dsh-btw`](https://github.com/MichengAI/dsh-btw) |
| Git 変更範囲のコード簡素化 | [`@michengai/dsh-simplify`](https://github.com/MichengAI/dsh-simplify) |
| 失敗時の自動再試行・診断・検証 | [`@michengai/dsh-pua`](https://github.com/MichengAI/dsh-pua) |
| 独立 Agent コードレビュー | [`@michengai/dsh-code-review`](https://github.com/MichengAI/dsh-code-review) |
| プラグインマーケット | [`dshmarket`](https://www.npmjs.com/package/dshmarket) |

## アップデートと復元

- **デスクトップアプリアップデート**：起動後に自動で更新を確認し、新バージョンがある場合に通知します。設定 → アップデートから自動ダウンロードや手動確認のみに変更できます。
- **DSH 再読み込み**：トレイメニューからローカル DSH サービスを即座に再起動できます。
- **プラグイン復元モード**：万一プラグインの不具合で DSH が起動に失敗した場合、隔離と復元の専用画面が起動し、安全に復旧できます。

## ライセンス

本プロジェクトは [Apache License 2.0](LICENSE) の下で公開されています。
