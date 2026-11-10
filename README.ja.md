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

追加のプラグインはプラグインマーケットから後から管理できます。デスクトップアプリは独自のランタイムをプロファイルにインストールされたコミュニティプラグインから分離して保持するため、プラグインの変更によってアプリのランタイムが上書きされることはありません。

デスクトップブリッジはアプリに付属し、デスクトップが DSH を起動するときにのみ注入されます。共有 Web プロファイルにインストールする必要はありません。手動で `dsh web` を実行すると、Web 独自のプラグイン管理パスが使用されます。

## DSH プロダクトエコシステム

デスクトップワークベンチをご利用の場合は、[DSH Codex Desktop](https://github.com/MichengAI/dsh-codex-desktop/releases) をダウンロードしてください。既存の [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) のインストール環境では、各プロジェクトの README に従って必要に応じてプラグインを追加できます。以下は 11 の公式コミュニティプラグインです：

| プラグイン | できること |
| --- | --- |
| [Codex UI](https://github.com/MichengAI/dsh-codex-ui) | プロジェクトと対話の整理、タスク検索、チャットターンのナビゲーション |
| [Agency Agents](https://github.com/MichengAI/dsh-agency-agents) | タスクに適した専門家ロールの選択と召喚 |
| [Skills Manager](https://github.com/MichengAI/dsh-skills-manager) | ローカルスキルの検索、有効化、作成、インポート |
| [Archive Manager](https://github.com/MichengAI/dsh-archive-manager) | アーカイブされた対話の検索、復元、クリーンアップ |
| [IM Connect](https://github.com/MichengAI/dsh-im-connect) | メッセージングプラットフォーム経由でのタスク送信と返信の受信 |
| [Automation](https://github.com/MichengAI/dsh-automation) | タスクのスケジュール設定と実行履歴の確認 |
| [BTW](https://github.com/MichengAI/dsh-btw) | メインタスクを中断せずにサイド質問を行う |
| [Simplify](https://github.com/MichengAI/dsh-simplify) | `/simplify` を使用して Git の変更範囲内のコードを簡素化 |
| [PUA](https://github.com/MichengAI/dsh-pua) | 失敗後に Agent に別のアプローチを促し、原因を調査して完了前に結果を検証 |
| [Code Review](https://github.com/MichengAI/dsh-code-review) | `/review` で独立した Agent コードレビューを要求し、チャット内でレポートを受信 |
| [Codex Pet](https://github.com/MichengAI/dsh-codex-pet) | デスクトップペットを通じて対話の通知を確認し、ツールの承認や質問に応答 |

デスクトップアプリは、ファイルナビゲーションやプラグインの発見・インストールのために [DSH Better Sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) および [App Market](https://www.npmjs.com/package/dshmarket) もサードパーティプラグインとして統合しています。

## アップデートと復元

- **デスクトップアプリアップデート**：起動後に自動で更新を確認し、新バージョンがある場合に通知します。設定 → アップデートから自動ダウンロードや手動確認のみに変更できます。インストールと再起動には必ず明示的なアクションが必要です。Zip ビルドは新バージョンの確認のみを行い、インストーラーをダウンロードしません。Releases から新しい zip をダウンロードし、終了後に現在のフォルダーを置き換えてください。
- **DSH 再読み込み**：プラグインやプロファイル構成を変更した後、トレイメニューからローカル DSH サービスを即座に再起動できます。デスクトップアプリを再インストールする必要はありません。
- **プラグインアップデート**：DSH の設定とプラグインマーケットから行えます。インストールの失敗したプラグインは実行中バンドルとしてアクティブ化されません。
- **起動復元モード**：インストールされたパッケージが存在しない古いコミュニティプラグインの登録を削除し、ローカル DSH の起動を安全に再試行します。

## システム要件 (System requirements)

| 項目 | 要件 |
| --- | --- |
| オペレーティングシステム | Windows 10/11、macOS、Linux |
| CPU アーキテクチャ | Windows x64、macOS arm64/x64、Linux x64/arm64 |
| Node.js | エンドユーザーには不要（アプリに同梱） |
| ネットワーク | 使用するモデルプロバイダー、プラグインのダウンロード、各種ツールでのみ必要 |

## プライバシーとセキュリティ (Privacy and security)

- DSH の設定、セッション、資格情報は現在のユーザーの DSH ディレクトリ内に保持されます。デスクトップアプリをアンインストールしてもこれらは削除されません。
- ランチャーは、組み込みウィンドウ用に検証済みの `127.0.0.1` ローカル HTTP アドレスのみを受け入れます。
- 外部の HTTP(S) リンクはシステムブラウザで開きます。ファイル、JavaScript、データ URL はブロックされます。
- Electron はコンテキスト分離とサンドボックス化を使用し、DSH ページでは Node.js 統合が無効化されています。
- 設定したモデルプロバイダーや DSH ツールは独自のネットワークリクエストを行う場合があります。使用前にそれぞれの設定とプライバシーポリシーをご確認ください。

## 開発 (Development)

引継ぎドキュメント：[技術アーキテクチャベースライン要約](docs/00-交接入口/05-技术架构基线.md) · [デスクトップランチャーアーキテクチャベースライン](docs/03-技术架构/00-桌面启动器架构基线.md)。

Windows パッケージングジョブは、成果物のアップロード前に `pnpm smoke:upgrade <old-exe> <new-exe>` を実行します。開発には Windows、Node.js `24.21.0`、pnpm `11.26.0` が必要です。

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
pnpm install --frozen-lockfile
pnpm test
pnpm run dist
```

## ライセンス (License)

本プロジェクトは [Apache License 2.0](LICENSE) の下で公開されています。
