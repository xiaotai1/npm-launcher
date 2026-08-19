import assert from 'node:assert/strict'
import test from 'node:test'
import type { Project } from '../../../shared/types'
import { extractLocalPort, projectDisplayMeta, projectSecondaryLabel, pathTail } from '../model/projectDisplay'

const project: Project = {
  id: 'project-1',
  name: 'front',
  path: '/Users/xiaotai/gitspace/universe/front',
  command: 'dev'
}

test('项目展示信息提取路径最后一级目录', () => {
  assert.equal(pathTail('/Users/xiaotai/gitspace/universe/front'), 'front')
  assert.equal(pathTail('/Users/xiaotai/gitspace/universe/front/'), 'front')
})

test('项目展示信息从本地地址提取端口', () => {
  assert.equal(extractLocalPort('http://localhost:5202'), ':5202')
  assert.equal(extractLocalPort('https://127.0.0.1:5173/app'), ':5173')
  assert.equal(extractLocalPort('http://[::1]:5202'), ':5202')
  assert.equal(extractLocalPort('http://example.com'), null)
})

test('项目展示信息优先用本地端口区分同名项目', () => {
  assert.equal(projectSecondaryLabel(project, 'http://localhost:5202'), ':5202')
})

test('项目展示信息没有本地端口时用目录名兜底', () => {
  assert.equal(projectSecondaryLabel(project, null), 'front')
})

test('项目展示信息组合启动命令和辅助标识', () => {
  assert.equal(projectDisplayMeta(project, 'http://localhost:5202'), 'npm run dev · :5202')
  assert.equal(projectDisplayMeta(project, null), 'npm run dev · front')
})
