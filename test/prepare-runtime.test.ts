import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

import { copyWorkspacePackages, officialRuntimeGlobalNodeModulesRoot, officialRuntimeNpmDependencies, officialRuntimeNpmInstallArgs, pruneStoreForPackaging, removePreparedPath, resolveBundledNodeSha256, validateOfficialRuntimeLayout, writePnpmShims } from '../scripts/prepare-runtime.js'
import { DESKTOP_BRIDGE_FILES } from '../src/desktop-host.js'

test('按目标平台选择随包 Node 的 SHA256', () => {
  const checksums = {
    'win32-x64': 'WINDOWS',
    'darwin-arm64': 'APPLE_SILICON',
    'darwin-x64': 'INTEL',
    'linux-arm64': 'LINUX_ARM64',
    'linux-x64': 'LINUX',
  }
  assert.equal(resolveBundledNodeSha256(checksums, 'darwin', 'arm64'), 'APPLE_SILICON')
  assert.equal(resolveBundledNodeSha256(checksums, 'darwin', 'x64'), 'INTEL')
  assert.equal(resolveBundledNodeSha256(checksums, 'linux', 'arm64'), 'LINUX_ARM64')
  assert.equal(resolveBundledNodeSha256(checksums, 'linux', 'x64'), 'LINUX')
})

test('项目配置包含 Linux x64 与 ARM64 的随包 Node SHA256', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as {
    config?: { bundledNodeSha256?: unknown }
  }
  assert.equal(
    resolveBundledNodeSha256(manifest.config?.bundledNodeSha256, 'linux', 'x64'),
    '89AF8424DD53E560B1933F87BA650D8BF57C83CA5A04600EEFB31F416AABBAE7',
  )
  assert.equal(
    resolveBundledNodeSha256(manifest.config?.bundledNodeSha256, 'linux', 'arm64'),
    '23A5637C2470FDE09FCC1ACC77C1B92E04E3D7E3E6E80FF7DF6F5831958D1477',
  )
})

test('跳过指向普通文件的工作区链接', async t => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-runtime-'))
  try {
    const packagesRoot = join(root, 'packages')
    const packageRoot = join(packagesRoot, 'fixture', 'package')
    await mkdir(packageRoot, { recursive: true })
    await writeFile(join(packageRoot, 'package.json'), JSON.stringify({ name: '@deepseek-ai/fixture' }), 'utf8')
    const sourceFile = join(root, 'CLAUDE.md')
    await writeFile(sourceFile, '无关文件', 'utf8')
    try {
      await symlink(sourceFile, join(packagesRoot, 'CLAUDE.md'), 'file')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EPERM') t.skip('当前环境不允许创建文件链接')
      else throw error
      return
    }

    const runtimeRoot = join(root, 'runtime')
    await copyWorkspacePackages(packagesRoot, 2, runtimeRoot)
    assert.equal(existsSync(join(runtimeRoot, 'node_modules', '@deepseek-ai', 'fixture', 'package.json')), true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('只把官方包复制进安装目录，社区插件不走这条路径', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-runtime-'))
  try {
    const packagesRoot = join(root, 'packages')
    const official = join(packagesRoot, 'official', 'package')
    const community = join(packagesRoot, 'community', 'package')
    await mkdir(official, { recursive: true })
    await mkdir(community, { recursive: true })
    await writeFile(join(official, 'package.json'), JSON.stringify({ name: '@deepseek-ai/fixture' }), 'utf8')
    await writeFile(join(community, 'package.json'), JSON.stringify({ name: '@michengai/dsh-codex-ui' }), 'utf8')
    const runtimeRoot = join(root, 'runtime')
    await copyWorkspacePackages(packagesRoot, 2, runtimeRoot)
    assert.equal(existsSync(join(runtimeRoot, 'node_modules', '@deepseek-ai', 'fixture', 'package.json')), true)
    assert.equal(existsSync(join(runtimeRoot, 'node_modules', '@michengai', 'dsh-codex-ui', 'package.json')), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('打包配置把离线插件仓库放到 extraResources', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as {
    build?: { extraResources?: { from?: string; to?: string }[] }
  }
  assert.equal(
    manifest.build?.extraResources?.some(item => item.from === 'runtime-plugins/store.tgz' && item.to === 'plugins-store.tgz'),
    true,
  )
})

test('Windows 根目录图标不会进入 macOS 应用包', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as {
    build?: {
      extraFiles?: unknown
      win?: { extraFiles?: { from?: string; to?: string }[] }
    }
  }
  assert.equal(manifest.build?.extraFiles, undefined)
  assert.equal(
    manifest.build?.win?.extraFiles?.some(item => item.from === 'assets/icons/icon.ico' && item.to === 'DSH Codex Desktop.ico'),
    true,
  )
})

test('Windows 只写 pnpm.cmd，避免和 pnpm 包装目录撞名', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-pnpm-'))
  try {
    await mkdir(join(root, 'pnpm-package'), { recursive: true })
    await writePnpmShims(root, 'bin/pnpm.cjs', 'win32')
    assert.equal(existsSync(join(root, 'pnpm.cmd')), true)
    assert.equal(existsSync(join(root, 'pnpm')), false)
    const shim = await readFile(join(root, 'pnpm.cmd'), 'utf8')
    assert.match(shim, /pnpm-package\\bin\\pnpm.cjs/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('打包前删除 pnpm store 的 projects 链接，避免 7zip 扫到断裂路径', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-store-'))
  try {
    const projects = join(root, 'v11', 'projects', 'broken')
    const files = join(root, 'v11', 'files')
    await mkdir(projects, { recursive: true })
    await mkdir(files, { recursive: true })
    await writeFile(join(files, 'keep.txt'), 'ok', 'utf8')
    await pruneStoreForPackaging(root)
    assert.equal(existsSync(projects), false)
    assert.equal(existsSync(join(files, 'keep.txt')), true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('安装器产品名、进程名和安装目录都使用 DSH Codex Desktop', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as {
    desktopName?: string
    build?: { productName?: string, executableName?: string, nsis?: { include?: string, shortcutName?: string, uninstallDisplayName?: string } }
  }
  assert.equal(manifest.build?.productName, 'DSH Codex Desktop')
  assert.equal(manifest.desktopName, 'DSH Codex Desktop')
  assert.equal(manifest.build?.executableName, 'DSH Codex Desktop')
  assert.equal(manifest.build?.nsis?.include, 'build/installer.nsh')
  assert.equal(manifest.build?.nsis?.shortcutName, 'DSH Codex Desktop')
  assert.equal(manifest.build?.nsis?.uninstallDisplayName, 'DSH Codex Desktop')
  const installer = await readFile(new URL('../../build/installer.nsh', import.meta.url), 'utf8')
  assert.match(installer, /APP_FILENAME/)
  assert.match(installer, /onVerifyInstDir/)
})

test('打包配置把预装官方运行时放到 extraResources', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as {
    build?: { extraResources?: { from?: string; to?: string }[] }
  }
  assert.equal(
    manifest.build?.extraResources?.some(item => item.from === 'runtime-dsh.tgz' && item.to === 'dsh-runtime.tgz'),
    true,
  )
})

test('清理运行时目录必须可重试，避免 Windows ENOTEMPTY', async () => {
  const source = await readFile(new URL('../../scripts/prepare-runtime.ts', import.meta.url), 'utf8')
  assert.match(source, /export async function removePreparedPath/)
  assert.match(source, /maxRetries/)
  assert.match(source, /await removePreparedPath\(target\)/)
  const root = await mkdtemp(join(tmpdir(), 'dsh-rm-'))
  const nested = join(root, 'pnpm-package', 'artifacts', 'exe', 'dist', 'node_modules', 'undici', 'lib')
  await mkdir(nested, { recursive: true })
  await writeFile(join(nested, 'keep.txt'), 'x', 'utf8')
  await removePreparedPath(root)
  assert.equal(existsSync(root), false)
})

test('打包配置显式映射完整编译产物', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as {
    build?: { files?: Array<string | { from?: string; to?: string; filter?: string[] }> }
  }
  assert.equal(
    manifest.build?.files?.some(item => typeof item !== 'string'
      && item.from === 'dist'
      && item.to === 'dist'
      && item.filter?.includes('**/*')),
    true,
  )
})

test('Windows 冒烟检查使用实际产品可执行文件名', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/desktop-package.yml', import.meta.url), 'utf8')
  assert.match(workflow, /release\\win-unpacked\\DSH Codex Desktop\.exe/)
})

test('官方运行时使用 npm 安装以兼容预发布 peer 依赖', () => {
  assert.deepEqual(officialRuntimeNpmInstallArgs('D:\\runtime'), [
    'install',
    '--global',
    '--prefix=D:\\runtime',
    '--omit=dev',
    '--package-lock=false',
    '--no-audit',
    '--no-fund',
    '--allow-scripts=@deepseek-ai/dsh-subprocess-local,@google/genai,koffi,node-pty,protobufjs',
    '--registry=https://registry.npmjs.org/',
    '@deepseek-ai/dsh@0.1.2-alpha.3',
    '@deepseek-ai/cordis-plugin-group@1.0.2',
    '@deepseek-ai/dsh-scope@0.1.2-alpha.3',
    '@deepseek-ai/dsh-timeout@0.1.2-alpha.3',
    '@deepseek-ai/dsh-invariants@0.1.2-alpha.3',
  ])
})

test('npm 全局安装目录按平台归一化', () => {
  assert.equal(officialRuntimeGlobalNodeModulesRoot('runtime', 'win32'), join('runtime', 'node_modules'))
  assert.equal(officialRuntimeGlobalNodeModulesRoot('runtime', 'linux'), join('runtime', 'lib', 'node_modules'))
})

test('官方运行时把 DSH 和启动 peer 一起装成 npm 顶层依赖', () => {
  assert.deepEqual(officialRuntimeNpmDependencies(), {
    '@deepseek-ai/dsh': '0.1.2-alpha.3',
    '@deepseek-ai/cordis-plugin-group': '1.0.2',
    '@deepseek-ai/dsh-scope': '0.1.2-alpha.3',
    '@deepseek-ai/dsh-timeout': '0.1.2-alpha.3',
    '@deepseek-ai/dsh-invariants': '0.1.2-alpha.3',
  })
})

test('打包校验拒绝只嵌套在 DSH 内部的启动 peer', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-runtime-layout-'))
  try {
    const dependencies = officialRuntimeNpmDependencies()
    for (const [packageName, version] of Object.entries(dependencies)) {
      const base = packageName === '@deepseek-ai/dsh'
        ? join(root, 'node_modules', ...packageName.split('/'))
        : join(root, 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', ...packageName.split('/'))
      await mkdir(base, { recursive: true })
      await writeFile(join(base, 'package.json'), JSON.stringify({ name: packageName, version }), 'utf8')
    }
    assert.throws(() => validateOfficialRuntimeLayout(root), /缺少顶层依赖：@deepseek-ai\/cordis-plugin-group/)

    for (const [packageName, version] of Object.entries(dependencies)) {
      const base = join(root, 'node_modules', ...packageName.split('/'))
      await mkdir(base, { recursive: true })
      await writeFile(join(base, 'package.json'), JSON.stringify({ name: packageName, version }), 'utf8')
    }
    assert.doesNotThrow(() => validateOfficialRuntimeLayout(root))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('alpha.2+ 已内置权限本地化，不再应用旧 rc.2 桌面补丁', async () => {
  const prepare = await readFile(new URL('../../scripts/prepare-runtime.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(prepare, /applyOfficialRuntimePatch/)
  assert.equal(existsSync(new URL('../../patches/dsh-0.1.1-rc.2-permission-localization.patch', import.meta.url)), false)
})

test('Windows 冒烟保留便携版冷启动路径并检查窗口响应', async () => {
  const script = await readFile(new URL('../../scripts/smoke-package.ps1', import.meta.url), 'utf8')
  const verifier = await readFile(new URL('../../scripts/smoke-packaged-plugins.mts', import.meta.url), 'utf8')
  const main = await readFile(new URL('../../src/main.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(script, /extract-runtime\.mjs/)
  assert.match(script, /\.Responding/)
  assert.match(script, /连续 10 秒未响应/)
  assert.match(script, /startupTimeoutSeconds = 180/)
  assert.match(script, /npm_config_offline = 'true'/)
  assert.match(script, /smoke-packaged-plugins\.mjs/)
  assert.doesNotMatch(script, /expectedPlugins/)
  assert.doesNotMatch(script, /@michengai\/dsh-codex-ui/)
  assert.match(verifier, /BUNDLED_PLUGINS/)
  assert.match(verifier, /强制离线首启缺少插件/)
  assert.match(script, /--user-data-dir=/)
  assert.match(main, /const extraction = extractPackagedRuntimesInChild/)
  assert.match(main, /signal: controller\.signal/)
  assert.match(main, /await extraction/)
  assert.match(main, /runtimeExtractionAbortController\?\.abort\(\)/)
  assert.doesNotMatch(main, /\bextractPackagedRuntimes\(/)
  assert.match(main, /--user-data-dir=/)
})

test('首启页面会向辅助技术播报初始化阶段', async () => {
  const startup = await readFile(new URL('../../assets/startup.html', import.meta.url), 'utf8')
  assert.match(startup, /role="status"/)
  assert.match(startup, /aria-live="polite"/)
  assert.match(startup, /aria-atomic="true"/)
  assert.match(startup, /<h1>DSH Codex Desktop<\/h1>/)
})

test('Windows 冒烟兼容 alpha.2+ 启动 token 鉴权', async () => {
  const script = await readFile(new URL('../../scripts/smoke-package.ps1', import.meta.url), 'utf8')
  assert.match(script, /SkipHttpErrorCheck/)
  assert.match(script, /dsh web authentication required/)
  assert.match(script, /startup-error\.log/)
  assert.match(script, /DSH_DESKTOP_SMOKE_READY_FILE/)
  assert.match(script, /startup-ready/)
  const httpSuccessBranch = script.indexOf("if ($page.StatusCode -ne 200)")
  const readyWait = script.indexOf('while ((Get-Date) -lt $deadline -and -not (Test-Path -LiteralPath $smokeReadyFile))', httpSuccessBranch)
  const pluginVerification = script.indexOf('smoke-packaged-plugins.mjs')
  assert.ok(httpSuccessBranch >= 0 && readyWait > httpSuccessBranch && pluginVerification > readyWait)
  assert.match(script, /foreach \(\$listener in \$listeners\)/)
  assert.match(script, /\$candidate\.StatusCode -eq 200 -or \(\$candidate\.StatusCode -eq 401/)
  assert.doesNotMatch(script, /Select-Object -First 1\s*\r?\n\s*if \(\$null -ne \$listener\)/)
})

test('正式标签缺少签名凭据时仍允许生成带 ad-hoc 签名的多平台测试版', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/desktop-package.yml', import.meta.url), 'utf8')
  assert.match(workflow, /version: 11\.24\.0/)
  assert.match(workflow, /actions\/checkout@v7/)
  assert.match(workflow, /actions\/setup-node@v7/)
  assert.match(workflow, /actions\/upload-artifact@v7/)
  assert.match(workflow, /actions\/download-artifact@v8/)
  assert.match(workflow, /pnpm\/action-setup@v6/)
  assert.match(workflow, /未配置 Windows 代码签名凭据，继续生成未签名测试版/)
  assert.match(workflow, /未配置 macOS 签名证书，将生成 ad-hoc 签名测试版/)
  assert.doesNotMatch(workflow, /正式标签发布必须配置 (?:Windows|macOS)/)
  assert.match(workflow, /\$env:CSC_LINK = \$env:WINDOWS_CERTIFICATE/)
  assert.doesNotMatch(workflow, /CSC_LINK: \$\{\{ startsWith\(matrix\.platform/)
  assert.match(workflow, /\$env:DSH_MACOS_ADHOC_SIGN = 'true'/)
  assert.match(workflow, /\$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'/)
  assert.doesNotMatch(workflow, /--config\.mac\.identity=-/)
  assert.doesNotMatch(workflow, /--config\.mac\.hardenedRuntime=false/)
  assert.match(workflow, /codesign --verify --deep --strict --verbose=2/)
  assert.match(workflow, /pnpm test\r?\n\s+if \(\$LASTEXITCODE -ne 0\) \{ exit \$LASTEXITCODE \}/)
  assert.doesNotMatch(workflow, /pnpm run dist -- @buildArguments/)
  assert.match(workflow, /pnpm run prepare-runtime\r?\n\s+if \(\$LASTEXITCODE -ne 0\) \{ exit \$LASTEXITCODE \}/)
  assert.match(workflow, /pnpm exec electron-builder --publish never @buildArguments\r?\n\s+if \(\$LASTEXITCODE -ne 0\) \{ exit \$LASTEXITCODE \}/)
})

test('打包态从 desktop-bridge 加载 DSH 主进程模块', async () => {
  const main = await readFile(new URL('../../src/main.ts', import.meta.url), 'utf8')
  const host = await readFile(new URL('../../src/desktop-host.ts', import.meta.url), 'utf8')
  assert.match(main, /desktop-bridge.*dsh-process\.js/)
  assert.doesNotMatch(host, /from '\.\/dsh-process\.js'/)
})

function extractionScriptExtraResources(manifest: {
  build?: { extraResources?: Array<{ from?: string; to?: string; filter?: string[] }> }
}): Array<{ from: string; to: string }> {
  return (manifest.build?.extraResources ?? []).flatMap((item) => {
    if (typeof item.from !== 'string' || typeof item.to !== 'string' || item.filter !== undefined) return []
    if (!item.from.startsWith('dist/src/')) return []
    return [{ from: item.from, to: item.to }]
  })
}

test('安装阶段解压脚本带上自己的运行依赖', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as {
    build?: { extraResources?: Array<{ from?: string; to?: string; filter?: string[] }> }
  }
  const extra = extractionScriptExtraResources(manifest)
  assert.equal(extra.some(item => item.from === 'dist/src/extract-runtime.js' && item.to === 'extract-runtime.mjs'), true)
  assert.equal(extra.some(item => item.from === 'dist/src/runtime-archive.js' && item.to === 'runtime-archive.js'), true)
  assert.equal(extra.some(item => item.from === 'dist/src/process-control.js' && item.to === 'process-control.js'), true)
})

test('安装阶段解压脚本独立目录可以完成 ESM 导入', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as {
    build?: { extraResources?: Array<{ from?: string; to?: string; filter?: string[] }> }
  }
  const extra = extractionScriptExtraResources(manifest)
  const root = await mkdtemp(join(tmpdir(), 'dsh-extract-import-'))
  try {
    for (const item of extra) {
      await copyFile(new URL(`../../${item.from}`, import.meta.url), join(root, item.to))
    }
    await import(`${pathToFileURL(join(root, 'extract-runtime.mjs')).href}?test=${Date.now()}`)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('desktop-bridge 资源清单包含完整运行依赖闭包', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as {
    build?: { extraResources?: Array<{ to?: string; filter?: string[] }> }
  }
  const filter = manifest.build?.extraResources?.find(item => item.to === 'desktop-bridge')?.filter
  assert.deepEqual([...(filter ?? [])].sort(), [...DESKTOP_BRIDGE_FILES].sort())
})

test('desktop-bridge 独立目录可以完成 ESM 导入', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-bridge-import-'))
  try {
    for (const file of DESKTOP_BRIDGE_FILES) {
      await copyFile(new URL(`../../dist/src/${file}`, import.meta.url), join(root, file))
    }
    await import(`${pathToFileURL(join(root, 'desktop-host.js')).href}?test=${Date.now()}`)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('更新产物使用不会被 GitHub 改写的固定文件名', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as {
    build?: {
      win?: { artifactName?: string }
      mac?: { artifactName?: string }
      linux?: { artifactName?: string }
    }
  }
  assert.equal(manifest.build?.win?.artifactName, 'dsh-codex-desktop-${version}-win-${arch}.${ext}')
  assert.equal(manifest.build?.mac?.artifactName, 'dsh-codex-desktop-${version}-mac-${arch}.${ext}')
  assert.equal(manifest.build?.linux?.artifactName, 'dsh-codex-desktop-${version}-linux-${arch}.${ext}')
})

test('macOS 双架构使用各自的更新通道元数据', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/desktop-package.yml', import.meta.url), 'utf8')
  assert.match(workflow, /latest-arm64-mac\.yml/)
  assert.match(workflow, /latest-x64-mac\.yml/)
})

test('Linux ARM64 使用原生 runner、独立更新元数据与双格式制品', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/desktop-package.yml', import.meta.url), 'utf8')
  assert.match(workflow, /platform: linux-arm64/)
  assert.match(workflow, /runner: ubuntu-24\.04-arm/)
  assert.match(workflow, /buildArguments: --linux --arm64/)
  assert.match(workflow, /unpackedDirectory: linux-arm64-unpacked/)
  assert.match(workflow, /updateMetadata: latest-linux-arm64\.yml/)

  const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as {
    build?: { linux?: { target?: string[] } }
  }
  assert.deepEqual(manifest.build?.linux?.target, ['AppImage', 'deb'])
})
