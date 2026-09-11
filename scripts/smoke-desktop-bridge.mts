import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { prepareDesktopBridge } from '../src/desktop-host.js'
import { migrateDesktopBridgeProfile } from '../src/desktop-bridge-migration.js'
import { startDsh } from '../src/dsh-process.js'
import { BUNDLED_PLUGINS } from '../src/bundled-plugins.js'

// 使用随包真实运行时及隔离 DSH_HOME，验证启动 overlay 的 host/client 加载闭环。
const project = resolve(import.meta.dirname, '..', '..')
const runtime = resolve(process.argv[2] ?? join(project, 'runtime-dsh'))
const root = await mkdtemp(join(tmpdir(), 'dsh-bridge-smoke-'))
const profile = join(root, 'home', 'profiles', 'web')
const playwrightPath = process.env.DSH_TEST_PLAYWRIGHT
const browser = playwrightPath ? await createRequire(import.meta.url)(playwrightPath).chromium.launch({ channel: process.env.DSH_TEST_BROWSER_CHANNEL ?? 'msedge', headless: true }) : undefined
try {
  await mkdir(profile, { recursive: true })
  const pluginSource = process.env.DSH_BRIDGE_SMOKE_PLUGINS
  const allBundled = pluginSource !== undefined && process.env.DSH_BRIDGE_SMOKE_ALL_BUNDLED === '1'
  const community = pluginSource ? (allBundled ? BUNDLED_PLUGINS.map(plugin => plugin.packageName) : ['dshmarket', '@michengai/dsh-codex-ui']) : []
  if (allBundled) {
    await cp(join(resolve(pluginSource!), 'node_modules'), join(profile, 'node_modules'), { recursive: true })
  }
  for (const name of allBundled ? [] : community) {
    const target = join(profile, 'node_modules', name)
    await mkdir(dirname(target), { recursive: true })
    await cp(join(resolve(pluginSource!), 'node_modules', name), target, { recursive: true })
  }
  if (pluginSource) {
    for (const name of allBundled ? [] : ['js-yaml', 'undici']) {
      await symlink(join(resolve(pluginSource), 'node_modules', name), join(profile, 'node_modules', name), process.platform === 'win32' ? 'junction' : 'dir')
    }
    await symlink(join(runtime, 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai'), join(profile, 'node_modules', '@deepseek-ai'), process.platform === 'win32' ? 'junction' : 'dir')
  }
  const manifest = `${JSON.stringify({ name: 'dsh-profile-web', private: true, dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', ...community], patchReload: 'live' } } }, undefined, 2)}\n`
  await writeFile(join(profile, 'package.json'), manifest, 'utf8')
  await writeFile(join(profile, 'cordis.patch.yml'), '[]\n', 'utf8')
  const bridgePatch = prepareDesktopBridge(join(root, 'Desktop 私有资源'), join(project, 'dist', 'src'))
  // 模拟旧版写入共享 profile 的桥接包；迁移后验证真实 Desktop、重载和 Web 均可启动。
  const legacyBridge = join(profile, 'node_modules', 'dsh-desktop-bridge')
  await mkdir(legacyBridge, { recursive: true })
  await writeFile(join(legacyBridge, 'package.json'), JSON.stringify({ name: 'dsh-desktop-bridge', type: 'module', main: './index.js' }), 'utf8')
  await writeFile(join(legacyBridge, 'index.js'), 'throw new Error("旧 bridge 不应再加载")\n', 'utf8')
  const legacyManifest = JSON.parse(manifest)
  legacyManifest.dsh.profile.bundles.push('dsh-desktop-bridge')
  await writeFile(join(profile, 'package.json'), JSON.stringify(legacyManifest), 'utf8')
  await writeFile(join(profile, 'cordis.patch.yml'), '- id: dsh-desktop-bridge\n  name: dsh-desktop-bridge\n', 'utf8')
  migrateDesktopBridgeProfile(profile)
  assert.equal(existsSync(legacyBridge), false)
  const bridgeRows = JSON.parse(await readFile(bridgePatch, 'utf8'))
  const probePath = join(root, 'probe.mjs')
  const resultPath = join(root, 'result.json')
  await writeFile(probePath, `import { writeFileSync } from 'node:fs';
export function apply(ctx) {
  ctx.effect(() => {
    let pnpmStarted = false;
    let pnpmExit;
    const timer = setInterval(() => {
      const profiles = ctx.get('desktopProfiles');
      const pnpm = ctx.get('desktopPnpm');
      const modules = ctx.get('clientModules');
      if (pnpm && !pnpmStarted) {
        pnpmStarted = true;
        const handle = pnpm.run(['--version']);
        handle.stdout.resume();
        handle.stderr.resume();
        handle.done.then(result => { pnpmExit = result.exitCode; });
      }
      const plugins = [...ctx.loader.entries()].map(entry => ({ name: entry.options.name, state: entry.fiber?.state, error: entry.fiber?.error?.message }));
      writeFileSync(process.env.DSH_BRIDGE_PROBE, JSON.stringify({ profiles: !!profiles, pnpm: !!pnpm, pnpmExit, graph: modules?.graph(), plugins }), 'utf8');
    }, 100);
    return () => clearInterval(timer);
  });
}
`, 'utf8')
  const probeRow = { insert: [{ id: 'desktop-smoke-probe', name: pathToFileURL(probePath).href }] }
  for (const mode of ['desktop', 'reload', 'web'] as const) {
    const desktop = mode !== 'web'
    const patch = join(root, 'launch.patch.yml')
    await writeFile(patch, JSON.stringify([...desktop ? bridgeRows : [], probeRow]), 'utf8')
    await rm(resultPath, { force: true })
    // Web 直接使用共享 profile，不附加 overlay 或 Desktop 标识。
    const server = await startDsh({
      bootstrapPath: join(project, 'dist', 'src', 'dsh-bootstrap.mjs'),
      desktopBridgePatch: desktop ? patch : undefined,
      runtime: { root: runtime, entry: join(runtime, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js') },
      nodeExecutable: join(project, 'runtime-node', process.platform === 'win32' ? 'node.exe' : 'node'),
      workingDirectory: root,
      environment: {
        DSH_HOME: join(root, 'home'), DSH_PROFILE_DIR: profile,
        // 第三方插件可能直接使用 os.homedir()，必须同时隔离用户目录和缓存。
        USERPROFILE: join(root, 'home'), HOME: join(root, 'home'),
        APPDATA: join(root, 'home', 'AppData', 'Roaming'), LOCALAPPDATA: join(root, 'home', 'AppData', 'Local'),
        XDG_CONFIG_HOME: join(root, 'home', '.config'), XDG_DATA_HOME: join(root, 'home', '.local', 'share'),
        DSH_USAGE_STATS: undefined,
        DSH_PNPM_ENTRY: join(project, 'runtime-node', 'pnpm-package', 'bin', 'pnpm.cjs'),
        DSH_TELEMETRY_DISABLED: '1', DSH_BRIDGE_PROBE: resultPath,
      },
    })
    try {
      const bootstrapResponse = await fetch(server.url, { redirect: 'manual' })
      const authCookie = bootstrapResponse.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
      if (pluginSource) {
        const capabilitiesResponse = await fetch(new URL('/dsh-market/api/v1/capabilities', server.url), { headers: { cookie: authCookie } })
        assert.equal(capabilitiesResponse.status, 200)
        const capabilities = await capabilitiesResponse.json() as { runtime: string }
        assert.equal(capabilities.runtime, desktop ? 'desktop' : 'web', '第三方市场必须选中正确安装通道')
      }
      if (desktop) {
        let probe: { profiles: boolean; pnpm: boolean; pnpmExit?: number; graph?: { entries: { id: string; url: string }[] }; plugins?: { name: string; state: number; error?: string }[] } | undefined
        // HTTP 就绪可能早于异步插件初始化完成，例如 MCP Connector 的远程目录请求。
        for (let attempt = 0; attempt < (allBundled ? 600 : 100); attempt += 1) {
          try { probe = JSON.parse(await readFile(resultPath, 'utf8')) } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error
          }
          const pluginsReady = !allBundled || community.every(name => probe?.plugins?.some(plugin => plugin.name === name && plugin.state === 2))
          if (pluginsReady && probe?.pnpmExit !== undefined && probe.graph?.entries.some(entry => entry.id === 'dsh-desktop-bridge')) break
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        assert.equal(probe?.profiles, true)
        assert.equal(probe?.pnpm, true)
        assert.equal(probe?.pnpmExit, 0, '桌面插件市场使用的 pnpm 服务必须能实际执行')
        if (allBundled) {
          for (const name of community) {
            assert.ok(probe?.plugins?.some(plugin => plugin.name === name && plugin.state === 2), `内置插件后端未激活：${name}；${JSON.stringify(probe?.plugins?.filter(plugin => plugin.name === name))}`)
            const packageManifest = JSON.parse(await readFile(join(profile, 'node_modules', name, 'package.json'), 'utf8'))
            if (packageManifest.dsh?.client) assert.ok(probe?.graph?.entries.some(entry => entry.id === name), `内置插件前端未进入模块图：${name}`)
          }
          console.log(`${mode}: ${community.length} 个内置插件后端激活，所有声明的前端模块进入加载图`)
        }
        const client = probe?.graph?.entries.find(entry => entry.id === 'dsh-desktop-bridge')
        assert.ok(client, '真实 DSH 必须发现 bridge 的前端模块')
        const bootstrap = await fetch(server.url, { redirect: 'manual' })
        const cookie = bootstrap.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
        const response = await fetch(new URL(client.url, server.url), { headers: { cookie } })
        assert.equal(response.status, 200)
        assert.match(await response.text(), /window\.__ModuleLoader__\.load/)
        if (browser && mode === 'desktop') {
          for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
            const page = await browser.newPage({ viewport })
            const errors: string[] = []
            page.on('pageerror', (error: Error) => { errors.push(error.message) })
            await page.addInitScript(`window.bridgeReports = { boot: [], badges: [], locales: [], themes: [] };
              window.dshDesktopShell = {
                onAction: () => () => {}, onOpenSession: () => () => {}, onNotificationReply: () => () => {},
                reportBoot: report => window.bridgeReports.boot.push(report),
                reportNotification: report => window.bridgeReports.badges.push(report),
                reportLocale: locale => window.bridgeReports.locales.push(locale),
                reportState() {}, reportTheme: value => window.bridgeReports.themes.push(value),
              };`)
            await page.goto(server.url)
            await page.waitForFunction('window.bridgeReports.themes.length > 0 && window.bridgeReports.boot.length > 0 && window.bridgeReports.locales.length > 0 && window.bridgeReports.badges.some(event => event.type === "badge")', undefined, { timeout: 20_000 })
            const reports = await page.evaluate('window.bridgeReports')
            assert.equal(reports.boot.at(-1).status, 'healthy', JSON.stringify(reports.boot))
            if (allBundled) {
              // 内测声明保存在服务端，API Key 引导的跳过状态只保存在当前浏览器。
              if (viewport.width === 1280) {
                await page.getByRole('button', { name: '继续', exact: true }).click()
              }
              await page.getByRole('button', { name: '稍后配置', exact: true }).click()
              if (viewport.width === 390) await page.getByRole('button', { name: '展开侧边栏', exact: true }).click()
              await page.getByTestId('billing-trigger').click()
              await page.getByTestId('billing-dashboard').waitFor({ state: 'visible' })
            }
            for (const colorScheme of ['dark', 'light'] as const) {
              await page.emulateMedia({ colorScheme })
              await page.waitForFunction((scheme: string) => {
                const report = (window as any).bridgeReports.themes.at(-1)
                return report?.preference === 'system' && report.colorScheme === scheme
              }, colorScheme)
            }
            assert.deepEqual(errors, [])
            if (process.env.DSH_BRIDGE_SMOKE_OUTPUT) {
              await mkdir(process.env.DSH_BRIDGE_SMOKE_OUTPUT, { recursive: true })
              await page.screenshot({ path: join(process.env.DSH_BRIDGE_SMOKE_OUTPUT, `desktop-bridge-${viewport.width}.png`), animations: 'disabled' })
            }
            await page.close()
            console.log(`browser ${viewport.width}x${viewport.height}: 真实前端加载、启动报告、语言、主题跟随系统和角标 IPC 通过`)
          }
        }
      } else {
        const bootstrap = await fetch(server.url, { redirect: 'manual' })
        const cookie = bootstrap.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
        const response = await fetch(new URL('/', server.url), { headers: { cookie } })
        assert.equal(response.status, 200)
        assert.doesNotMatch(await response.text(), /dsh-desktop-bridge/)
      }
      assert.equal(await readFile(join(profile, 'package.json'), 'utf8'), manifest)
      assert.equal(await readFile(join(profile, 'cordis.patch.yml'), 'utf8'), '[]\n')
      assert.equal(existsSync(join(profile, 'node_modules', 'dsh-desktop-bridge')), false)
      console.log(`${mode}: 启动成功，桥接能力与前端资源符合预期，共享配置未写入 bridge`)
    } finally {
      await server.stop()
    }
  }
  migrateDesktopBridgeProfile(profile)
} finally {
  await browser?.close()
  await rm(root, { recursive: true, force: true })
}
