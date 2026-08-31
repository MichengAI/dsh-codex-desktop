import { createServer } from 'node:http'
import { writeFileSync } from 'node:fs'

const mode = process.env.DSH_FIXTURE_MODE
let server

if (process.env.DSH_FIXTURE_PID_FILE) {
  writeFileSync(process.env.DSH_FIXTURE_PID_FILE, String(process.pid), 'utf8')
}

if (mode === 'exit') {
  process.stderr.write('Cannot find package @deepseek-ai/cordis-plugin-group\n')
  process.exit(1)
}
process.on('SIGTERM', () => {
  if (server === undefined) process.exit(0)
  server.close(() => process.exit(0))
})

if (mode === 'silent' || mode === 'unhealthy') {
  if (mode === 'unhealthy') process.stdout.write('dsh web: http://127.0.0.1:1\n')
  setInterval(() => undefined, 1_000)
} else {
  server = createServer((request, response) => {
    if (mode === 'authenticated') {
      if (request.url === '/?token=desktop-secret') {
        response.writeHead(303, { location: '/', 'set-cookie': 'dsh-auth=ready; HttpOnly; SameSite=Strict' })
        response.end()
        return
      }
      if (!request.headers.cookie?.includes('dsh-auth=ready')) {
        response.writeHead(401, { 'content-type': 'text/plain' })
        response.end('authentication required')
        return
      }
    }
    if (request.url === '/asset.js') {
      response.writeHead(200, { 'content-type': 'application/javascript' })
      response.end('export {}')
      return
    }
    response.writeHead(200, { 'content-type': 'text/html' })
    response.end('<!doctype html><script src="/asset.js"></script>')
  })

  server.listen(0, '127.0.0.1', () => {
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('未获取 HTTP 监听端口。')
    const ready = `dsh web: http://127.0.0.1:${address.port}`
    if (mode === 'authenticated') {
      process.stdout.write(`${ready}/`)
      setTimeout(() => process.stdout.write('?token=desktop-secret\n'), 10)
      return
    }
    if (mode === 'chunked') {
      process.stdout.write(ready.slice(0, 24))
      setTimeout(() => process.stdout.write(`${ready.slice(24)}\n`), 10)
      return
    }
    process.stdout.write(`${ready}\n`)
  })
}
