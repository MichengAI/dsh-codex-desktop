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
})

test("startup.html 在 8 种语言下均可正常执行且无未定义变量引用", () => {
  const html = readFileSync(join(import.meta.dirname, "../../assets/startup.html"), "utf8")
  const start = html.lastIndexOf("<script>")
  const end = html.lastIndexOf("</script>")
  assert.ok(start !== -1 && end !== -1 && end > start)
  const scriptCode = html.slice(start + "<script>".length, end)

  const locales = ["zh", "en", "ja", "es", "fr", "de", "ru", "pt"]
  for (const lang of locales) {
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
    vm.runInNewContext(scriptCode, sandbox)
    assert.ok(typeof sandbox.window.updateStartupProgress === "function")
    assert.ok(elements.msg.textContent)
    assert.ok(elements.percentage.textContent)
  }
})

test("recovery.html 在 8 种语言下均可正常执行且无未定义变量引用", () => {
  const html = readFileSync(join(import.meta.dirname, "../../assets/recovery.html"), "utf8")
  const start = html.lastIndexOf("<script>")
  const end = html.lastIndexOf("</script>")
  assert.ok(start !== -1 && end !== -1 && end > start)
  const scriptCode = html.slice(start + "<script>".length, end)

  const locales = ["zh", "en", "ja", "es", "fr", "de", "ru", "pt"]
  for (const lang of locales) {
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
    vm.runInNewContext(scriptCode, sandbox)
    assert.ok(sandbox.document.title)
  }
})
