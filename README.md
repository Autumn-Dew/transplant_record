# 代肝记录（transplant_record）

一站式代肝（游戏代练）管理工具：**代肝代办 · 代肝记录 · 每日汇报 · 价格一览 · 蓝图记录 · 游戏与数据管理**。

当前版本 **v1.0.43**（上一发布版为 v1.0.42；版本号只在 `package.json`）。Electron + Vue 3 + Vite，
纯本地运行（localStorage + `userData/data/*.json` 双通道），不联网。

## 快速开始

```bash
npm install
npm start        # 开发：vite dev server + Electron 窗口
npm run build    # 只构建前端产物到 dist/
npm run pack     # 打包 Windows 安装程序（electron-builder）
```

## 测试与自检

```bash
npm test         # node --test：domain 纯函数 / 业务服务 / 数据迁移 / 1.0.42 升级兼容 / UI 结构约束
npm run ui:smoke # Electron 冒烟：8 个页面渲染 + 关键交互的 DOM 断言 + 全流程截图（失败退出码非 0）
```

## 目录结构

```
electron/          主进程（窗口、单实例、数据文件的 IPC 读写）
src/
  main.js          入口：先执行启动迁移，再挂载 App
  App.vue          外壳：侧栏导航 + 页面转场（页面常驻、v-show 切换）
  views/           页面：代肝代办 / 蓝图记录 / 代肝记录 / 新增记录 / 价格一览 /
                   每日汇报 / 代肝日报 / 数据管理 / 设置 / 游戏与服务管理
  components/      复用组件：项目详情弹窗、返图（ReportSheet）、选择框…
  domain/          纯逻辑领域层（不依赖 Vue / localStorage）：project / completion /
                   hosting-chain / blueprints / games / migrate / mask
  services/        业务规则的唯一落点：projectService（项目生命周期）、projectDetail（详情组装）、
                   gameService（游戏目录）、migration（启动迁移）
  data/            Repository 层：业务数据的唯一入口（localStorage + Electron 文件双通道）
  composables/     组合式函数：useConfirmClick（多次点击确认）、useRowSelect、useGlobalTheme…
  assets/css/      设计令牌 / 通用页面样式 / 动效系统
tests/             node --test 用例（纯逻辑 + 数据路径，不依赖浏览器）
tools/ui-smoke.cjs Electron 冒烟脚本（真实 UI 交互 + DOM 断言 + 截图）
docs/refactor/     架构、数据模型、业务流程、视觉方案、各轮修正记录（见其中 README）
```

> ⚠ **仓库里不得出现任何真实用户数据**（账号 / 备注 / 记录）。
> 真实数据只存在于 Electron 的用户数据目录，需要备份请用「设置 → 备份全部数据」导出到仓库之外。
> `.gitignore` 已屏蔽 `testdata/`，请勿把备份 JSON 放进仓库。

## 关键约定（改代码前请先看这里）

1. **数据只经 Repository**：页面不直接读写 `localStorage`，一律通过 `src/data/repos.js`。
2. **业务规则只在 services**：组件只负责渲染与派发事件，不拼装业务规则。
3. **domain 是纯函数**：不依赖 Vue / localStorage，因此可以被 `node --test` 直接单测。
4. **写操作统一「多次点击确认」**：`composables/useConfirmClick` —— 连点 4 次生效、停手 3 秒复位、
   颜色红→橙→紫递进、每次点击播放逐层音效。新增写操作按钮请复用它，不要另写一套。
5. **老数据只增不改**：迁移只补新字段、绝不删旧字段；迁移前自动备份到 `tr-backup-*`，可回滚。
6. **托管续期 = 在原项目上加天数 + 追加一条收费记录**（`addHostingPeriod`），不再新建项目。

## 数据兼容

* 存储键名沿用 v1.0.42，未做任何改名；升级只是**新增字段**。
* `appId`（`com.autumndew.boosting-record`）与 `userData/data` 路径未变，因此 localStorage 与既有
  JSON 文件都被直接沿用；新增的 `completions.json` / `games.json` 是**新增**文件。
* 从 1.0.42 升级的无损继承有专门的自动化验证：`tests/upgrade-1042.test.mjs`
  （用 1.0.42 的真实写入逻辑造数据，逐字段比对）。说明见 `docs/refactor/rev7-progress.md`。
