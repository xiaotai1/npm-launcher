<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

type Option = { label: string; value: string } | string

const props = withDefaults(defineProps<{
  modelValue: string
  options: Option[]
  placeholder?: string
  disabled?: boolean
}>(), {
  placeholder: '请选择',
  disabled: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = ref(false)
const highlightIndex = ref(-1)
const triggerRef = ref<HTMLButtonElement | null>(null)
const menuRef = ref<HTMLUListElement | null>(null)
const menuStyle = ref<{ top: string; left: string; minWidth: string }>({ top: '0', left: '0', minWidth: '200px' })

const normalized = computed<{ label: string; value: string }[]>(() =>
  props.options.map(option =>
    typeof option === 'string' ? { label: option, value: option } : option
  )
)

const selected = computed(() =>
  normalized.value.find(option => option.value === props.modelValue)
)

function positionMenu() {
  const trigger = triggerRef.value
  const menu = menuRef.value
  if (!trigger || !menu) return
  const rect = trigger.getBoundingClientRect()
  const menuHeight = menu.offsetHeight
  const viewportHeight = window.innerHeight
  const gap = 6

  let top: number
  if (rect.bottom + menuHeight + gap <= viewportHeight) {
    top = rect.bottom + gap
  } else {
    top = Math.max(gap, rect.top - menuHeight - gap)
  }

  menuStyle.value = {
    top: `${Math.round(top)}px`,
    left: `${Math.round(rect.left)}px`,
    minWidth: `${Math.max(rect.width, 200)}px`
  }
}

function toggle() {
  if (props.disabled) return
  open.value = !open.value
  if (open.value) {
    const index = normalized.value.findIndex(option => option.value === props.modelValue)
    highlightIndex.value = index
    nextTick(() => {
      positionMenu()
      scrollHighlightIntoView()
    })
  }
}

function select(value: string) {
  emit('update:modelValue', value)
  close()
}

function close() {
  open.value = false
}

function scrollHighlightIntoView() {
  const menu = menuRef.value
  if (!menu) return
  const target = menu.querySelector<HTMLElement>(`[data-index="${highlightIndex.value}"]`)
  if (target) target.scrollIntoView({ block: 'nearest' })
}

function onKeydown(event: KeyboardEvent) {
  if (!open.value) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggle()
    }
    return
  }
  const max = normalized.value.length - 1
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    highlightIndex.value = Math.min(max, highlightIndex.value + 1)
    nextTick(scrollHighlightIntoView)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    highlightIndex.value = Math.max(0, highlightIndex.value - 1)
    nextTick(scrollHighlightIntoView)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const option = normalized.value[highlightIndex.value]
    if (option) select(option.value)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    close()
  }
}

function onDocumentClick(event: MouseEvent) {
  if (!open.value) return
  const el = event.target as Node
  if (triggerRef.value && !triggerRef.value.contains(el)) {
    close()
  }
}

function onWindowResize() {
  if (open.value) positionMenu()
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentClick)
  window.addEventListener('resize', onWindowResize)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentClick)
  window.removeEventListener('resize', onWindowResize)
})

watch(() => props.modelValue, () => {
  if (open.value) close()
})
</script>

<template>
  <div class="custom-select" :class="{ open, disabled }" @keydown="onKeydown">
    <button
      ref="triggerRef"
      type="button"
      class="custom-select-trigger"
      :disabled="disabled"
      aria-haspopup="listbox"
      :aria-expanded="open"
      @click="toggle"
    >
      <span class="custom-select-value" :class="{ placeholder: !selected }">
        {{ selected ? selected.label : placeholder }}
      </span>
      <svg
        class="custom-select-arrow"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <Teleport to="body">
      <Transition name="custom-select-pop">
        <ul
          v-if="open"
          ref="menuRef"
          class="custom-select-menu"
          :style="menuStyle"
          role="listbox"
          :aria-label="placeholder"
        >
          <li
            v-for="(option, index) in normalized"
            :key="option.value"
            :data-index="index"
            :class="['custom-select-option', {
              active: index === highlightIndex,
              selected: option.value === modelValue
            }]"
            role="option"
            :aria-selected="option.value === modelValue"
            @mouseenter="highlightIndex = index"
            @mousedown.prevent="select(option.value)"
          >
            <span>{{ option.label }}</span>
            <svg v-if="option.value === modelValue" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="custom-select-check">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </li>
        </ul>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.custom-select {
  position: relative;
  min-width: 0;
}

.custom-select-trigger {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 40px;
  padding: 0 40px 0 12px;
  border: 1px solid var(--border-default);
  border-radius: 12px;
  color: var(--text-primary);
  background: var(--bg-surface);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: border-color 200ms ease, box-shadow 200ms ease;
}

.custom-select.open .custom-select-trigger,
.custom-select:focus-within .custom-select-trigger {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--accent-glow), 0 0 12px color-mix(in srgb, var(--accent-glow) 80%, transparent);
  outline: none;
}

.custom-select-trigger:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.custom-select-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
}

.custom-select-value.placeholder {
  color: var(--text-tertiary);
}

.custom-select-arrow {
  position: absolute;
  top: 50%;
  right: 14px;
  color: var(--text-secondary);
  transform: translateY(-50%);
  transition: transform 200ms ease;
  pointer-events: none;
}

.custom-select.open .custom-select-arrow {
  color: var(--accent-primary);
  transform: translateY(-50%) rotate(180deg);
}

.custom-select-menu {
  position: fixed;
  z-index: 3000;
  max-height: 260px;
  overflow-y: auto;
  margin: 0;
  padding: 4px;
  list-style: none;
  border: 1px solid var(--border-muted);
  border-radius: 10px;
  background: var(--bg-elevated);
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18), 0 2px 6px rgba(15, 23, 42, 0.1);
}

.custom-select-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 9px;
  border-radius: 7px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}

.custom-select-option:hover,
.custom-select-option.active {
  background: var(--accent-glow);
  color: var(--text-primary);
}

.custom-select-option span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.custom-select-option.selected {
  color: var(--text-primary);
}

.custom-select-check {
  flex: none;
  color: var(--accent-primary);
}

.custom-select-pop-enter-active,
.custom-select-pop-leave-active {
  transition: opacity 140ms ease, transform 140ms ease;
}

.custom-select-pop-enter-from,
.custom-select-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
