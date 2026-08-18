# NPM Launcher Rust/Tauri 重构实施计划

> **供代理执行：** 必须使用 executing-plans 技能逐任务实施并在任务间检查。当前项目规则禁止新增、修改或运行测试代码，因此本计划以静态检查、编译、打包和双平台人工检查替代测试步骤。

**目标：** 保留现有 Vue 3 界面与全部功能，将 Electron 主进程和 preload 迁移为支持 Windows/macOS 的 Tauri 2 + Rust 应用。

**架构：** 前端增加单一 `desktopAPI`，用 Tauri commands 承载请求响应，用 events 承载日志、进程状态、错误分析和 PTY 数据。Rust `AppState` 统一管理项目进程、PTY 会话、会话日志和 Shell 环境缓存，窗口退出时集中清理。

**技术栈：** Tauri 2、Rust、Vue 3、TypeScript、Vite、xterm.js、portable-pty、serde、encoding_rs、regex。

## 全局约束

- 必须同时支持 Windows 与 macOS。
- 必须保留现有全部用户功能和配置格式。
- 所有回答、代码注释和文档使用简体中文。
- 不新增、修改或运行测试代码。
- 不运行 Maven 命令。
- 默认使用系统 WebView2，不内置离线 WebView2 运行时。
- 双平台产物必须由 Windows/macOS 原生运行器分别构建。
- 当前分支 `rust版本重构` 已是专用实施分支，不创建额外 worktree。

---

## 文件结构

新增 Rust 后端：

```text
src-tauri/
├── Cargo.toml
├── build.rs
├── tauri.conf.json
├── tauri.macos.conf.json
├── tauri.windows.conf.json
├── capabilities/default.json
└── src/
    ├── main.rs
    ├── lib.rs
    ├── commands.rs
    ├── config.rs
    ├── environment.rs
    ├── log.rs
    ├── models.rs
    ├── package.rs
    ├── process.rs
    ├── state.rs
    └── terminal.rs
```

新增前端桌面适配：

```text
src/renderer/src/shared/desktop/api.ts
```

修改构建和发布：

```text
package.json
package-lock.json
vite.config.ts
tsconfig.json
tsconfig.node.json
scripts/bump-version.js
.github/workflows/build.yml
README.md
```

现有 `src/main`、`src/preload` 和测试目录不参与新构建。受“不得修改测试代码”约束，旧测试文件及其读取的 Electron 源文件暂不删除；Electron 与 `node-pty` 依赖从新构建链移除。

---

### 任务 1：建立 Tauri 与 Vite 基础

**文件：**

- 新建：`vite.config.ts`
- 新建：`src-tauri/Cargo.toml`
- 新建：`src-tauri/build.rs`
- 新建：`src-tauri/tauri.conf.json`
- 新建：`src-tauri/tauri.macos.conf.json`
- 新建：`src-tauri/tauri.windows.conf.json`
- 新建：`src-tauri/capabilities/default.json`
- 新建：`src-tauri/src/main.rs`
- 新建：`src-tauri/src/lib.rs`
- 修改：`package.json`
- 修改：`tsconfig.json`
- 修改：`tsconfig.node.json`

**产出接口：**

- `npm run dev` 调用 `tauri dev`。
- `npm run build:frontend` 调用 `vite build`。
- `npm run build` 调用 `tauri build --no-bundle`。
- Rust 入口调用 `npm_launcher_lib::run()`。

- [x] **步骤 1：将渲染层改为独立 Vite 构建**

`vite.config.ts` 使用 `src/renderer` 作为 root，输出到 `out/renderer`，保留 Vue、Tailwind 和 `@renderer` 别名：

```ts
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  build: { outDir: resolve(__dirname, 'out/renderer'), emptyOutDir: true },
  plugins: [vue(), tailwindcss()],
  resolve: { alias: { '@renderer': resolve(__dirname, 'src/renderer/src') } }
})
```

- [x] **步骤 2：建立 Tauri Cargo 配置**

`Cargo.toml` 声明 `tauri = "2"`、`tauri-plugin-dialog = "2"`、`tauri-plugin-opener = "2"`、`serde`、`serde_json`、`portable-pty = "0.9"`、`encoding_rs`、`regex`、`url`、`chrono`，Unix 目标额外依赖带 `signal/process` 特性的 `nix`。

- [x] **步骤 3：建立窗口与平台配置**

基础窗口固定 1300×850、最小 1000×700。macOS 配置隐藏标题并保留原生交通灯；Windows 配置关闭 decorations 以继续使用自定义窗口按钮。构建读取 `../out/renderer`。

- [x] **步骤 4：建立最小 Rust 入口和 capability**

```rust
fn main() {
    npm_launcher_lib::run();
}
```

`lib.rs` 暂时只初始化 dialog/opener 插件并创建窗口，后续任务再注册状态与命令。

- [x] **步骤 5：调整 npm 与 TypeScript 配置**

增加 `@tauri-apps/api`、`@tauri-apps/plugin-dialog`、`@tauri-apps/plugin-opener` 和 `@tauri-apps/cli`；将 TypeScript 范围限制到渲染层和 `vite.config.ts`，避免旧 Electron 源码进入新构建。

- [x] **步骤 6：验证配置结构**

运行：`npm run typecheck`

预期：Vue/TypeScript 类型检查通过；不运行任何测试。

- [x] **步骤 7：提交基础设施**

```bash
git add package.json package-lock.json vite.config.ts tsconfig.json tsconfig.node.json src-tauri
git commit -m "build: 初始化 Tauri Rust 应用"
```

---

### 任务 2：迁移模型、配置、包信息与错误分析

**文件：**

- 新建：`src-tauri/src/models.rs`
- 新建：`src-tauri/src/config.rs`
- 新建：`src-tauri/src/package.rs`
- 新建：`src-tauri/src/log.rs`
- 新建：`src-tauri/src/state.rs`
- 修改：`src-tauri/src/lib.rs`

**产出接口：**

```rust
pub struct AppState {
    pub config_path: PathBuf,
    pub processes: Mutex<HashMap<String, ProcessHandle>>,
    pub terminals: Mutex<HashMap<String, PtySession>>,
    pub logs: Mutex<HashMap<String, Vec<SessionLogLine>>>,
    pub shell_env: Mutex<Option<HashMap<String, String>>>,
}

pub fn load_config(path: &Path) -> AppConfig;
pub fn save_config(path: &Path, config: &AppConfig) -> Result<(), String>;
pub fn normalize_imported_config(value: Value) -> Result<AppConfig, String>;
pub fn read_package_scripts(dir: &Path) -> PackageScriptsResult;
pub fn inspect_project_health(project: &Project) -> ProjectHealthResult;
pub fn analyze_errors(state: &AppState, project_id: &str, exit_code: i32) -> Option<ErrorAnalysis>;
```

- [x] **步骤 1：定义与前端一致的 serde 模型**

使用 `#[serde(rename_all = "camelCase")]` 定义 `Project`、`Folder`、`AppConfig`、`ProcessStatus`、`LogEntry`、`ErrorAnalysis`、`StartProjectResult` 和 `StartAllProjectsResult`；可选字段使用 `Option` 并跳过空值序列化。

- [x] **步骤 2：实现历史配置路径与原子保存**

历史目录使用系统配置根目录下的 `npm-launcher/config.json`。读取失败时将文件重命名为 `.corrupt-<毫秒时间戳>`；保存写入同目录 `.tmp` 后重命名。

- [x] **步骤 3：实现配置 CRUD 和导入归一化**

保持重复 ID、排序 ID 完整性、删除文件夹后项目回根级、收藏切换等现有规则。

- [x] **步骤 4：迁移 package scripts、包管理器与健康检查**

按 `pnpm-lock.yaml`、`yarn.lock`、`bun.lockb/bun.lock` 顺序识别包管理器，默认 npm；健康检查顺序保持路径、package.json、script、Node.js 版本。

- [x] **步骤 5：迁移内存日志和错误模式**

每项目最多保留 800 行，保持 8 类错误规则、每类最多 3 行匹配、中文建议和摘要结构。

- [x] **步骤 6：初始化共享状态**

`AppState::new` 解析配置路径并初始化空进程表、PTY 表、日志表和环境缓存；`lib.rs` 通过 `.manage(state)` 托管。

- [x] **步骤 7：静态验证并提交**

Rust 工具链可用时运行 `cargo fmt --check` 和 `cargo check --manifest-path src-tauri/Cargo.toml`；工具链尚不可用则记录阻塞，不伪造结果。

```bash
git add src-tauri/src
git commit -m "feat: 迁移配置与项目模型到 Rust"
```

---

### 任务 3：迁移 Shell、Node.js 与 nvm

**文件：**

- 新建：`src-tauri/src/environment.rs`
- 修改：`src-tauri/src/state.rs`

**产出接口：**

```rust
pub fn get_shell_env(state: &AppState) -> HashMap<String, String>;
pub fn clear_shell_env_cache(state: &AppState);
pub fn get_project_env(state: &AppState, node_version: Option<&str>, cwd: Option<&Path>) -> HashMap<String, String>;
pub fn get_node_version(state: &AppState) -> NodeVersionResult;
pub fn get_node_versions(state: &AppState) -> NodeVersionsResult;
pub fn switch_node_version(state: &AppState, version: &str) -> ActionResult;
```

- [x] **步骤 1：实现登录 Shell 环境缓存**

macOS 执行 `$SHELL -l -c env`，5 秒超时失败后回退当前环境；Windows 直接使用当前环境。解析时仅接受包含 `=` 的字符串项。

- [x] **步骤 2：实现项目 `.npmrc` 与 PATH**

删除大小写不敏感的 `npm_config_*` 覆盖；项目存在 `registry=` 时写入 `npm_config_registry`；指定 Node.js 版本时将对应 bin 目录置于 PATH 首位。

- [x] **步骤 3：实现 Node.js 版本发现**

macOS 扫描 `NVM_DIR/versions/node/v*`；Windows 扫描 `NVM_HOME` 并读取 `NVM_SYMLINK` 目标。版本按数字降序返回。

- [x] **步骤 4：实现 macOS nvm 切换**

使用登录 Shell 执行 `source '<nvmDir>/nvm.sh' && nvm alias default <version> && nvm use <version>`，成功后清缓存并调用终端广播接口。

- [x] **步骤 5：实现 Windows UAC 切换**

在系统临时目录写入随机 `.bat` 和 `.ps1`，PowerShell 使用 `Start-Process -Verb RunAs -Wait` 重建 `NVM_SYMLINK` 目录链接；所有退出路径清理临时文件。

- [x] **步骤 6：静态验证并提交**

运行 `cargo fmt --check` 和 `cargo check --manifest-path src-tauri/Cargo.toml`，不运行测试。

```bash
git add src-tauri/src/environment.rs src-tauri/src/state.rs
git commit -m "feat: 迁移 Node 与 nvm 环境管理"
```

---

### 任务 4：迁移项目进程与实时日志

**文件：**

- 新建：`src-tauri/src/process.rs`
- 修改：`src-tauri/src/state.rs`
- 修改：`src-tauri/src/log.rs`

**依赖接口：** 使用任务 2 的模型/日志函数和任务 3 的 `get_project_env`。

**产出接口：**

```rust
pub fn start_project(app: &AppHandle, state: &AppState, project: Project) -> Result<(), String>;
pub fn stop_project(app: &AppHandle, state: &AppState, project_id: &str) -> bool;
pub fn stop_all_processes(app: &AppHandle, state: &AppState);
pub fn get_process_status(state: &AppState, project_id: &str) -> ProcessStatus;
pub fn is_process_running(state: &AppState, project_id: &str) -> bool;
```

- [x] **步骤 1：建立按项目 ID 和代次管理的进程表**

`ProcessHandle` 保存 PID 与唯一代次；等待线程退出时只有代次仍匹配才删除状态，防止旧退出回调污染重启后的新进程。

- [x] **步骤 2：实现跨平台进程启动**

Windows 启动 `<manager>.cmd run <script>` 并隐藏窗口；macOS 创建独立进程组。两端均设置 cwd、项目环境、stdout/stderr 管道和现有颜色变量。

- [x] **步骤 3：实现输出解码与 16 毫秒批量事件**

Windows 使用 UTF-8 有效性优先、失败回退 GBK；macOS 使用 UTF-8 有损解码。记录会话日志并发出 camelCase `log-data`。

- [x] **步骤 4：实现退出、错误分析和状态事件**

正常退出发送 `stopped`，异常退出发送 `error` 和 `error-analysis`；所有状态载荷保持 `projectId/status/pid/exitCode`。

- [x] **步骤 5：实现进程树终止**

Windows 调用 `taskkill /F /T /PID`；macOS 对负进程组 PID 发送 `SIGTERM`，1 秒后存活则 `SIGKILL`。手动停止先移除状态并立即通知 UI。

- [x] **步骤 6：静态验证并提交**

运行 Rust 格式和编译检查，不启动用户项目，不运行测试。

```bash
git add src-tauri/src/process.rs src-tauri/src/state.rs src-tauri/src/log.rs
git commit -m "feat: 迁移项目进程与实时日志"
```

---

### 任务 5：迁移 PTY 交互终端

**文件：**

- 新建：`src-tauri/src/terminal.rs`
- 修改：`src-tauri/src/state.rs`
- 修改：`src-tauri/src/environment.rs`

**产出接口：**

```rust
pub fn spawn_pty(app: &AppHandle, state: &AppState, request: PtySpawnRequest) -> Result<(), String>;
pub fn write_pty(state: &AppState, id: &str, data: &str) -> Result<(), String>;
pub fn resize_pty(state: &AppState, id: &str, cols: u16, rows: u16) -> Result<(), String>;
pub fn kill_pty(state: &AppState, id: &str);
pub fn broadcast_to_all_ptys(state: &AppState, command: &str);
pub fn kill_all_ptys(state: &AppState);
```

- [x] **步骤 1：建立可并发访问的 PTY 会话**

会话保存 `MasterPty`、writer 和 child；全局锁仅用于会话查找/替换，输出读取线程不持锁。

- [x] **步骤 2：实现平台 Shell 创建**

Windows 使用 `COMSPEC` 或 `cmd.exe`，macOS 使用 `SHELL` 或 `/bin/zsh`；传入 cwd、`xterm-256color`、cols/rows 和项目 Node.js 环境。

- [x] **步骤 3：实现输出与退出事件**

读取线程分块发送 `pty-data { id, data }`；等待线程删除对应会话并发送 `pty-exit { id, exitCode }`。

- [x] **步骤 4：实现写入、缩放、终止和广播**

不存在会话时安全返回；缩放失败返回中文错误；终止与应用退出必须清空会话表。

- [x] **步骤 5：静态验证并提交**

在 macOS 编译 `portable-pty`，Windows 部分由 CI 原生编译；不运行终端测试。

```bash
git add src-tauri/src/terminal.rs src-tauri/src/state.rs src-tauri/src/environment.rs
git commit -m "feat: 迁移跨平台 PTY 终端"
```

---

### 任务 6：注册命令并接通前端 desktopAPI

**文件：**

- 新建：`src-tauri/src/commands.rs`
- 新建：`src/renderer/src/shared/desktop/api.ts`
- 修改：`src-tauri/src/lib.rs`
- 修改：`src/renderer/src/shared/types/index.ts`
- 修改：所有引用 `window.electronAPI` 的 Vue/TypeScript 生产文件

**产出接口：**

```ts
export const desktopAPI: DesktopAPI
```

`DesktopAPI` 方法签名与当前 `Window['electronAPI']` 完全一致，PTY 方法允许返回并忽略 Promise，以保持组件调用方式不变。

- [x] **步骤 1：实现全部 Tauri command 薄入口**

注册当前 34 个请求型入口与 4 个 PTY 控制入口，Rust 参数使用 camelCase；批量启动逐项目执行健康检查并返回现有失败结构。

- [x] **步骤 2：实现桌面、窗口和对话框能力**

使用 dialog 插件完成目录选择和保存/打开；opener 完成文件管理器与 URL；VS Code 优先执行已知 `code` 路径，失败回退 `vscode://file/`；窗口命令使用当前主窗口。

- [x] **步骤 3：实现 TypeScript 适配层**

```ts
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export const desktopAPI: DesktopAPI = {
  getConfig: () => invoke('get_config'),
  onLogData: callback => subscribe('log-data', callback),
  // 其余方法按现有接口逐一映射
}
```

监听函数立即返回一个包装取消函数，内部等待 `listen` Promise；组件卸载早于监听建立时也必须最终取消。

- [x] **步骤 4：机械替换生产代码调用**

所有组件从 `@renderer/shared/desktop/api` 导入 `desktopAPI`，将 `window.electronAPI` 替换为 `desktopAPI`；平台信息通过 Tauri OS 常量或 Rust command 在适配层提供。

- [x] **步骤 5：注册退出清理和 macOS 菜单**

Tauri 退出事件调用 `stop_all_processes` 与 `kill_all_ptys`；macOS 创建关于、隐藏、编辑和退出菜单，保持现有行为。

- [x] **步骤 6：类型和 Rust 编译验证**

运行 `npm run typecheck`、`npm run build:frontend`、`cargo fmt --check` 和 `cargo check`，不运行测试。

- [x] **步骤 7：提交完整接线**

```bash
git add src-tauri/src src/renderer/src
git commit -m "feat: 接通 Tauri 桌面 API"
```

---

### 任务 7：迁移版本、打包、CI 和文档

**文件：**

- 修改：`scripts/bump-version.js`
- 修改：`package.json`
- 修改：`package-lock.json`
- 修改：`.github/workflows/build.yml`
- 修改：`README.md`
- 删除：`electron.vite.config.ts`
- 删除：`scripts/dev.js`

**产出接口：**

- 版本同步到 `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`。
- Release 继续严格包含 4 个 `.dmg/.exe` 文件。

- [x] **步骤 1：改造版本脚本**

保留 `--skip/--ask/--major/--minor`，校验 `x.y.z` 后同步三个文件；任一文件写入失败返回非零状态。

- [x] **步骤 2：删除 Electron 构建依赖**

移除 Electron、electron-vite、electron-builder、electron-toolkit、node-pty 和 iconv-lite；保留 Vue、xterm、Vite、Tailwind 和 Tauri 依赖。

- [x] **步骤 3：配置 Windows 与 macOS 产物**

Windows 生成 NSIS，并将 release 原始 `.exe` 作为便携版归档；macOS 分别添加 `x86_64-apple-darwin` 与 `aarch64-apple-darwin` 目标并生成 DMG。

- [x] **步骤 4：改造 GitHub Actions**

矩阵使用 `windows-latest`、`macos-13` 和 `macos-14`，安装 Node.js 20 与稳定 Rust；分别上传 Windows 两个 EXE、Intel DMG 和 Apple Silicon DMG；发布阶段仍校验数量为 4。

- [x] **步骤 5：更新 README**

技术栈、环境要求、开发命令、打包命令、目录结构和安全说明改为 Tauri 2 + Rust，并说明双平台原生构建要求。

- [x] **步骤 6：静态检查并提交**

运行 `git diff --check`、`npm run typecheck` 和前端构建；不运行测试。

```bash
git add package.json package-lock.json scripts .github README.md vite.config.ts electron.vite.config.ts
git commit -m "build: 切换 Tauri 双平台发布流程"
```

---

### 任务 8：编译、运行与交付检查

**文件：**

- 修改：实施中发现问题对应的生产文件
- 修改：`.planning/2026-08-18-rust-refactor/progress.md`（被忽略，仅记录）

- [x] **步骤 1：安装缺失的 Rust 工具链**

当前机器没有 `rustc/cargo`。获得用户授权后安装稳定 Rust，并确认：

```bash
rustc --version
cargo --version
```

- [x] **步骤 2：执行本地静态验证**

```bash
npm run typecheck
npm run build:frontend
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
git diff --check
```

- [x] **步骤 3：构建并启动 macOS 应用**

运行 `npm run build` 生成当前架构应用，启动本地开发服务器并检查窗口非空、主题、窗口控制、配置读取和终端创建。该步骤不执行测试代码。

- [x] **步骤 4：检查发布工作流**

本地校验 YAML、产物 glob 和四产物计数逻辑；Windows ConPTY、UAC、nvm-windows 和安装包运行记录为 Windows 原生 CI/实机检查项。

- [x] **步骤 5：检查功能覆盖与差异**

逐项对照设计文档 14 个章节，检查无遗漏 command/event，确认新构建不引用 Electron 或 `node-pty`，记录未能在当前 macOS 环境执行的 Windows 验证。

- [x] **步骤 6：最终提交**

```bash
git add -A
git commit -m "refactor: 完成 Rust Tauri 重构"
```

---

### 任务 9：修复 macOS 窗口拖拽区域

**文件：**

- 修改：`src/renderer/src/shared/window/AppHeader.vue`

**产出接口：**

- 标题栏空白区域使用 Tauri 2 原生 `data-tauri-drag-region`。
- 左侧空白区域占满右侧操作区之外的剩余宽度。
- Node 版本、主题和配置按钮继续保持正常点击。

- [x] **步骤 1：补充 Tauri 拖拽标记与弹性布局**

在标题栏和左侧空白元素上添加 `data-tauri-drag-region`，并为 `.header-left` 增加 `flex: 1 1 auto`。

- [x] **步骤 2：执行静态与开发态验证**

运行 `npm run typecheck`、`npm run build:frontend` 和 `git diff --check`，确认开发态 Tauri 应用热更新成功；受项目规则约束，不新增或运行测试。

- [x] **步骤 3：开放最小窗口拖拽权限**

在 `src-tauri/capabilities/default.json` 中加入 `core:window:allow-start-dragging`，重启 Tauri 开发进程并确认 capability 配置被加载。

---

### 任务 10：校正 macOS Dock 图标视觉尺寸

**文件：**

- 新增：`build/icon-macos.svg`
- 修改：`src-tauri/icons/icon.icns`

**产出接口：**

- macOS 图标在 `1024×1024` 透明画布中按 84% 比例居中。
- Windows 和其他平台图标资源保持不变。

- [x] **步骤 1：建立 macOS 专用图标源文件**

复用现有图形和配色，将整体图形放入 `translate(82 82) scale(0.84)` 变换组。

- [x] **步骤 2：重新生成并检查 ICNS**

使用 Tauri CLI 将专用 SVG 生成到临时目录，只替换 `src-tauri/icons/icon.icns`；检查画布尺寸、透明通道与打包配置，不运行测试。
