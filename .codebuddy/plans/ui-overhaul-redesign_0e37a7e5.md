---
name: ui-overhaul-redesign
overview: 全面优化 npm-launcher 项目 UI：空状态页面（增大 Hero + 信息密度 + 科技感）、项目总览网格比例调整、左侧菜单交互增强（折叠/hover/拖拽反馈）、项目设置改造为左侧目录+右侧表单布局，整体风格科技感简约大方。
design:
  architecture:
    framework: vue
  styleKeywords:
    - Nano-Tech
    - Clean Minimalism
    - Glassmorphism
    - Subtle Gradient
    - High Contrast
    - Breathing Glow
    - Compact Layering
  fontSystem:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, sans-serif
    heading:
      size: 28px
      weight: 750
    subheading:
      size: 16px
      weight: 650
    body:
      size: 13px
      weight: 400
  colorSystem:
    primary:
      - "#3B82F6"
      - "#2563EB"
      - "#1D4ED8"
    background:
      - "#F8FAFC"
      - "#FFFFFF"
      - "#0F172A"
      - "#1E293B"
    text:
      - "#0F172A"
      - "#475569"
      - "#94A3B8"
      - "#E2E8F0"
    functional:
      - "#22C55E"
      - "#EF4444"
      - "#F59E0B"
      - "#3B82F6"
todos:
  - id: sidebar-interaction
    content: 使用 [skill:vue] 和 [skill:frontend-design] 重写 WorkspaceSidebar.vue 交互：文件夹折叠过渡动画、项目卡片 hover 指示条、拖拽视觉线索、搜索框 focus 发光
    status: completed
  - id: overview-empty-state
    content: 重写 ProjectOverview.vue 空状态：Hero 放大（120px 图标 + 28px 标题）、5 层背景装饰 + 点阵纹理、2 列引导卡片、3 步流程条
    status: completed
  - id: overview-grid-rebalance
    content: 重构 ProjectOverview.vue 有数据状态：统计卡片 2:1:1 不等宽网格、活动面板宽度与高度自适应、整体比例优化
    status: completed
    dependencies:
      - overview-empty-state
  - id: settings-redesign
    content: 使用 [skill:vue] 和 [skill:frontend-design] 重写 ProjectInfoPanel.vue：左侧 200px 目录导航 + 右侧表单区域 + sticky 保存按钮
    status: completed
  - id: cards-and-dialog-polish
    content: 微调 ProjectCard.vue、CreateProjectDialog.vue、ProjectContextBar.vue 样式：统一圆角 14px、渐变边框、hover 效果、输入框发光环
    status: completed
    dependencies:
      - overview-grid-rebalance
  - id: global-tokens
    content: 在 main.css 中新增全局 CSS 变量（--shadow-xl、--border-gradient）和动画关键帧（collapse、glow-pulse、indicator-slide）
    status: completed
  - id: app-shell-tune
    content: 微调 App.vue：侧边栏默认宽度 272px、过渡时间统一 250ms
    status: completed
    dependencies:
      - sidebar-interaction
  - id: accessibility-review
    content: 使用 [skill:web-design-guidelines] 审查全部改动，检查 focus 状态、对比度、键盘导航、动画偏好
    status: completed
    dependencies:
      - sidebar-interaction
      - overview-grid-rebalance
      - settings-redesign
      - cards-and-dialog-polish
---

## 产品概述
对 NPM Launcher 桌面应用进行全盘 UI 视觉翻新，统一风格为**科技感 + 简约大方**，覆盖空状态、项目总览、左侧菜单、项目设置页四大核心区域。

## 核心功能

### 1. 空状态页面放大重构
- 大幅增大中心 Hero 区域：图标从 72px 增至 120px，标题从 22px 增至 28px，背景光晕翻倍
- 增加背景装饰层：多层渐变色块 + 网格/点阵纹理，增强科技感
- 引导卡片从 3 列改为 2 列更大卡片，信息密度更高
- 新增底部"快速上手"步骤条（1-2-3 流程引导）

### 2. 项目总览网格比例重构
- 统计卡片改为 2:1:1 不等宽布局（全部项目占 2 份，运行中/异常各 1 份）
- 项目卡片网格保持 2 列，但右侧活动面板从 1/3 缩窄至更合理的宽度
- 活动面板高度由固定 360px 改为自适应内容
- "会话"面板内部活动列表增加最大高度 + 滚动，避免撑开布局

### 3. 左侧菜单交互增强
- 文件夹折叠/展开增加 300ms 高度过渡动画
- 项目卡片 hover 时显示左侧渐变指示条 + 背景色渐入
- 拖拽时源卡片半透明 + 目标位置显示蓝色插入线（2px）
- 搜索框聚焦时增加发光边框动画
- "项目总览"导航按钮 active 状态增加左侧竖线指示

### 4. 项目设置页布局改造
- 改为左侧垂直目录导航（基础设置 / 运行环境 / 危险操作 三个分组）
- 右侧对应显示表单内容区域
- 当前激活的导航项高亮 + 左侧指示条
- 保存按钮固定在右下角，跟随滚动

### 5. 全局风格统一
- 所有卡片圆角从 12px 统一为 14px
- 增加 subtle 渐变边框替代纯色边框
- 全局阴影层次细化（sm/md/lg/xl 四档）
- 表单输入框统一 focus 发光效果


## 技术方案

### 技术栈
- **前端框架**：Vue 3 Composition API + TypeScript（已有，不改动）
- **样式方案**：Tailwind v4 工具类 + Scoped CSS 自定义属性（已有，不改动）
- **主题系统**：CSS 自定义属性双主题 light/dark（已有，不改动）
- **无外部 UI 库引入**：保持零依赖，全部手写

### 实施策略

#### 高优先级（用户痛点直接相关）

1. **ProjectOverview.vue 空状态与网格重构**
   - 需要读取 `ProjectCard.vue` 了解卡片尺寸，确保网格比例协调
   - 新增 `.empty-hero-large` 样式块：120px 图标、28px 标题、更大光晕
   - 背景装饰从 3 个 blob 升级为 5 个 + 网格纹理
   - `.overview-main-grid` 改为 `grid-template-columns: 2fr 1fr`（项目区占 2/3，活动面板占 1/3）
   - 活动面板 `height: 360px` 改为 `max-height: calc(100vh - 280px)` + overflow-y auto

2. **ProjectInfoPanel.vue 布局改造**
   - 新增 `settingsNav` 导航状态（`basic` / `environment` / `danger`）
   - 布局改为两栏：`grid-template-columns: 200px 1fr`
   - 左侧为垂直目录导航（粘性定位 sticky top: 0）
   - 右侧为表单内容区域，根据 active nav 切换显示
   - 底部保存按钮变为 sticky bottom
   - 完全重写 CSS（从目前的 491 行中保留功能逻辑，重写模板和样式）

3. **WorkspaceSidebar.vue 交互增强**
   - 文件夹折叠增加 `<Transition name="collapse">` 包裹 `v-show` 内容
   - CSS `.collapse-enter-active` / `.collapse-leave-active` 过渡动画
   - 项目卡片 hover 增加 `::before` 渐变指示条（从左边缘滑入）
   - 拖拽增加 `.drag-ghost` 类（半透明 + 边框虚线）
   - 拖入目标文件夹增加 `.drop-target-folder` 高亮类（蓝色虚线边框 + 背景色）
   - 搜索框 focus 增加 `box-shadow` 动画过渡

#### 中优先级（配合整体优化）

4. **ProjectCard.vue 微调**
   - 圆角从当前值统一为 14px
   - 边框从纯色改为 `color-mix()` 渐变
   - hover 状态增加 `translateY(-2px)` + 阴影升级
   - 状态指示点增大 1px

5. **CreateProjectDialog.vue 微调**
   - 弹窗圆角 14px
   - 背景遮罩增加 backdrop-filter blur
   - 输入框 focus 发光效果统一

6. **ProjectContextBar.vue 微调**
   - 按钮 hover 背景色统一
   - 状态标签 pill 样式统一

7. **App.vue 微调**
   - 侧边栏默认宽度从 260px 增加到 272px
   - 过渡动画时间从 280ms 调为 250ms

#### 低优先级（全局基础）

8. **main.css 全局变量与动画新增**
   - 新增 `--shadow-xl` 阴影变量
   - 新增 `--border-gradient` 渐变边框变量
   - 新增 `collapse-enter/leave` 动画关键帧
   - 新增 `glow-pulse` 输入框发光动画
   - 新增 `indicator-slide` 侧边指示条动画

### 实施注意事项

- **性能**：折叠动画使用 `max-height` 过渡而非 `height: auto`，避免 layout thrashing
- **主题兼容**：所有新增颜色必须使用 CSS 变量或 `color-mix()`，确保 light/dark 双主题都美观
- **回退兼容**：不改变任何 props / emits 接口，只改模板和样式
- **避免破坏**：不改动 xterm.js 终端组件（LogConsole.vue 和 Terminal.vue）的核心功能逻辑
- **代码复用**：ProjectInfoPanel 的逻辑（loadScripts / save / selectFolder）保留，只改布局和样式



## 设计风格

采用 **Nano-Tech（纳米科技）** 融合 **Clean Minimalism（极致简约）** 的设计风格，整体呈现精致、轻盈、高对比度的科技感。

### 主题定位
- **科技感**：通过微妙渐变边框、发光焦点环、半透明玻璃态面板、深色模式下蓝色调为主
- **简约大方**：减少多余分割线，用留白和层次替代；卡片圆角统一 14px，间距系统化（4/8/12/16/20/24/32）
- **轻盈感**：降低边框不透明度（从当前 ~0.12 降至 ~0.08），背景使用 `color-mix()` 做半透叠加

### 页面规划

#### 1. 项目总览页（ProjectOverview）

**空状态（无项目时）**
- 顶部 Hero 区：120px 圆角图标方块（18px 圆角），内含三维层次感的网格图标
- 图标外圈 2 层呼吸光环（border + box-shadow），动画周期分别为 3s 和 2.4s
- 标题 28px / 750 weight，"添加第一个 NPM 项目"
- 副标题 14px，包含 `package.json` 的 code 标签样式
- 大号 CTA 按钮（48px 高，14px 圆角，渐变背景）
- 背景 5 层装饰 blob + subtle 点阵网格纹理
- 下方"快速开始" 3 步流程条（1. 选择目录 → 2. 确认脚本 → 3. 启动运行），每步带图标和箭头连接
- 再下方 2 列引导卡片（卡片增大至 200px 最小高度）

**有项目时**
- 统计卡片 2:1:1 不等宽网格
- 运行中卡片 accent 渐变背景，异常卡片 error 淡红背景
- 项目卡片网格 2 列，右侧活动面板缩窄至约 280px
- 活动面板内列表 max-height 自适应，滚动区域带自定义滚动条

#### 2. 左侧菜单（WorkspaceSidebar）

- 搜索框 focus 时边框从透明渐变为 accent 色，外发光 0 0 0 3px accent-glow
- "项目总览"按钮 active 状态左侧 2px accent 竖线 + 背景色
- 文件夹折叠/展开：chevron 旋转 90deg 动画 250ms，子项目区从 `max-height: 0` 过渡到 `max-height: 2000px`
- 项目卡片 hover：左侧出现 3px 渐变指示条（accent 色从透明到实色），背景色平滑过渡
- 拖拽源：opacity 0.4 + 边框虚线
- 拖入目标文件夹：蓝色虚线边框 + accent-glow 背景

#### 3. 项目设置页（ProjectInfoPanel）

- 左侧 200px 目录导航栏（sticky），白色/深色背景，三组导航项：
  - 基础设置（名称、路径、启动脚本）
  - 运行环境（Node 版本）
  - 危险操作（移除项目）
- 激活项左侧 2px accent 竖线 + accent 色文字 + 浅色背景
- 右侧表单区域 560px 最大宽度，居中显示
- 输入框 12px 圆角，focus 发光环
- 保存按钮 sticky 在右下角
- 移除按钮红色，独立成 danger zone 卡片

#### 4. 新建项目弹窗

- 弹窗圆角 16px，阴影升级
- Tab 切换（项目 / 文件夹）使用 pill 形状按钮
- 输入框样式统一

### 响应式
- 窗口宽度 < 900px：侧边栏自动折叠
- 窗口宽度 < 700px：总览页统计卡片单列、项目卡片单列
- 设置页在小窗口下目录导航折叠为顶部 tab 条


## 使用的 Agent 扩展

### Skill
- **frontend-design**
  - 用途：在重写空状态、项目设置页、侧边栏交互时，提供有意识的视觉设计指导和审美方向，确保不走默认模板风格，达成科技感 + 简约的目标
  - 预期产出：每个组件的配色方案、圆角系统、阴影层次、动画缓动曲线建议

- **vue**
  - 用途：确保 Vue SFC 模板改造（尤其是 ProjectInfoPanel 改为左侧导航 + 右侧表单时）符合 Vue 3 Composition API 最佳实践，正确使用 Transition、v-model、defineProps/defineEmits
  - 预期产出：正确的 Vue 3 语法、Transition 组件配置、响应式状态管理建议

- **web-design-guidelines**
  - 用途：在完成主要改造后审查 UI 代码，确保可访问性、交互状态（focus/hover/active/disabled）、对比度、键盘导航符合 Web 设计规范
  - 预期产出：可访问性审查报告和改进建议
