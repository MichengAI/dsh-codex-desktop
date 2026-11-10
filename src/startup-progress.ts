import type { SupportedShellLocale } from './shell-actions.js'

/** 启动任务的实际计量；没有总量的任务保持不确定进度。 */
export interface StartupProgress {
  phase: 'verify' | 'extract' | 'copy' | 'scan' | 'sync' | 'index' | 'install' | 'server' | 'renderer'
  completed?: number
  total?: number
  unit?: 'bytes' | 'files' | 'entries'
  detail?: { resolved: number; reused: number; downloaded: number; added: number }
}

export function parsePnpmProgress(line: string): StartupProgress | undefined {
  const match = /^Progress: resolved (\d+), reused (\d+), downloaded (\d+), added (\d+)/.exec(line)
  if (!match) return undefined
  const [resolved, reused, downloaded, added] = match.slice(1).map(Number)
  return { phase: 'install', detail: { resolved, reused, downloaded, added } }
}

const PHASE_LABELS: Record<StartupProgress['phase'], Record<SupportedShellLocale, string>> = {
  verify: {
    zh: '正在校验随包资源',
    en: 'Verifying bundled resources',
    ja: '付属リソースを検証中',
    es: 'Verificando recursos incluidos',
    fr: 'Vérification des ressources incluses',
    de: 'Gebündelte Ressourcen werden überprüft',
    ru: 'Проверка встроенных ресурсов',
    pt: 'Verificando recursos incluídos',
  },
  extract: {
    zh: '正在解压随包资源',
    en: 'Extracting bundled resources',
    ja: '付属リソースを展開中',
    es: 'Extrayendo recursos incluidos',
    fr: 'Extraction des ressources incluses',
    de: 'Gebündelte Ressourcen werden entpackt',
    ru: 'Распаковка встроенных ресурсов',
    pt: 'Extraindo recursos incluídos',
  },
  copy: {
    zh: '正在写入运行环境文件',
    en: 'Writing runtime files',
    ja: '実行環境ファイルを書き込み中',
    es: 'Escribiendo archivos de entorno de ejecución',
    fr: "Écriture des fichiers de l'environnement d'exécution",
    de: 'Laufzeitdateien werden geschrieben',
    ru: 'Запись файлов среды выполнения',
    pt: 'Gravando arquivos do ambiente de execução',
  },
  scan: {
    zh: '正在统计配套依赖文件',
    en: 'Counting bundled dependency files',
    ja: '付属依存ファイルをカウント中',
    es: 'Contando archivos de dependencias incluidas',
    fr: 'Comptage des fichiers de dépendances incluses',
    de: 'Gebündelte Abhängigkeitsdateien werden gezählt',
    ru: 'Подсчет файлов встроенных зависимостей',
    pt: 'Contando arquivos de dependências incluídas',
  },
  sync: {
    zh: '正在同步配套依赖文件',
    en: 'Syncing bundled dependency files',
    ja: '付属依存ファイルを同期中',
    es: 'Sincronizando archivos de dependencias incluidas',
    fr: 'Synchronisation des fichiers de dépendances incluses',
    de: 'Gebündelte Abhängigkeitsdateien werden synchronisiert',
    ru: 'Синхронизация файлов встроенных зависимостей',
    pt: 'Sincronizando arquivos de dependências incluídas',
  },
  index: {
    zh: '正在更新依赖索引',
    en: 'Updating the dependency index',
    ja: '依存インデックスを更新中',
    es: 'Actualizando el índice de dependencias',
    fr: "Mise à jour de l'index des dépendances",
    de: 'Abhängigkeitsindex wird aktualisiert',
    ru: 'Обновление индекса зависимостей',
    pt: 'Atualizando índice de dependências',
  },
  install: {
    zh: '正在安装插件及依赖',
    en: 'Installing plugins and dependencies',
    ja: 'プラグインと依存関係をインストール中',
    es: 'Instalando complementos y dependencias',
    fr: 'Installation des extensions et des dépendances',
    de: 'Plugins und Abhängigkeiten werden installiert',
    ru: 'Установка плагинов и зависимостей',
    pt: 'Instalando plugins e dependências',
  },
  server: {
    zh: '正在启动 DSH 并加载插件',
    en: 'Starting DSH and loading plugins',
    ja: 'DSH を起動してプラグインを読み込み中',
    es: 'Iniciando DSH y cargando complementos',
    fr: 'Démarrage de DSH et chargement des extensions',
    de: 'DSH wird gestartet und Plugins werden geladen',
    ru: 'Запуск DSH и загрузка плагинов',
    pt: 'Iniciando DSH e carregando plugins',
  },
  renderer: {
    zh: '正在加载工作界面',
    en: 'Loading the workspace',
    ja: 'ワークスペースを読み込み中',
    es: 'Cargando la mesa de trabajo',
    fr: "Chargement de l'espace de travail",
    de: 'Arbeitsbereich wird geladen',
    ru: 'Загрузка рабочей области',
    pt: 'Carregando área de trabalho',
  },
}

export function formatStartupProgress(progress: StartupProgress, localeOrZh: SupportedShellLocale | boolean): {
  message: string; detail: string; completed?: number; total?: number
} {
  const lang: SupportedShellLocale = typeof localeOrZh === 'boolean'
    ? (localeOrZh ? 'zh' : 'en')
    : localeOrZh

  let detail = ''
  const { completed, total } = progress
  const measured = Number.isFinite(completed) && Number.isFinite(total) && total! > 0 && completed! >= 0 && completed! <= total!
  if (measured) {
    if (progress.unit === 'bytes') {
      detail = `${(completed! / 1048576).toFixed(1)} / ${(total! / 1048576).toFixed(1)} MB`
    } else {
      const unitMap: Record<SupportedShellLocale, { entries: string; syncFiles: string; files: string }> = {
        zh: { entries: '项', syncFiles: '个文件（含已存在）', files: '个文件' },
        en: { entries: 'entries', syncFiles: 'files (including existing files)', files: 'files' },
        ja: { entries: '項目', syncFiles: '個のファイル（既存を含む）', files: '個のファイル' },
        es: { entries: 'entradas', syncFiles: 'archivos (incluidos existentes)', files: 'archivos' },
        fr: { entries: 'éléments', syncFiles: 'fichiers (existants inclus)', files: 'fichiers' },
        de: { entries: 'Einträge', syncFiles: 'Dateien (inkl. vorhandener)', files: 'Dateien' },
        ru: { entries: 'эл.', syncFiles: 'файлов (включая существующие)', files: 'файлов' },
        pt: { entries: 'itens', syncFiles: 'arquivos (incluindo existentes)', files: 'arquivos' },
      }
      const u = unitMap[lang] ?? unitMap.en
      const unitLabel = progress.unit === 'entries'
        ? u.entries
        : progress.phase === 'sync'
          ? u.syncFiles
          : u.files
      detail = `${completed!.toLocaleString()} / ${total!.toLocaleString()} ${unitLabel}`
    }
  }
  if (progress.detail) {
    const { resolved, reused, downloaded, added } = progress.detail
    const detailMap: Record<SupportedShellLocale, string> = {
      zh: `已解析 ${resolved} · 已复用 ${reused} · 已下载 ${downloaded} · 已安装 ${added}`,
      en: `Resolved ${resolved} · Reused ${reused} · Downloaded ${downloaded} · Added ${added}`,
      ja: `解決済み ${resolved} · 再利用 ${reused} · ダウンロード済み ${downloaded} · インストール済み ${added}`,
      es: `Resueltos ${resolved} · Reutilizados ${reused} · Descargados ${downloaded} · Instalados ${added}`,
      fr: `Résolus ${resolved} · Réutilisés ${reused} · Téléchargés ${downloaded} · Installés ${added}`,
      de: `Aufgelöst ${resolved} · Wiederverwendet ${reused} · Heruntergeladen ${downloaded} · Installiert ${added}`,
      ru: `Разрешено ${resolved} · Переиспользовано ${reused} · Загружено ${downloaded} · Установлено ${added}`,
      pt: `Resolvidos ${resolved} · Reutilizados ${reused} · Baixados ${downloaded} · Instalados ${added}`,
    }
    detail = detailMap[lang] ?? detailMap.en
  }
  const labelObj = PHASE_LABELS[progress.phase]
  const message = labelObj[lang] ?? labelObj.en
  return {
    message,
    detail,
    ...(measured ? { completed, total } : {}),
  }
}
