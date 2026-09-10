<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  visible: boolean
  title: string
  eyebrow?: string
  size?: 'sm' | 'md' | 'lg'
  closeable?: boolean
  /** 打开时自动聚焦到哪个元素：默认聚焦关闭按钮之前可聚焦的首个元素 */
  autofocus?: 'close' | 'first' | 'none'
  /** 对话框关闭后是否需要恢复调用者焦点（默认 true） */
  restoreFocus?: boolean
}>()

const emit = defineEmits<{ close: [] }>()

const dialogRef = ref<HTMLElement | null>(null)
const closeButtonRef = ref<HTMLButtonElement | null>(null)
const titleId = `base-dialog-title-${crypto.randomUUID()}`
let previouslyFocused: HTMLElement | null = null

function onClose() {
  if (props.closeable === false) return
  emit('close')
}

function restorePreviousFocus() {
  const target = previouslyFocused
  previouslyFocused = null
  if (target?.isConnected) nextTick(() => target.focus())
}

function handleDialogKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    if (props.closeable !== false) onClose()
    return
  }
  if (event.key !== 'Tab' || !dialogRef.value) return

  const focusable = Array.from(
    dialogRef.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter(el => el !== closeButtonRef.value || props.closeable !== false)
  if (!focusable.length) return

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(
  () => props.visible,
  visible => {
    if (visible) {
      previouslyFocused =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      nextTick(() => {
        if (props.autofocus === 'none') return
        if (props.autofocus === 'first' && dialogRef.value) {
          const focusable = Array.from(
            dialogRef.value.querySelectorAll<HTMLElement>(
              'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
          )
          // 跳过关闭按钮，优先聚焦正文/操作区的首个可聚焦元素
          const first = focusable.find(el => el !== closeButtonRef.value)
          const target = first || (props.closeable !== false ? closeButtonRef.value : null)
          target?.focus()
          return
        }
        if (props.closeable !== false) closeButtonRef.value?.focus()
      })
    } else if (props.restoreFocus !== false) {
      restorePreviousFocus()
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (props.restoreFocus !== false) restorePreviousFocus()
})
</script>

<template>
  <Teleport to="body">
    <Transition :name="size === 'lg' ? 'base-dialog-lg' : 'base-dialog'">
      <div
        v-if="visible"
        class="base-dialog-backdrop"
        :class="`size-${size || 'md'}`"
        @mousedown.self="onClose"
      >
        <section
          ref="dialogRef"
          class="base-dialog"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          @keydown="handleDialogKeydown"
        >
          <header v-if="title" class="base-dialog-header">
            <div>
              <p v-if="eyebrow">{{ eyebrow }}</p>
              <h2 :id="titleId">{{ title }}</h2>
            </div>
            <button
              v-if="closeable !== false"
              ref="closeButtonRef"
              class="base-dialog-close"
              type="button"
              aria-label="关闭窗口"
              @click="onClose"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18"/>
              </svg>
            </button>
          </header>

          <div class="base-dialog-body">
            <slot />
          </div>

          <footer v-if="$slots.footer" class="base-dialog-footer">
            <slot name="footer" />
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.base-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: grid;
  place-items: center;
  padding: 28px;
  background: var(--modal-backdrop);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  -webkit-app-region: no-drag;
}

.base-dialog {
  position: relative;
  width: min(420px, calc(100vw - 40px));
  overflow: hidden;
  color: var(--text-primary);
  border: 1px solid var(--glass-border);
  border-radius: 18px;
  background: color-mix(in srgb, var(--bg-surface) 96%, transparent);
  backdrop-filter: blur(28px) saturate(170%);
  -webkit-backdrop-filter: blur(28px) saturate(170%);
  box-shadow: var(--glass-shadow);
}

.base-dialog-backdrop.size-lg .base-dialog {
  width: min(500px, calc(100vw - 40px));
}

.base-dialog::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--glass-edge);
  pointer-events: none;
}

.base-dialog-header {
  position: relative;
  z-index: 1;
  min-height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-muted);
  background: color-mix(in srgb, var(--bg-surface) 88%, transparent);
}

.base-dialog-header p {
  margin: 0 0 4px;
  color: var(--text-tertiary);
  font: 700 10px/1 var(--font-mono);
  letter-spacing: 0.14em;
}

.base-dialog-header h2 {
  margin: 0;
  font-size: 17px;
  line-height: 1.35;
  letter-spacing: -0.025em;
}

.base-dialog-close {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  flex: none;
  border-radius: 8px;
  color: var(--text-tertiary);
}

.base-dialog-close:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.base-dialog-body {
  position: relative;
  z-index: 1;
  background: color-mix(in srgb, var(--bg-surface) 82%, var(--bg-subtle));
}

.base-dialog-footer {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--border-muted);
  background: color-mix(in srgb, var(--bg-surface) 92%, var(--bg-subtle));
}

:global(:root[data-theme='dark']) .base-dialog-backdrop {
  background: var(--modal-backdrop);
}

.base-dialog-enter-active,
.base-dialog-leave-active {
  transition: opacity 180ms ease;
}

.base-dialog-enter-active .base-dialog,
.base-dialog-leave-active .base-dialog,
.base-dialog-lg-enter-active .base-dialog,
.base-dialog-lg-leave-active .base-dialog {
  transition: transform 180ms ease, opacity 180ms ease;
}

.base-dialog-enter-from,
.base-dialog-leave-to,
.base-dialog-lg-enter-from,
.base-dialog-lg-leave-to {
  opacity: 0;
}

.base-dialog-enter-from .base-dialog,
.base-dialog-leave-to .base-dialog,
.base-dialog-lg-enter-from .base-dialog,
.base-dialog-lg-leave-to .base-dialog {
  opacity: 0;
  transform: translateY(6px) scale(0.985);
}

@media (prefers-reduced-motion: reduce) {
  .base-dialog-enter-active,
  .base-dialog-leave-active,
  .base-dialog-enter-active .base-dialog,
  .base-dialog-leave-active .base-dialog,
  .base-dialog-lg-enter-active,
  .base-dialog-lg-leave-active,
  .base-dialog-lg-enter-active .base-dialog,
  .base-dialog-lg-leave-active .base-dialog {
    transition-duration: 0s;
  }
}
</style>