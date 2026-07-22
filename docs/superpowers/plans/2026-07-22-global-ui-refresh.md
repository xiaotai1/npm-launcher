# Global UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the complete NPM Launcher renderer around a restrained professional-console visual system without changing business behavior, IPC contracts, or persisted data.

**Architecture:** Keep the current Vue component and event boundaries. Establish semantic design tokens and shared interaction rules in `main.css`, then restyle each existing component group in dependency order: shell, navigation, project workspace, console, and overlays. Add a lightweight Node test that protects the agreed UI contract without introducing a new test framework.

**Tech Stack:** Electron 29, Vue 3.4, TypeScript 5.3, Tailwind CSS 4, electron-vite 2, Node built-in test runner.

## Global Constraints

- Do not change Electron IPC channels, preload APIs, project configuration shape, or process-management behavior.
- Keep light, dark, and system theme modes.
- The in-app title bar displays `NPM Launcher` text only; do not render the application icon there.
- Keep `build/icon.svg`, `build/icon.png`, and `build/icon.ico` unchanged for OS-level surfaces.
- Use semantic CSS variables for component colors; do not add scattered component hex colors.
- Use the existing system sans-serif and monospace stacks; do not add remote fonts or a UI framework.
- Keep the title bar 48px tall, with macOS traffic-light spacing and existing Windows window controls.
- Preserve sidebar resizing, collapsing, drag-and-drop, favorites, folders, process actions, log history, terminal behavior, dialogs, and notifications.
- Respect `prefers-reduced-motion: reduce` and retain visible keyboard focus.

---

### Task 1: UI Contract and Global Design Tokens

**Files:**
- Create: `tests/ui-contract.test.mjs`
- Modify: `package.json`
- Modify: `src/renderer/src/styles/main.css`

**Interfaces:**
- Consumes: Existing `data-theme` values `light`, `dark`, and `system` resolved by the renderer.
- Produces: Shared CSS custom properties `--control-height`, `--radius-control`, `--radius-panel`, `--focus-ring`, `--sidebar-bg`, and the reusable classes `.ui-button`, `.ui-icon-button`, `.ui-panel`, `.ui-empty-state`.

- [ ] **Step 1: Write the failing UI contract test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('global UI tokens and accessibility rules exist', async () => {
  const css = await read('src/renderer/src/styles/main.css')
  for (const token of ['--control-height', '--radius-control', '--radius-panel', '--focus-ring']) {
    assert.match(css, new RegExp(token))
  }
  assert.match(css, /:focus-visible/)
  assert.match(css, /prefers-reduced-motion:\s*reduce/)
})
```

- [ ] **Step 2: Add and run the UI test script to verify failure**

Add to `package.json` scripts:

```json
"test:ui": "node --test tests/ui-contract.test.mjs"
```

Run: `npm run test:ui`

Expected: FAIL because the new control, radius, focus, and reduced-motion contracts are absent.

- [ ] **Step 3: Replace the theme foundation with semantic professional-console tokens**

Define the shared scale in `main.css` and update both theme blocks:

```css
:root {
  --control-height: 32px;
  --radius-control: 7px;
  --radius-panel: 12px;
  --focus-ring: 0 0 0 3px var(--accent-glow);
  --duration-fast: 150ms;
  --duration-normal: 200ms;
}

button:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible,
[tabindex]:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Remove decorative glow gradients from the theme tokens, reduce shadows to overlay use, and add `.ui-button`, `.ui-icon-button`, `.ui-panel`, and `.ui-empty-state` in `@layer components`.

- [ ] **Step 4: Run token verification**

Run: `npm run test:ui && npm run typecheck`

Expected: both commands PASS.

- [ ] **Step 5: Commit the token foundation**

```bash
git add package.json tests/ui-contract.test.mjs src/renderer/src/styles/main.css
git commit -m "style: establish renderer design system"
```

### Task 2: Application Shell and Title Bar

**Files:**
- Modify: `tests/ui-contract.test.mjs`
- Modify: `src/renderer/src/components/Header.vue`
- Modify: `src/renderer/src/components/WindowControls.vue`
- Modify: `src/renderer/src/App.vue`

**Interfaces:**
- Consumes: Global button, radius, focus, surface, border, and motion tokens from Task 1.
- Produces: `.app-header`, `.header-title`, `.node-version-control`, `.app-shell`, `.workspace-shell`, and platform-specific `.mac-traffic-light` spacing.

- [ ] **Step 1: Extend the failing title-bar contract**

```js
test('title bar is text-only and exposes accessible controls', async () => {
  const header = await read('src/renderer/src/components/Header.vue')
  assert.match(header, />NPM Launcher</)
  assert.doesNotMatch(header, /build\/icon|class="[^"]*(logo|app-icon)/)
  assert.match(header, /aria-label="切换主题"/)
  assert.match(header, /class="[^"]*header-title/)
})
```

Run: `npm run test:ui`

Expected: FAIL because the title class and accessible theme label are absent.

- [ ] **Step 2: Restyle the header as a compact native toolbar**

Use this structure in `Header.vue` while preserving all dropdown logic and emitted events:

```vue
<header class="app-header">
  <div class="header-left" :class="{ 'mac-traffic-light': isMac }">
    <span class="header-title">NPM Launcher</span>
  </div>
  <div class="header-actions">
    <div ref="dropdownRef" class="relative"><!-- existing Node dropdown --></div>
    <button class="ui-icon-button theme-btn" aria-label="切换主题" @click="emit('toggle-theme')">
      {{ themeIcon[theme] }}
    </button>
    <WindowControls v-if="!isMac" />
  </div>
</header>
```

Keep the header at 48px. Use `padding-left: 80px` on macOS, which places text roughly 12px after native traffic lights, and `20px` on Windows. Remove the glow divider and Node badge glow.

- [ ] **Step 3: Normalize Windows controls and the application shell**

In `WindowControls.vue`, add `aria-label` to all three controls and use restrained hover states, with red only on Close. In `App.vue`, replace decorative shell gradients with a stable `app-shell` grid, solid borders, and a `workspace-shell` that gives logs the remaining height.

- [ ] **Step 4: Verify shell behavior**

Run: `npm run test:ui && npm run typecheck`

Expected: PASS, including the text-only title contract.

- [ ] **Step 5: Commit the shell**

```bash
git add tests/ui-contract.test.mjs src/renderer/src/components/Header.vue src/renderer/src/components/WindowControls.vue src/renderer/src/App.vue
git commit -m "style: refine application shell and title bar"
```

### Task 3: Project Navigation Sidebar

**Files:**
- Modify: `tests/ui-contract.test.mjs`
- Modify: `src/renderer/src/components/ProjectList.vue`
- Modify: `src/renderer/src/App.vue`

**Interfaces:**
- Consumes: Existing `ProjectList` props and emits without signature changes; shared global design tokens.
- Produces: `.project-sidebar`, `.project-list-toolbar`, `.project-row`, `.folder-row`, `.sidebar-batch-actions`, and visible status text plus dot.

- [ ] **Step 1: Add a failing sidebar hierarchy contract**

```js
test('project navigation exposes the professional console hierarchy', async () => {
  const list = await read('src/renderer/src/components/ProjectList.vue')
  for (const className of ['project-list-toolbar', 'project-row', 'sidebar-batch-actions']) {
    assert.match(list, new RegExp(className))
  }
  assert.match(list, /aria-label="清除搜索"/)
})
```

Run: `npm run test:ui`

Expected: FAIL because the semantic navigation classes and search label do not exist.

- [ ] **Step 2: Reorganize the existing sidebar template without changing behavior**

Add `project-list-toolbar` to the header containing the existing new-folder and new-project buttons. Add `sidebar-search` to the existing search wrapper, `sidebar-batch-actions` to the wrapper containing the current `start-all` and `stop-all` emits, and `project-row` to every favorite, folder-contained, and root project card. Add `aria-label="清除搜索"` to the existing search-clear button. Keep folder drag/drop, project drag/drop, favorites, context menus, and inline forms unchanged. Move only the batch-action visual block to the fixed sidebar footer through CSS/layout, not event changes.

- [ ] **Step 3: Apply sidebar state styling**

Use a solid dark navigation background, narrow blue active indicator, quiet hover state, visible running/error/stopped label, compact 36–42px project rows, and 44px minimum interactive targets for icon-only actions where space permits. Replace star glyph animation and card gradients with restrained opacity and border changes.

- [ ] **Step 4: Verify navigation contracts and types**

Run: `npm run test:ui && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the navigation update**

```bash
git add tests/ui-contract.test.mjs src/renderer/src/components/ProjectList.vue src/renderer/src/App.vue
git commit -m "style: unify project navigation sidebar"
```

### Task 4: Project Workspace and Forms

**Files:**
- Modify: `tests/ui-contract.test.mjs`
- Modify: `src/renderer/src/components/ProjectDetail.vue`
- Modify: `src/renderer/src/components/ConfirmDialog.vue`

**Interfaces:**
- Consumes: Existing `ProjectDetail` props and emits; global button and form styles.
- Produces: `.project-summary`, `.project-meta`, `.project-actions`, `.status-badge`, and consistent edit-form field groups.

- [ ] **Step 1: Add a failing workspace contract**

```js
test('project workspace groups summary, metadata, and actions', async () => {
  const detail = await read('src/renderer/src/components/ProjectDetail.vue')
  for (const className of ['project-summary', 'project-meta', 'project-actions']) {
    assert.match(detail, new RegExp(className))
  }
  assert.doesNotMatch(detail, /linear-gradient\(135deg/)
})
```

Run: `npm run test:ui`

Expected: FAIL on the new groups and existing gradient buttons.

- [ ] **Step 2: Recompose the project summary**

Add `project-summary` to the display-mode header, `project-heading` around the current name/status/PID cluster, `project-actions` around Start or Stop plus Edit, Open, VS Code, and Delete, and `project-meta` around the existing Path, Command, and Node rows. Preserve `start`, `stop`, `update`, `delete`, `set-node-version`, folder selection, VS Code, and file-manager calls. Keep Start/Stop as the single primary action and remove the duplicate Clear Logs button from project details because the console toolbar owns log tools.

- [ ] **Step 3: Normalize form and confirmation styles**

Keep all visible labels in edit mode, use global input focus styles, align Browse/Cancel/Save buttons with the shared hierarchy, and restyle `ConfirmDialog.vue` with the same panel, overlay, and dangerous-action tokens. Add `aria-modal="true"`, `role="dialog"`, and a descriptive label to the dialog.

- [ ] **Step 4: Verify workspace contracts and types**

Run: `npm run test:ui && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the workspace update**

```bash
git add tests/ui-contract.test.mjs src/renderer/src/components/ProjectDetail.vue src/renderer/src/components/ConfirmDialog.vue
git commit -m "style: restructure project workspace"
```

### Task 5: Log Console and Interactive Terminal

**Files:**
- Modify: `tests/ui-contract.test.mjs`
- Modify: `src/renderer/src/App.vue`
- Modify: `src/renderer/src/components/LogConsole.vue`
- Modify: `src/renderer/src/components/Terminal.vue`

**Interfaces:**
- Consumes: Existing log events, terminal PTY events, active `logs | terminal` tab, export and error-analysis emits.
- Produces: `.console-tabs`, `.console-toolbar`, `.console-surface`, and matching xterm themes.

- [ ] **Step 1: Add a failing console contract**

```js
test('console uses a unified tab and toolbar surface', async () => {
  const app = await read('src/renderer/src/App.vue')
  const logs = await read('src/renderer/src/components/LogConsole.vue')
  assert.match(app, /console-tabs/)
  assert.match(logs, /console-toolbar/)
  assert.match(logs, /console-surface/)
})
```

Run: `npm run test:ui`

Expected: FAIL because the semantic console classes do not exist.

- [ ] **Step 2: Consolidate tab and log actions**

In `App.vue`, place Logs/Terminal in `.console-tabs`. In `LogConsole.vue`, use `.console-toolbar` for running state, error analysis, export, and clear-related affordances, and `.console-surface` for xterm. Keep all listeners, caching, exports, and exposed `clear()` behavior unchanged.

- [ ] **Step 3: Align xterm palettes and spacing**

Update `LogConsole.vue` and `Terminal.vue` to share the established console colors, a 13px system monospace stack, 1.45 line height, 12px horizontal padding, and consistent scrollbar styling. Do not change PTY spawn, resize, input, copy, paste, or cleanup behavior.

- [ ] **Step 4: Verify console contracts and types**

Run: `npm run test:ui && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the console update**

```bash
git add tests/ui-contract.test.mjs src/renderer/src/App.vue src/renderer/src/components/LogConsole.vue src/renderer/src/components/Terminal.vue
git commit -m "style: focus workspace on logs and terminal"
```

### Task 6: Dialogs, Toasts, Menus, and Final Verification

**Files:**
- Modify: `tests/ui-contract.test.mjs`
- Modify: `src/renderer/src/components/ErrorAnalysisDialog.vue`
- Modify: `src/renderer/src/components/Toast.vue`
- Modify: `src/renderer/src/components/ProjectList.vue`
- Modify: `src/renderer/src/styles/main.css`

**Interfaces:**
- Consumes: Existing visibility props and emit contracts.
- Produces: Unified `.overlay-panel`, `.toast`, `.context-menu`, accessible overlay semantics, and complete UI verification.

- [ ] **Step 1: Add failing overlay accessibility contracts**

```js
test('overlays expose dialog and status semantics', async () => {
  const analysis = await read('src/renderer/src/components/ErrorAnalysisDialog.vue')
  const toast = await read('src/renderer/src/components/Toast.vue')
  assert.match(analysis, /role="dialog"/)
  assert.match(analysis, /aria-modal="true"/)
  assert.match(toast, /role="status"/)
  assert.match(toast, /aria-live="polite"/)
})
```

Run: `npm run test:ui`

Expected: FAIL until overlay semantics are added.

- [ ] **Step 2: Unify overlays and context menus**

Restyle `ErrorAnalysisDialog.vue`, `Toast.vue`, and the `ProjectList.vue` context menu with shared overlay tokens. Keep analysis content, copy/export behavior, menu commands, delete confirmations, and Toast timing unchanged. Use `role="dialog" aria-modal="true"` for modal panels and `role="status" aria-live="polite"` for Toast.

- [ ] **Step 3: Run the complete automated verification**

Run: `npm run test:ui && npm run typecheck && npm run build`

Expected: UI contracts PASS, TypeScript reports no errors, and electron-vite completes main/preload/renderer production bundles successfully.

- [ ] **Step 4: Perform visual verification in the running Electron app**

Run: `npm run dev`

Check light, dark, and system themes; macOS title spacing; sidebar expanded/collapsed/resized; folders and favorites; project start/stop controls; edit/add forms; logs and terminal tabs; Node dropdown; dialogs; Toast; context menu; keyboard focus; reduced-motion emulation; and a narrow desktop window. Record any visual defects and fix them before completion.

- [ ] **Step 5: Re-run verification after visual fixes**

Run: `npm run test:ui && npm run typecheck && npm run build && git diff --check`

Expected: all commands PASS and no whitespace errors are reported.

- [ ] **Step 6: Commit final polish**

```bash
git add tests/ui-contract.test.mjs src/renderer/src/components/ErrorAnalysisDialog.vue src/renderer/src/components/Toast.vue src/renderer/src/components/ProjectList.vue src/renderer/src/styles/main.css
git commit -m "style: complete global UI refresh"
```
