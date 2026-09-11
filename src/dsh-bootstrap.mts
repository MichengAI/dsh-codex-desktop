import { pathToFileURL } from 'node:url'

const entry = process.argv[2]
if (entry === undefined) throw new Error('缺少 DSH 启动入口。')

let initialized = false
let shutdownRequested = false

function requestShutdown(): void {
  shutdownRequested = true
  if (initialized) process.emit('SIGTERM')
}

process.on('message', message => {
  if (message === 'shutdown') requestShutdown()
})
process.on('disconnect', requestShutdown)

process.argv = [process.execPath, entry, ...process.argv.slice(3)]
const cli = await import(pathToFileURL(entry).href)
// 0.1.5-rc.2 起导入 CLI 不再自动启动；旧版仍通过导入时的副作用启动。
if (typeof cli.runCli === 'function') await cli.runCli()
initialized = true

if (shutdownRequested) process.emit('SIGTERM')
