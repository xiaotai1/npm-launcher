import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const workspaceSource = readFileSync('src/renderer/src/features/workspace/components/ProjectWorkspace.vue', 'utf-8')
const infoSource = readFileSync('src/renderer/src/features/projects/components/ProjectInfoPanel.vue', 'utf-8')
const appSource = readFileSync('src/renderer/src/app/App.vue', 'utf-8')
const toastSource = readFileSync('src/renderer/src/shared/ui/Toast.vue', 'utf-8')

test('项目配置入口命名为项目设置', () => {
  assert.match(workspaceSource, />项目设置<\/button>/)
  assert.equal(workspaceSource.includes('>项目信息</button>'), false)
})

test('项目设置页不重复顶部项目栏的只读信息和打开操作', () => {
  assert.match(infoSource, /settings-page/)
  assert.match(infoSource, /保存设置/)
  assert.equal(infoSource.includes('项目信息'), false)
  assert.equal(infoSource.includes('btn-quick-action'), false)
  assert.equal(infoSource.includes('VS Code'), false)
  assert.equal(infoSource.includes('在文件管理器中打开'), false)
})

test('项目设置页默认展示可编辑配置项', () => {
  assert.match(infoSource, /v-model="editForm\.name"/)
  assert.match(infoSource, /v-model="editForm\.path"/)
  assert.match(infoSource, /v-model="editForm\.command"/)
  assert.match(infoSource, /v-model="editForm\.nodeVersion"/)
  assert.equal(infoSource.includes('v-if="!isEditing"'), false)
})

test('项目设置仅在存在未保存修改时允许保存和还原', () => {
  assert.match(infoSource, /const isDirty = computed/)
  assert.match(infoSource, /class="settings-secondary"[^>]*:disabled="!isDirty"[^>]*>还原修改<\/button>/)
  assert.match(infoSource, /class="settings-primary"[^>]*:disabled="!canSave"/)
})

test('还原修改后给出明确提示', () => {
  assert.match(infoSource, /emit\('toast', '已还原未保存的修改', 'success'\)/)
})

test('保存项目设置根据落盘结果提示成功或失败', () => {
  assert.match(appSource, /const saved = await window\.desktopAPI\.updateProject\(project\)/)
  assert.match(appSource, /if \(!saved\)[\s\S]*showToast\('项目设置保存失败', 'error'\)/)
  assert.match(appSource, /showToast\('项目设置已保存', 'success'\)/)
})

test('相同内容的操作提示可以连续显示', () => {
  assert.match(appSource, /const toastSequence = ref\(0\)/)
  assert.match(appSource, /toastSequence\.value \+= 1/)
  assert.match(appSource, /:sequence="toastSequence"/)
  assert.match(toastSource, /sequence\?: number/)
  assert.match(toastSource, /watch\(\(\) => \[props\.message, props\.sequence\] as const/)
})

test('项目设置的两个下拉框使用统一的自定义箭头间距', () => {
  assert.equal(infoSource.match(/class="settings-select"/g)?.length, 2)
  assert.match(infoSource, /\.settings-select select\s*\{[^}]*appearance: none[^}]*padding-right: 40px/)
  assert.match(infoSource, /\.settings-select-icon\s*\{[^}]*right: 14px[^}]*pointer-events: none/)
})

test('项目设置使用无外框的全页布局', () => {
  assert.equal(infoSource.includes('settings-shell detail'), false)
  assert.equal(infoSource.includes('settings-form-card'), false)
  assert.equal(infoSource.includes('settings-danger-zone'), false)
  assert.equal(workspaceSource.includes(':deep(.detail)'), false)
  assert.match(infoSource, /settings-content/)
  assert.match(infoSource, /settings-section/)
  assert.match(workspaceSource, /\.info-panel :deep\(\.settings-page\)/)
})

test('项目设置目录使用标准 tab 语义支持首次按下切换', () => {
  assert.match(infoSource, /class="settings-nav"[^>]*role="tablist"/)
  assert.match(infoSource, /role="tab"/)
  assert.match(infoSource, /:aria-selected="activeSection === item\.id"/)
  assert.match(infoSource, /role="tabpanel"/)
})

test('项目设置分区立即挂载且淡入不超过 100ms', () => {
  assert.equal(infoSource.includes('mode="out-in"'), false)

  const duration = infoSource.match(/\.settings-section\s*\{[^}]*animation:\s*fadeIn\s+([\d.]+)(ms|s)/)
  assert.ok(duration)
  const durationMs = Number(duration[1]) * (duration[2] === 's' ? 1000 : 1)
  assert.ok(durationMs <= 100, `设置分区淡入耗时 ${durationMs}ms，超过 100ms`)
})

test('移除项目操作保持低干扰并明确保留本地文件', () => {
  assert.match(infoSource, /class="danger-zone"/)
  assert.match(infoSource, /class="danger-remove-btn"/)
  assert.match(infoSource, /从启动器移除/)
  assert.match(infoSource, /不会删除本地目录/)
  assert.match(infoSource, /title="移除项目"/)
  assert.equal(infoSource.includes('settings-danger-zone'), false)
})
