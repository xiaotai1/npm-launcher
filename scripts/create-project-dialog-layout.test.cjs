const assert = require('node:assert/strict')
const fs = require('node:fs')
const test = require('node:test')
const { baseParse, NodeTypes } = require('@vue/compiler-dom')
const { parse } = require('@vue/compiler-sfc')

const filename = 'src/renderer/src/features/projects/components/CreateProjectDialog.vue'
const source = fs.readFileSync(filename, 'utf8')
const { descriptor } = parse(source, { filename })
const ast = baseParse(descriptor.template.content)

function attribute(element, name) {
  const item = element.props.find(prop => prop.type === NodeTypes.ATTRIBUTE && prop.name === name)
  return item?.value?.content || ''
}

function hasClass(element, name) {
  return attribute(element, 'class').split(/\s+/).includes(name)
}

function findElement(node, predicate) {
  if (node.type === NodeTypes.ELEMENT && predicate(node)) return node
  for (const child of node.children || []) {
    const found = findElement(child, predicate)
    if (found) return found
  }
  return null
}

function containsElement(root, target) {
  if (root === target) return true
  return (root.children || []).some(child => containsElement(child, target))
}

test('底部操作栏位于滚动表单之外', () => {
  const form = findElement(ast, node => node.tag === 'form' && hasClass(node, 'dialog-form'))
  const footer = findElement(ast, node => node.tag === 'footer' && hasClass(node, 'dialog-actions'))

  assert.ok(form)
  assert.ok(footer)
  assert.equal(containsElement(form, footer), false)
})

test('外部提交按钮关联创建表单', () => {
  const form = findElement(ast, node => node.tag === 'form' && hasClass(node, 'dialog-form'))
  const submit = findElement(ast, node => node.tag === 'button' && attribute(node, 'type') === 'submit')

  assert.ok(form)
  assert.ok(submit)
  assert.notEqual(attribute(form, 'id'), '')
  assert.equal(attribute(submit, 'form'), attribute(form, 'id'))
})
