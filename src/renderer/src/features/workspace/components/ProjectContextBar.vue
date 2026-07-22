<script setup lang="ts">
import type { ProcessStatus, Project } from '../../../shared/types'

defineProps<{
  project: Project
  status: ProcessStatus | null
  globalNodeVersion: string | null
}>()

const emit = defineEmits<{
  start: []
  stop: []
  edit: []
  'open-folder': []
  'open-vscode': []
}>()
</script>

<template>
  <header class="project-context-bar">
    <div class="project-context-main">
      <div class="project-title-row">
        <h1 :title="project.name">{{ project.name }}</h1>
        <span :class="['context-status', status?.status || 'stopped']">
          <i aria-hidden="true"></i>
          {{ status?.status === 'running' ? '运行中' : status?.status === 'error' ? '异常' : '未启动' }}
          <span v-if="status?.pid">· PID {{ status.pid }}</span>
        </span>
      </div>
      <div class="project-context-meta">
        <span class="project-path" :title="project.path">{{ project.path }}</span>
        <code>npm run {{ project.command }}</code>
        <span>Node {{ project.nodeVersion || globalNodeVersion || '系统' }}</span>
      </div>
    </div>
    <div class="project-context-actions">
      <button class="icon-action" aria-label="打开项目目录" title="打开项目目录" @click="emit('open-folder')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H10l2 2h6.5A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"/></svg>
      </button>
      <button class="icon-action" aria-label="使用 VS Code 打开" title="使用 VS Code 打开" @click="emit('open-vscode')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m16 5 5 3v8l-5 3-9-7z"/><path d="m7 12-4-3 2-2 4 3m-2 2-4 3 2 2 4-3"/></svg>
      </button>
      <button class="button-secondary" @click="emit('edit')">编辑</button>
      <button v-if="status?.status === 'running'" class="context-primary stop" @click="emit('stop')">停止</button>
      <button v-else class="context-primary" @click="emit('start')">启动</button>
    </div>
  </header>
</template>

<style scoped>
.project-context-bar { min-height: 88px; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 16px 22px; border-bottom: 1px solid var(--border-default); background: var(--bg-surface); }
.project-context-main { min-width: 0; }.project-title-row { display: flex; align-items: center; gap: 10px; min-width: 0; }
h1 { min-width: 0; margin: 0; overflow: hidden; color: var(--text-primary); font-size: 18px; line-height: 1.2; letter-spacing: -.03em; text-overflow: ellipsis; white-space: nowrap; }
.context-status { display: inline-flex; align-items: center; gap: 5px; padding: 4px 8px; border-radius: 999px; color: var(--text-tertiary); background: var(--bg-subtle); font: 10px var(--font-mono); }
.context-status i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }.context-status.running { color: var(--success); background: var(--success-bg); }.context-status.error { color: var(--error); background: var(--error-bg); }
.project-context-meta { display: flex; align-items: center; gap: 10px; margin-top: 9px; color: var(--text-tertiary); font: 11px var(--font-mono); }
.project-path { max-width: 360px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.project-context-meta code { padding: 4px 7px; border-radius: 6px; color: var(--accent-primary); background: var(--accent-glow); }
.project-context-actions { display: flex; align-items: center; gap: 7px; flex: none; }.icon-action { width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid var(--border-default); border-radius: 8px; color: var(--text-secondary); background: var(--bg-surface); }.icon-action:hover { color: var(--accent-primary); border-color: var(--accent-border); background: var(--bg-hover); }
.context-primary { min-width: 68px; min-height: 34px; padding: 0 14px; border-radius: 8px; color: #fff; background: var(--accent-primary); font-size: 12px; font-weight: 700; }.context-primary.stop { background: var(--error); }
</style>
