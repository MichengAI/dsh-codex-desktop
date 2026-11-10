import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import vm from "node:vm"
import { formatStartupProgress, parsePnpmProgress } from "../src/startup-progress.js"

test("安装计数只接受 pnpm 进度行，不把日志或路径显示给用户", () => {
  assert.deepEqual(parsePnpmProgress("Progress: resolved 15, reused 12, downloaded 3, added 8"), {
    phase: "install", detail: { resolved: 15, reused: 12, downloaded: 3, added: 8 },
  })
  assert.equal(parsePnpmProgress("ERR_PNPM_FAILED C:\Users\private"), undefined)
})

test("文件进度标明当前步骤，安装与启动不虚构百分比", () => {
  const files = formatStartupProgress({ phase: "sync", completed: 3, total: 4 }, true)
  assert.equal(files.completed, 3)
  assert.equal(files.total, 4)
  assert.match(files.message, /同步/)
  assert.match(files.detail, /3.*4/)
  assert.equal(formatStartupProgress({ phase: "server" }, false).total, undefined)
  assert.equal(formatStartupProgress({ phase: "server" }, true).message, "正在启动 DSH 并加载插件")
  assert.equal(formatStartupProgress({ phase: "server" }, false).message, "Starting DSH and loading plugins")
  assert.equal(formatStartupProgress({ phase: "install", detail: { resolved: 15, reused: 12, downloaded: 3, added: 8 } }, true).total, undefined)
})

test("启动进度完整覆盖 8 种支持语言", () => {
  const locales = ["zh", "en", "ja", "es", "fr", "de", "ru", "pt"] as const
  for (const locale of locales) {
    const res = formatStartupProgress({ phase: "server" }, locale)
    assert.ok(res.message)
    const detailRes = formatStartupProgress({ phase: "install", detail: { resolved: 1, reused: 2, downloaded: 3, added: 4 } }, locale)
    assert.match(detailRes.detail, /1.*2.*3.*4/)
  }
  assert.equal(formatStartupProgress({ phase: "server" }, "ja").message, "DSH を起動してプラグインを読み込み中")
  assert.equal(formatStartupProgress({ phase: "server" }, "de").message, "DSH wird gestartet und Plugins werden geladen")
  assert.equal(formatStartupProgress({ phase: "server" }, "fr").message, "Démarrage de DSH et chargement des extensions")
  assert.equal(formatStartupProgress({ phase: "server" }, "es").message, "Iniciando DSH y cargando complementos")
  assert.equal(formatStartupProgress({ phase: "server" }, "ru").message, "Запуск DSH и загрузка плагинов")
  assert.equal(formatStartupProgress({ phase: "server" }, "pt").message, "Iniciando DSH e carregando plugins")
})

test("startup.html 在 8 种语言下精确渲染首帧文本且未支持语言安全回退英文", () => {
  const html = readFileSync(join(import.meta.dirname, "../../assets/startup.html"), "utf8")
  const start = html.lastIndexOf("<script>")
  const end = html.lastIndexOf("</script>")
  assert.ok(start !== -1 && end !== -1 && end > start)
  const scriptCode = html.slice(start + "<script>".length, end)

  const expectedMsg: Record<string, string> = {
    zh: "正在启动",
    en: "Starting",
    ja: "起動中",
    es: "Iniciando",
    fr: "Démarrage en cours",
    de: "Wird gestartet",
    ru: "Запуск",
    pt: "Iniciando",
  }
  const expectedWorking: Record<string, string> = {
    zh: "正在处理",
    en: "Working",
    ja: "処理中",
    es: "Procesando",
    fr: "Traitement en cours",
    de: "In Bearbeitung",
    ru: "Обработка",
    pt: "Processando",
  }

  const runStartupWithLocale = (lang: string) => {
    const elements: Record<string, { textContent?: string; setAttribute?: () => void; removeAttribute?: () => void }> = {
      progress: { setAttribute: () => {}, removeAttribute: () => {} },
      msg: { textContent: "" },
      percentage: { textContent: "" },
      detail: { textContent: "" },
      elapsed: { textContent: "" },
    }
    const sandbox: any = {
      location: { search: "?lang=" + lang },
      navigator: { language: lang },
      document: {
        documentElement: { lang: "", dataset: {} },
        getElementById: (id: string) => elements[id] ?? { setAttribute: () => {}, textContent: "" },
        body: { dataset: {} },
      },
      window: {},
      Date,
      Math,
      Number,
      URLSearchParams,
      setInterval: () => 0,
      clearInterval: () => {},
    }
    sandbox.window = sandbox
    vm.runInNewContext(scriptCode, sandbox, { timeout: 1000 })
    return { sandbox, elements }
  }

  const locales = ["zh", "en", "ja", "es", "fr", "de", "ru", "pt"]
  for (const lang of locales) {
    const { sandbox, elements } = runStartupWithLocale(lang)
    assert.ok(typeof sandbox.window.updateStartupProgress === "function")
    assert.equal(elements.msg.textContent, expectedMsg[lang])
    assert.equal(elements.percentage.textContent, expectedWorking[lang])
  }

  // 测试未知语种安全 fallback 到英文
  const { elements: fallbackElements } = runStartupWithLocale("it")
  assert.equal(fallbackElements.msg.textContent, "Starting")
  assert.equal(fallbackElements.percentage.textContent, "Working")
})

test("recovery.html 在 8 种语言下精确渲染对应标题且未支持语言安全回退英文", () => {
  const html = readFileSync(join(import.meta.dirname, "../../assets/recovery.html"), "utf8")
  const start = html.lastIndexOf("<script>")
  const end = html.lastIndexOf("</script>")
  assert.ok(start !== -1 && end !== -1 && end > start)
  const scriptCode = html.slice(start + "<script>".length, end)

  const expectedTitles: Record<string, string> = {
    zh: "DSH Codex Desktop 恢复",
    en: "DSH Codex Desktop Recovery",
    ja: "DSH Codex Desktop 復元",
    es: "Recuperación de DSH Codex Desktop",
    fr: "Récupération de DSH Codex Desktop",
    de: "DSH Codex Desktop Wiederherstellung",
    ru: "Восстановление DSH Codex Desktop",
    pt: "Recuperação do DSH Codex Desktop",
  }

  const runRecoveryWithLocale = (lang: string) => {
    const el = () => ({ textContent: "", setAttribute: () => {}, removeAttribute: () => {}, classList: { add: () => {}, remove: () => {}, toggle: () => {} }, addEventListener: () => {}, showModal: () => {}, close: () => {} })
    const sandbox: any = {
      location: { search: "?lang=" + lang },
      navigator: { language: lang },
      matchMedia: () => ({ matches: false, addEventListener: () => {} }),
      document: {
        documentElement: { lang: "", dataset: {} },
        title: "",
        querySelector: () => el(),
        querySelectorAll: () => [],
        getElementById: () => el(),
        addEventListener: () => {},
      },
      window: {
        dshRecovery: {
          getStatus: async () => ({ active: false, running: false }),
        },
      },
      URLSearchParams,
      Date,
      Math,
      Number,
      String,
    }
    sandbox.window.matchMedia = sandbox.matchMedia
    vm.runInNewContext(scriptCode, sandbox, { timeout: 1000 })
    return sandbox
  }

  const locales = ["zh", "en", "ja", "es", "fr", "de", "ru", "pt"]
  for (const lang of locales) {
    const sandbox = runRecoveryWithLocale(lang)
    assert.equal(sandbox.document.title, expectedTitles[lang])
  }

  // 测试未知语种安全 fallback 到英文
  const fallbackSandbox = runRecoveryWithLocale("ko")
  assert.equal(fallbackSandbox.document.title, "DSH Codex Desktop Recovery")
})
