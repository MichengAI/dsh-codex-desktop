import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const tag = process.argv[2] || process.env.GITHUB_REF_NAME
const outputPath = process.argv[3] || 'release-notes.md'

if (!tag) {
  throw new Error('Usage: node scripts/extract-release-notes.mjs <tag> [output]')
}

const version = tag.replace(/^v/, '')

function getHeaderVersion(line) {
  const bracketed = line.match(/^##\s+\[([^\]]+)\]/)
  if (bracketed) return bracketed[1]

  const snapshot = line.match(/^##\s+Snapshot\s+`([^`]+)`/)
  if (snapshot) return snapshot[1]

  const plain = line.match(/^##\s+([^\s—]+)/)
  return plain?.[1] || null
}

function extractSection(path) {
  if (!existsSync(path)) return null

  const lines = readFileSync(path, 'utf8').split(/\r?\n/)
  const start = lines.findIndex((line) => getHeaderVersion(line) === version)
  if (start < 0) return null

  const next = lines.findIndex((line, index) => index > start && line.startsWith('## '))
  const end = next < 0 ? lines.length : next
  const body = lines.slice(start + 1, end).join('\n').trim()
  return body || null
}

const chinese = extractSection('CHANGELOG.zh-CN.md')
const english = extractSection('CHANGELOG.md')

if (!chinese && !english) {
  throw new Error(`No changelog section found for ${tag}`)
}

const sections = []
if (chinese && english) {
  sections.push(`## 中文说明\n\n${chinese}`)
  sections.push(`## English\n\n${english}`)
} else {
  sections.push(chinese || english)
}

writeFileSync(outputPath, `${sections.join('\n\n---\n\n')}\n`)
console.log(`Wrote release notes for ${tag} to ${outputPath}`)
