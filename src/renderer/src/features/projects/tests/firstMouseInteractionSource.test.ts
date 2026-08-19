import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const createDialogSource = readFileSync(
  'src/renderer/src/features/projects/components/CreateProjectDialog.vue',
  'utf-8'
)
const workspaceSource = readFileSync(
  'src/renderer/src/features/workspace/components/ProjectWorkspace.vue',
  'utf-8'
)

test('新建弹窗使用原生点击并交由应用统一处理首次激活', () => {
  assert.match(createDialogSource, /@click="selectMode\('project'\)"/)
  assert.match(createDialogSource, /@click="selectMode\('folder'\)"/)
  assert.match(createDialogSource, /@click="requestClose"/)
  assert.equal(createDialogSource.includes('@mousedown.left.prevent'), false)
  assert.equal(createDialogSource.includes('@pointerdown.left.prevent'), false)
})

test('创建按钮保留原生表单提交和键盘激活', () => {
  const submitButton = createDialogSource.match(/<button(?=[^>]*class="submit-button")[^>]*>/)?.[0] || ''
  assert.match(submitButton, /type="submit"/)
  assert.equal(submitButton.includes('@mousedown'), false)
  assert.equal(submitButton.includes('@click'), false)
  assert.match(createDialogSource, /@keydown\.enter="handleSubmitKeydown"/)
  assert.match(createDialogSource, /function handleSubmitKeydown\(event: KeyboardEvent\)/)
})

test('工作区标签使用原生点击并交由应用统一处理首次激活', () => {
  assert.match(workspaceSource, /class="workspace-tabs workspace-tab-strip"[^>]*role="tablist"/)
  assert.equal(workspaceSource.match(/role="tab"/g)?.length, 3)
  assert.equal(workspaceSource.match(/:aria-selected="activeTab ===/g)?.length, 3)
  assert.match(workspaceSource, /@click="selectTab\('logs'\)"/)
  assert.match(workspaceSource, /@click="selectTab\('terminal'\)"/)
  assert.match(workspaceSource, /@click="selectTab\('info'\)"/)
  assert.equal(workspaceSource.includes('@mousedown.left.prevent'), false)
  assert.equal(workspaceSource.includes('@pointerdown.left.prevent'), false)
})
