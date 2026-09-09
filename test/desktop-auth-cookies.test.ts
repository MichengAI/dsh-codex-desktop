import assert from 'node:assert/strict'
import test from 'node:test'
import type { Cookies, Cookie } from 'electron'
import { clearPreviousDshAuthCookies } from '../src/desktop-auth-cookies.js'

test('新启动登录只移除同主机根路径的 DSH 认证 Cookie', async () => {
  const removed: string[] = []
  const rows = [
    ...Array.from({ length: 67 }, (_, index) => ({ name: `dsh-auth-${index}`, domain: '127.0.0.1', path: '/' })),
    { name: 'theme', domain: '127.0.0.1', path: '/' },
    { name: 'dsh-auth-other', domain: 'localhost', path: '/' },
    { name: 'dsh-auth-nested', domain: '127.0.0.1', path: '/another-app' },
  ] as Cookie[]
  const cookies: Pick<Cookies, 'get' | 'remove'> = {
    get: async filter => { assert.equal(filter.url, 'http://127.0.0.1:1234/'); return rows },
    remove: async (url, name) => { assert.equal(url, 'http://127.0.0.1:1234/'); removed.push(name) },
  }
  await clearPreviousDshAuthCookies(cookies, 'http://127.0.0.1:1234/?token=test')
  assert.equal(removed.length, 67)
  assert.ok(removed.every(name => /^dsh-auth-\d+$/.test(name)))
})

test('无启动 token 或非本机地址不触碰 Cookie', async () => {
  const cookies: Pick<Cookies, 'get' | 'remove'> = {
    get: async () => { assert.fail('不应读取 Cookie') },
    remove: async () => { assert.fail('不应清理 Cookie') },
  }
  for (const url of ['http://127.0.0.1:1234/', 'https://example.com/?token=test', 'http://127.0.0.1:1234/?token=']) {
    await clearPreviousDshAuthCookies(cookies, url)
  }
})

test('清理失败向调用方报告，不静默继续登录', async () => {
  const cookies: Pick<Cookies, 'get' | 'remove'> = {
    get: async () => [{ name: 'dsh-auth-old', domain: 'localhost', path: '/' }] as Cookie[],
    remove: async () => { throw new Error('cookie storage unavailable') },
  }
  await assert.rejects(clearPreviousDshAuthCookies(cookies, 'http://localhost:1234/?token=test'), /cookie storage unavailable/)
})
