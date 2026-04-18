# NPM Launcher 功能优化计划

## Context
用户希望为 NPM Launcher 添加快捷操作按钮（打开文件夹、VS Code 打开项目）、项目搜索筛选和批量操作功能，同时优化 UI 布局。

---

## 一、现有功能清单

| 模块 | 功能 |
|------|------|
| **项目管理** | 添加/编辑/删除项目、文件夹分组、收藏、拖拽排序 |
| **进程管理** | 启动/停止 npm run 命令、实时日志流、进程状态管理 |
| **日志控制台** | 彩色日志（stdout/stderr/info/error）、自动滚动、清空、时间戳 |
| **终端** | xterm.js 嵌入终端、PTY 交互、复制粘贴、自适应大小 |
| **Node 版本** | NVM 版本列表、切换版本（提权）、广播到所有终端 |
| **主题** | 浅色/深色/系统三种模式 |
| **UI 交互** | 右键上下文菜单、拖拽到文件夹、收藏星标 |

---

## 二、功能 A — 打开文件夹 & 打开 VS Code

### Step 1: 主进程 IPC 处理器 — [ipc.ts](src/main/ipc.ts)

添加两个新 IPC handler：

- **`open-in-file-manager`** — 使用 `shell.openPath(path)` 打开系统文件管理器
- **`open-in-vscode`** — 使用 `execAsync('code "' + path + '"')` 启动 VS Code

需在 ipc.ts 顶部 import 中添加 `shell`。

### Step 2: Preload 桥接 — [preload/index.ts](src/preload/index.ts)

暴露两个新方法：`openInFileManager`、`openInVscode`

### Step 3: 类型定义 — [types/index.ts](src/renderer/src/types/index.ts)

在 `electronAPI` 接口中添加对应方法签名。

### Step 4: ProjectDetail.vue 路径行按钮 — [ProjectDetail.vue](src/renderer/src/components/ProjectDetail.vue)

路径显示行末尾添加两个图标按钮（文件夹图标 + VS Code 图标）：
- 路径行改为 flex 布局，路径文字支持 ellipsis 截断 + hover tooltip
- 右侧放置操作按钮组（28x28 圆角图标按钮，hover 变色）
- 新增 `openFolder()` 和 `openInVscode()` 方法
- 新增 `toast` emit 事件用于错误反馈

### Step 5: ProjectList.vue 右键菜单 — [ProjectList.vue](src/renderer/src/components/ProjectList.vue)

在项目右键菜单中添加：
- 「打开文件夹」选项（文件夹图标）
- 「在 VS Code 中打开」选项（代码图标）
- 放在「编辑」和「删除」之间，分隔线分开「删除」

### Step 6: App.vue Toast 联动 — [App.vue](src/renderer/src/App.vue)

监听 ProjectDetail 的 `toast` 事件，显示提示信息（如 VS Code 未安装）。

---

## 三、功能 B — 项目搜索筛选

### 实现（纯前端，无需 IPC 改动）

**文件**: [ProjectList.vue](src/renderer/src/components/ProjectList.vue)

1. 在 `list-header` 区域下方添加搜索输入框（带搜索图标、清空按钮）
2. 添加 `searchQuery` ref 和 `filteredProjects` computed：
   - 按项目名称、路径、命令模糊匹配
   - 搜索为空时显示全部项目
3. 搜索框样式：
   - 与新建项目按钮同行或紧邻下方
   - 圆角输入框，带放大镜图标前缀
   - 输入时有清空 × 按钮
4. 过滤逻辑需兼容现有文件夹分组结构：
   - 搜索时展平显示（忽略文件夹分组，直接列出匹配项）
   - 或仅在对应文件夹内过滤（保持分组结构）
   - **推荐方案**: 搜索时保持文件夹分组，仅显示包含匹配项目的文件夹

---

## 四、功能 C — 批量操作（启动/停止所有）

### Step 1: 主进程 IPC — [ipc.ts](src/main/ipc.ts)

复用已有的 `processManager`：
- **`start-all-projects`** — 遍历所有项目，调用 `startProject()` 启动
- **`stop-all-projects`** — 直接调用已有的 `stopAllProcesses()`（processManager 已导出）

### Step 2: Preload 桥接 — [preload/index.ts](src/preload/index.ts)

暴露 `startAllProjects` 和 `stopAllProjects` 方法。

### Step 3: 类型定义 — [types/index.ts](src/renderer/src/types/index.ts)

添加对应接口声明。

### Step 4: UI 按钮位置 — [ProjectList.vue](src/renderer/src/components/ProjectList.vue)

在侧边栏头部区域（`list-header`）添加：
- 「全部启动」按钮（播放图标 + 文字）
- 「全部停止」按钮（停止图标 + 文字）
- 放在「+ 新建」按钮旁边或下方
- 有项目正在运行时，「全部停止」按钮高亮显示

### Step 5: App.vue 事件处理 — [App.vue](src/renderer/src/App.vue)

处理批量操作的 IPC 调用和结果反馈（toast 提示成功/失败数量）。

---

## 五、UI 布局优化

| 优化项 | 说明 | 涉及文件 |
|--------|------|----------|
| 路径文字截断 | 长路径 ellipsis + hover tooltip | ProjectDetail.vue |
| 工具栏视觉分组 | 启动/停止为主操作，清空日志为次操作 | ProjectDetail.vue |
| 图标按钮样式 | 统一 28x28 圆角、hover 变色主题适配 | main.css |
| 搜索框样式 | 放大镜图标、清空按钮、聚焦高亮 | ProjectList.vue |
| 批量操作按钮 | 与新建按钮协调的视觉风格 | ProjectList.vue |

---

## 六、涉及文件清单

| 文件 | 改动类型 |
|------|----------|
| [src/main/ipc.ts](src/main/ipc.ts) | 新增 4 个 IPC handler（打开文件夹、打开 VS Code、启动全部、停止全部） |
| [src/preload/index.ts](src/preload/index.ts) | 新增 4 个桥接方法 |
| [src/renderer/src/types/index.ts](src/renderer/src/types/index.ts) | 新增 4 个接口声明 |
| [src/renderer/src/components/ProjectDetail.vue](src/renderer/src/components/ProjectDetail.vue) | 路径行快捷按钮 + toast emit + 样式 |
| [src/renderer/src/components/ProjectList.vue](src/renderer/src/components/ProjectList.vue) | 搜索框 + 批量操作按钮 + 右键菜单新选项 |
| [src/renderer/src/App.vue](src/renderer/src/App.vue) | 监听 toast 事件 + 批量操作方法 |
| [src/renderer/src/styles/main.css](src/renderer/src/styles/main.css) | 图标按钮通用样式 |

---

## 七、实现顺序

1. IPC 处理器 + Preload + 类型定义（基础设施层）
2. ProjectDetail.vue 快捷按钮（打开文件夹 / VS Code）
3. ProjectList.vue 右键菜单新选项
4. ProjectList.vue 搜索筛选功能
5. 批量操作（启动/停止全部）
6. UI 布局微调和样式优化

---

## 八、验证方式

1. `npm run dev` 启动开发模式
2. 详情页路径行点击文件夹图标 → 在 Finder/Explorer 中打开项目目录
3. 详情页点击 VS Code 图标 → 在 VS Code 中打开项目
4. 右键菜单中测试「打开文件夹」和「在 VS Code 中打开」
5. 搜索框输入关键字 → 项目列表实时过滤
6. 搜索框清空 → 恢复完整列表
7. 点击「全部启动」→ 所有项目依次启动，日志正常输出
8. 点击「全部停止」→ 所有运行中项目停止
9. 浅色/深色主题切换 → 所有新 UI 元素样式适配
