// ═══════════════════════════════════════════════════════════════════
// 表单与模板引用的静态契约（回归锁定）
//
//   1. 模板里 @事件="onXxx" 引用的处理函数必须在 <script setup> 中定义 ——
//      否则点击时报 ReferenceError（「强制删除」按钮曾经如此）。
//   2. 强制删除与其它写操作一样走「连点 4 次」确认。
//   3. 代肝代办 / 蓝图表单只承载表单字段：id / host / payments 等不进表单，
//      否则「编辑 → 取消 → 新增」会把旧 id 一起提交。
//   4. 取消编辑与保存共用同一套表单复位（resetForms）。
// ═══════════════════════════════════════════════════════════════════
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const srcRoot = fileURLToPath(new URL('../src/', import.meta.url))
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

function vueFiles(dir = srcRoot, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) vueFiles(p, out)
    else if (p.endsWith('.vue')) out.push(p)
  }
  return out
}

test('模板引用的 onXxx 处理函数都有定义（防止点击时 ReferenceError）', () => {
  const missing = []
  for (const file of vueFiles()) {
    const src = readFileSync(file, 'utf8')
    const scriptAt = src.indexOf('<script')
    if (scriptAt < 0) continue
    const tpl = src.slice(0, scriptAt)
    const script = src.slice(scriptAt)
    const used = new Set([...tpl.matchAll(/@[a-zA-Z]+="\s*(on[A-Z]\w*)/g)].map(m => m[1]))
    for (const name of used) {
      const declared = new RegExp(`(function\\s+${name}\\b|const\\s+${name}\\s*=|let\\s+${name}\\s*=)`).test(script)
      if (!declared) missing.push(`${path.relative(srcRoot, file)} → ${name}`)
    }
  }
  assert.deepEqual(missing, [], `模板引用了未定义的处理函数：${missing.join(', ')}`)
})

test('强制删除与其它写操作一样走「连点 4 次」确认', () => {
  const src = read('src/components/ProjectDetail.vue')
  assert.match(src, /@click="onForceRemove"/, '按钮要绑定到处理函数')
  assert.match(src, /function onForceRemove\(\)[^\n]*cfm\.trigger\('force-remove'\)/, '必须走统一确认机制')
  assert.match(src, /function onForceRemove\(\)[^\n]*emit\('force-remove'\)/, '确认后要派发给父组件')
})

test('代肝代办 / 蓝图表单只承载表单字段', () => {
  const src = read('src/views/AddPage.vue')
  const at = src.indexOf('function fillTaskForm')
  assert.ok(at > 0, 'fillTaskForm 必须存在')
  const fill = src.slice(at, src.indexOf('\n}', at))
  assert.doesNotMatch(fill, /\.\.\.rec/, '编辑态填充不能整条记录塞进表单（会带入 id / host / payments）')
  assert.match(fill, /pickFormFields\(rec, TASK_FORM_FIELDS\)/)
  assert.match(src, /const TASK_FORM_FIELDS = Object\.keys\(defaultTask\(\)\)/)
  assert.match(src, /pickFormFields\(rec, BLUEPRINT_FORM_FIELDS\)/)
})

test('取消编辑与保存共用同一套表单复位', () => {
  const src = read('src/views/AddPage.vue')

  const cancelAt = src.indexOf('function cancelEdit')
  const cancel = src.slice(cancelAt, src.indexOf('\n}', cancelAt))
  assert.match(cancel, /clearEdit\(\)/)
  assert.match(cancel, /resetForms\(\)/, '取消后必须复位表单，否则残留上一条记录')

  const resetAt = src.indexOf('function resetForms')
  const reset = src.slice(resetAt, src.indexOf('\n}', resetAt))
  assert.match(reset, /taskForm\.value = defaultTask\(\)/)
  assert.match(reset, /blueprintForm\.value = defaultBlueprint\(\)/)
  assert.match(reset, /selectedTemplate\.value = ''/)
  assert.match(reset, /selectedBlueprint\.value = ''/)

  for (const fn of ['function saveTask', 'function saveBlueprint', 'function confirmRenewal']) {
    const i = src.indexOf(fn)
    assert.ok(i > 0, `${fn} 必须存在`)
    const body = src.slice(i, src.indexOf('\n}', i))
    assert.match(body, /resetForms\(\)/, `${fn} 应复用 resetForms()`)
  }
})
