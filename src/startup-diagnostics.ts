import { readFile } from 'node:fs/promises'

import { writeTextFileAtomic } from './atomic-file.js'

const STARTUP_DIAGNOSTIC_VERSION = 1
const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i
const MAX_FAILURE_MESSAGE_LENGTH = 4_000
const MAX_FAILED_PLUGINS = 100

export type StartupDiagnosticStage = 'server-starting' | 'server-ready' | 'renderer-loading' | 'healthy'
export type StartupDiagnosticMode = 'normal' | 'recovery'
export type StartupFailureSource = 'process' | 'renderer' | 'renderer-timeout'

export interface RendererBootReport {
  status: 'healthy' | 'failed'
  plugins?: string[]
  error?: string
  workbenchReady?: boolean
}

export interface StartupDiagnostic {
  version: 1
  mode?: StartupDiagnosticMode
  startedAt: string
  stage: StartupDiagnosticStage
  lastHealthyAt?: string
  failure?: {
    source: StartupFailureSource
    message: string
    plugins: string[]
    occurredAt: string
  }
}

export interface StartupDiagnosticFailureInput {
  stage: Exclude<StartupDiagnosticStage, 'healthy'>
  source: StartupFailureSource
  message: string
  plugins: string[]
}

export interface BeginStartupDiagnosticOptions {
  mode?: StartupDiagnosticMode
  startedAt?: string
}

function isPackageName(value: unknown): value is string {
  return typeof value === 'string' && PACKAGE_NAME_PATTERN.test(value)
}

function isStage(value: unknown): value is StartupDiagnosticStage {
  return value === 'server-starting' || value === 'server-ready' || value === 'renderer-loading' || value === 'healthy'
}

function isMode(value: unknown): value is StartupDiagnosticMode {
  return value === 'normal' || value === 'recovery'
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function sanitizePlugins(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter(isPackageName))].slice(0, MAX_FAILED_PLUGINS)
}

/** 仅接受固定字段的客户端启动报告，避免把渲染器任意对象写入本地诊断文件。 */
export function parseRendererBootReport(value: unknown): RendererBootReport | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const report = value as { status?: unknown, plugins?: unknown, error?: unknown, workbenchReady?: unknown }
  if (report.status === 'healthy') return { status: 'healthy' }
  if (report.status !== 'failed') return undefined
  if (!Array.isArray(report.plugins) || report.plugins.length > MAX_FAILED_PLUGINS) return undefined
  if (!report.plugins.every(isPackageName)) return undefined
  if (report.error !== undefined && (typeof report.error !== 'string' || report.error.length > MAX_FAILURE_MESSAGE_LENGTH)) return undefined
  if (report.workbenchReady !== undefined && typeof report.workbenchReady !== 'boolean') return undefined
  return {
    status: 'failed',
    plugins: [...new Set(report.plugins)],
    ...(typeof report.workbenchReady === 'boolean' ? { workbenchReady: report.workbenchReady } : {}),
    ...(typeof report.error === 'string' && report.error !== '' ? { error: report.error } : {}),
  }
}

/** 从结构化客户端报告中选出首个可安全呈现给用户的包名。 */
export function suspectedPluginFromRendererReport(value: unknown): string | undefined {
  const report = parseRendererBootReport(value)
  if (report?.status === 'failed') return report.plugins?.[0]
  if (typeof value !== 'object' || value === null || (value as { status?: unknown }).status !== 'failed') return undefined
  return sanitizePlugins((value as { plugins?: unknown }).plugins)[0]
}

function parseDiagnostic(value: unknown): StartupDiagnostic | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const diagnostic = value as Partial<StartupDiagnostic>
  if (diagnostic.version !== STARTUP_DIAGNOSTIC_VERSION || !isTimestamp(diagnostic.startedAt) || !isStage(diagnostic.stage)) return undefined
  if (diagnostic.mode !== undefined && !isMode(diagnostic.mode)) return undefined
  if (diagnostic.lastHealthyAt !== undefined && !isTimestamp(diagnostic.lastHealthyAt)) return undefined
  if (diagnostic.failure !== undefined) {
    const failure = diagnostic.failure
    if (typeof failure !== 'object' || failure === null
      || (failure.source !== 'process' && failure.source !== 'renderer' && failure.source !== 'renderer-timeout')
      || typeof failure.message !== 'string' || failure.message.length > MAX_FAILURE_MESSAGE_LENGTH
      || !Array.isArray(failure.plugins) || !failure.plugins.every(isPackageName)
      || !isTimestamp(failure.occurredAt)) return undefined
  }
  return diagnostic as StartupDiagnostic
}

export async function readStartupDiagnostic(path: string): Promise<StartupDiagnostic | undefined> {
  try {
    return parseDiagnostic(JSON.parse(await readFile(path, 'utf8')))
  } catch {
    return undefined
  }
}

async function writeStartupDiagnostic(path: string, value: StartupDiagnostic): Promise<void> {
  await writeTextFileAtomic(path, `${JSON.stringify(value, undefined, 2)}\n`)
}

/** 开始一轮诊断，保留上一轮已验证可用的启动时间作恢复证据。 */
export async function beginStartupDiagnostic(path: string, stage: Exclude<StartupDiagnosticStage, 'healthy'>, options: BeginStartupDiagnosticOptions = {}): Promise<void> {
  const previous = await readStartupDiagnostic(path)
  await writeStartupDiagnostic(path, {
    version: STARTUP_DIAGNOSTIC_VERSION,
    mode: options.mode ?? 'normal',
    startedAt: options.startedAt ?? new Date().toISOString(),
    stage,
    ...(previous?.lastHealthyAt === undefined ? {} : { lastHealthyAt: previous.lastHealthyAt }),
  })
}

export async function advanceStartupDiagnostic(path: string, stage: Exclude<StartupDiagnosticStage, 'healthy'>): Promise<void> {
  const current = await readStartupDiagnostic(path)
  await writeStartupDiagnostic(path, {
    version: STARTUP_DIAGNOSTIC_VERSION,
    mode: current?.mode ?? 'normal',
    startedAt: current?.startedAt ?? new Date().toISOString(),
    stage,
    ...(current?.lastHealthyAt === undefined ? {} : { lastHealthyAt: current.lastHealthyAt }),
  })
}

export async function failStartupDiagnostic(path: string, input: StartupDiagnosticFailureInput, occurredAt = new Date().toISOString()): Promise<void> {
  const current = await readStartupDiagnostic(path)
  await writeStartupDiagnostic(path, {
    version: STARTUP_DIAGNOSTIC_VERSION,
    mode: current?.mode ?? 'normal',
    startedAt: current?.startedAt ?? occurredAt,
    stage: input.stage,
    ...(current?.lastHealthyAt === undefined ? {} : { lastHealthyAt: current.lastHealthyAt }),
    failure: {
      source: input.source,
      message: input.message.slice(0, MAX_FAILURE_MESSAGE_LENGTH),
      plugins: sanitizePlugins(input.plugins),
      occurredAt,
    },
  })
}

export async function completeStartupDiagnostic(path: string, healthyAt = new Date().toISOString()): Promise<void> {
  const current = await readStartupDiagnostic(path)
  const mode = current?.mode ?? 'normal'
  await writeStartupDiagnostic(path, {
    version: STARTUP_DIAGNOSTIC_VERSION,
    mode,
    startedAt: current?.startedAt ?? healthyAt,
    stage: 'healthy',
    ...(mode === 'normal'
      ? { lastHealthyAt: healthyAt }
      : current?.lastHealthyAt === undefined ? {} : { lastHealthyAt: current.lastHealthyAt }),
  })
}
