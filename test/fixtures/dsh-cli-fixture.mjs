// 模拟 DSH 0.1.5-rc.2：导入入口不启动，调用公开 runCli 后才运行。
let started = false

export async function runCli() {
  if (started) throw new Error('CLI 不应重复启动')
  started = true
  await import('./dsh-fixture.mjs')
}

if (import.meta.main) await runCli()
