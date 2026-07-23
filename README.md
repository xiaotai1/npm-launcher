# NPM Launcher

一个基于 Electron + Vue 3 的桌面项目工作台，用于集中管理多个 NPM 项目的启动、停止、日志和终端，并集成 nvm Node.js 版本管理。

## 功能特性

### 项目管理
- 添加、编辑和删除 NPM 项目，自动读取 `package.json` 中的 scripts
- 文件夹分组、收藏、搜索筛选和拖拽排序
- 项目总览、运行状态统计和最近活动记录
- 快速打开项目目录或在 VS Code 中打开

### 进程管理
- 一键启动/停止 `npm run <command>`
- 批量启动/停止所有项目，实时同步运行状态
- 区分手动停止与异常退出，并支持跨平台进程树终止
- Windows GBK 编码智能解码

### 日志与错误分析
- 实时彩色日志流，按项目保留会话内日志历史
- 每次启动自动写入日志文件，支持导出并自动清理 30 天前的记录
- 异常退出时识别端口占用、依赖缺失、编译错误等常见问题并给出建议

### Node.js 版本管理
- 查看 nvm 已安装版本并切换全局 Node.js 版本
- 为不同项目指定 Node.js 版本，通过独立 PATH 运行进程和终端
- 支持 nvm-windows，以及 macOS/Linux 上的 nvm-sh 目录结构

### 终端
- 内置 xterm.js + node-pty 交互终端
- 复制/粘贴（Ctrl+Shift+C/V、右键）
- 自动进入项目目录并使用项目指定的 Node.js 版本

### UI/UX
- 浅色、深色、跟随系统三种主题模式
- 可折叠、可调宽度的项目侧边栏
- 项目总览与日志、终端、项目信息三类专注工作区
- 自定义窗口标题栏和原生窗口控制

## 技术栈

| 技术 | 说明 |
|------|------|
| Electron 29 | 桌面应用框架 |
| Vue 3.4 | 渲染进程 UI |
| TypeScript 5.3 | 类型安全 |
| electron-vite 2.0 | 构建工具 |
| @xterm/xterm 6 | 日志展示与内嵌终端 |
| node-pty | PTY 交互 |
| electron-builder | 打包分发 |

## 快速开始

### 环境要求
- Node.js >= 18
- [nvm](https://github.com/nvm-sh/nvm)（用于 Node 版本管理功能）

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run dev
```

### 构建与检查
```bash
npm run build      # 编译应用
npm run test       # 运行测试
npm run typecheck  # TypeScript 类型检查
npm run lint       # ESLint 检查
```

### 打包发布
```bash
npm run dist        # 打包当前平台（自动版本号 +1）
npm run dist:all    # 打包 macOS 和 Windows（自动版本号 +1）
npm run dist:win    # 以当前版本打包 Windows（NSIS + Portable）
npm run dist:mac    # 以当前版本打包 macOS（DMG）
```

打包版本规则：

| 命令 | 版本变化 | 示例 |
|------|----------|------|
| `npm run dist` | patch +1 | 1.0.0 → 1.0.1 |
| `npm run dist -- --minor` | minor +1 | 1.0.0 → 1.1.0 |
| `npm run dist -- --major` | major +1 | 1.0.0 → 2.0.0 |
| `npm run dist:ask` | 交互式输入 | 提示输入版本号 |
| `npm run dist:win` | 保持当前版本 | 仅打包 Windows |
| `npm run dist:mac` | 保持当前版本 | 仅打包 macOS |

## 项目结构

```
src/
├── main/                    # Electron 主进程
│   ├── index.ts             # 窗口创建、应用生命周期
│   ├── ipc.ts               # IPC 处理器
│   ├── configManager.ts     # 项目、文件夹与主题配置持久化
│   ├── processManager.ts    # NPM 进程启停、状态与实时日志
│   ├── ptyManager.ts        # PTY 终端管理
│   ├── logManager.ts        # 日志文件、导出与错误分析
│   ├── platform.ts          # 跨平台 shell、nvm 与项目环境
│   └── sudoExecutor.ts      # Windows 命令执行与 UAC 提权
├── preload/
│   └── index.ts             # 预加载桥接
└── renderer/                # 渲染进程（Vue 3）
    ├── index.html
    └── src/
        ├── main.ts          # Vue 应用入口
        ├── app/             # 应用壳与主题逻辑
        │   ├── App.vue
        │   └── useAppTheme.ts
        ├── features/        # 按业务能力拆分的功能模块
        │   ├── projects/    # 项目总览、侧边栏、表单与筛选
        │   ├── workspace/   # 项目工作区、上下文栏与活动状态
        │   ├── terminal/    # 实时日志、终端与终端主题
        │   └── error-analysis/ # 异常诊断对话框
        └── shared/          # 共享类型、样式、UI 与窗口组件
            ├── styles/
            ├── types/
            ├── ui/
            └── window/
```

## 安全

- `contextIsolation: true` + `nodeIntegration: false`
- 所有主进程通信通过 `contextBridge` + `ipcMain.handle`

## 许可证

MIT
