import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { terminateProcessTree } from '../src/process-control.js'

async function probe(entrySource: string, preload = ''): Promise<{ code: number | null; output: string; profileDir: string }> {
  const scratch = await mkdtemp(join(process.env.TMPDIR ?? tmpdir(), 'dsh-gate-test-'))
  try {
    const entry = join(scratch, 'pnpm.cjs')
    await writeFile(entry, entrySource)
    const preloadPath = join(scratch, 'preload.cjs')
    await writeFile(preloadPath, preload)
    const child = spawn(process.execPath, [fileURLToPath(new URL('../scripts/probe-plugin-operation-gate.mjs', import.meta.url))], {
      env: { ...process.env, DSH_PNPM_ENTRY: entry, TMPDIR: scratch,
        NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --require ${JSON.stringify(preloadPath)}` },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let output = ''
    child.stdout.on('data', data => { output += String(data) })
    child.stderr.on('data', data => { output += String(data) })
    const timer = setTimeout(() => child.kill('SIGKILL'), 15_000)
    try {
      const code = await new Promise<number | null>((resolve, reject) => {
        child.once('error', reject)
        child.once('exit', resolve)
      })
      const profileDir = /"profileDir":\s*("(?:[^"\\]|\\.)*")/.exec(output)?.[1]
      assert.ok(profileDir, `probe must print its temporary profile even on failure: ${output}`)
      const parsedProfileDir = JSON.parse(profileDir) as string
      assert.equal(existsSync(parsedProfileDir), false, `temporary profile leaked: ${output}`)
      return { code, output, profileDir: parsedProfileDir }
    } finally {
      clearTimeout(timer)
    }
  } finally {
    // Check the probe's cleanup before removing the enclosing test sandbox.
    // Failed probes must never leave a real user profile behind.
    await rm(scratch, { recursive: true, force: true })
  }
}

test('pnpm 失败后探针清理临时 profile 并正常结束', async () => {
  const result = await probe('process.exit(23)')
  assert.notEqual(result.code, 0)
  assert.match(result.output, /pnpm 安装应当成功/)
  assert.equal(existsSync(result.profileDir), false, result.output)
})

// 安装夹具只写测试 profile，不访问 registry，不替换宿主 finalize 或 watcher。
const installFixture = `
const fs = require('node:fs');
const name = 'dsh-better-sidebar';
const dir = 'node_modules/' + name;
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(dir + '/patch.js', 'export default {}');
fs.writeFileSync(dir + '/package.json', JSON.stringify({ name, version: '1.0.0', dsh: { bundle: { patch: 'patch.js' } } }));
const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
manifest.dependencies[name] = '1.0.0';
fs.writeFileSync('package.json', JSON.stringify(manifest));
`

test('安装与监听成功但缺少 IPC 时探针必须失败', async () => {
  const result = await probe(installFixture, `
const original = global.setTimeout;
global.setTimeout = (callback, delay, ...args) => original(delay === 400 ? () => {} : callback, delay, ...args);
`)
  assert.notEqual(result.code, 0, result.output)
  assert.match(result.output, /IPC.*超时/)
})

test('IPC 成功但监听未触发时探针必须失败', async () => {
  const result = await probe(installFixture, `
require('node:fs').watch = () => ({ close() {}, on() { return this; } });
require('node:module').syncBuiltinESMExports();
`)
  assert.notEqual(result.code, 0, result.output)
  assert.match(result.output, /watcher.*超时/)
})

test('probe observes real host IPC and filesystem watcher then removes the profile', async () => {
  const result = await probe(installFixture)
  assert.equal(result.code, 0, result.output)
  assert.match(result.output, /"ipcSent": true/)
  assert.match(result.output, /"watcherFired": true/)
})
