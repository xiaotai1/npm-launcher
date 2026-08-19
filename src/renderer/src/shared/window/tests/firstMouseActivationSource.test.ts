import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const activationPath = 'src/renderer/src/shared/window/firstMouseActivation.ts'
const appSource = readFileSync('src/renderer/src/app/App.vue', 'utf-8')

test('应用统一安装编辑态首次鼠标激活处理', () => {
  assert.equal(existsSync(activationPath), true)
  const activationSource = readFileSync(activationPath, 'utf-8')

  assert.match(appSource, /installFirstMouseActivation/)
  assert.match(appSource, /if \(isMac\) cleanupFirstMouseActivation = installFirstMouseActivation\(\)/)
  assert.match(activationSource, /document\.activeElement/)
  assert.match(activationSource, /closest\(FIRST_MOUSE_TARGETS\)/)
  assert.match(activationSource, /document\.addEventListener\('mouseup'/)
  assert.match(activationSource, /function activateTarget\(target: HTMLElement\)/)
  assert.match(activationSource, /target\.click\(\)/)
  assert.match(activationSource, /\[data-first-mouse-target\]/)
})

test('首次激活在鼠标释放时执行并允许拖离取消', () => {
  const activationSource = readFileSync(activationPath, 'utf-8')
  const mouseDownBody = activationSource.match(/function handleMouseDown[\s\S]*?\n  }\n\n  function handleMouseUp/)?.[0] || ''

  assert.equal(mouseDownBody.includes('.click()'), false)
  assert.match(activationSource, /function handleMouseUp\(event: MouseEvent\)/)
  assert.match(activationSource, /releaseTarget !== pressedTarget/)
  assert.match(activationSource, /clearPressedTarget\(\)/)
})

test('首次激活只处理编辑控件到可操作控件的左键切换', () => {
  assert.equal(existsSync(activationPath), true)
  const activationSource = readFileSync(activationPath, 'utf-8')

  assert.match(activationSource, /event\.button !== 0/)
  assert.match(activationSource, /isEditableElement\(activeElement\)/)
  assert.match(activationSource, /target\.matches\(':disabled'\)/)
})

test('提前激活后抑制同一控件随后产生的物理点击', () => {
  assert.equal(existsSync(activationPath), true)
  const activationSource = readFileSync(activationPath, 'utf-8')

  assert.match(activationSource, /event\.detail === 0/)
  assert.match(activationSource, /event\.stopImmediatePropagation\(\)/)
  assert.match(activationSource, /window\.addEventListener\('blur'/)
})
