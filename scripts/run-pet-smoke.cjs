/** 在独立用户目录运行真实 Electron，退出后清理本轮临时文件。 */
const { spawn } = require('node:child_process')
const { mkdtempSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const directory = mkdtempSync(join(tmpdir(), 'dsh-desktop-pet-'))
const env = { ...process.env, DSH_PET_SMOKE_DIR: directory }
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(require('electron'), [join(__dirname, 'smoke-pet.mjs')], { env, stdio: 'inherit', windowsHide: true })
const timer = setTimeout(() => child.kill(), 60000)
child.on('error', error => console.error(error))
child.on('close', code => { clearTimeout(timer); rmSync(directory, { recursive: true, force: true }); process.exitCode = code ?? 1 })
