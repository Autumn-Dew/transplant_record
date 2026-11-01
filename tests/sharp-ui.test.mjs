import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = p => readFileSync(path.join(ROOT, p), 'utf8')

function sourceFiles(dir) {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.(css|vue|js)$/.test(name) ? [full] : []
  })
}

test('零圆角契约最后加载并覆盖所有 HTML UI', () => {
  const app = read('src/App.vue')
  assert.match(app, /@import '@\/assets\/css\/sharp-ui\.css';/)
  assert.ok(app.indexOf('sharp-ui.css') > app.indexOf('theme-refresh.css'))

  const css = read('src/assets/css/sharp-ui.css')
  assert.match(css, /html body #app \*/)
  assert.match(css, /border-radius: 0 !important/)
  assert.match(css, /::file-selector-button/)
  assert.match(css, /::-webkit-scrollbar-thumb/)
})

test('应用源码中不再声明任何非零 border-radius', () => {
  const files = sourceFiles(path.join(ROOT, 'src'))
  const violations = []
  for (const file of files) {
    const src = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    for (const match of src.matchAll(/border-radius\s*:\s*([^;]+);/g)) {
      const value = match[1].trim()
      if (!/^(?:0|0px)(?:\s+(?:0|0px)){0,3}(?:\s*!important)?$/.test(value)) {
        violations.push(`${path.relative(ROOT, file)}: ${value}`)
      }
    }
  }
  assert.deepEqual(violations, [])
})