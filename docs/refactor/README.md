# 文档索引

> 这些文档按「先读哪份」排序；后面的 `revN-progress.md` 是各轮修正记录，属于历史归档。

| 文档 | 内容 | 何时看 |
|---|---|---|
| [`architecture.md`](./architecture.md) | 分层架构、职责边界、数据流 | 想改代码结构 |
| [`data-model.md`](./data-model.md) | 数据模型、存储键、迁移与回滚 | 想改数据结构 |
| [`workflow.md`](./workflow.md) | 业务流程：创建 / 每日执行 / 续期 / 归档 | 想改业务规则 |
| [`visual-design.md`](./visual-design.md) | 视觉与动效方案（令牌、转场、版式重排） | 想改界面与动效 |
| [`rev7-progress.md`](./rev7-progress.md) | **最新**：按钮机制统一 / 价格策略定案 / 1.0.42 数据无损继承 | 想了解当前状态 |
| [`rev6-progress.md`](./rev6-progress.md) | 详情窗口重做、续费=加天数+收费、归档语义、收入统计归位 | 查某处为什么这样设计 |
| [`rev5-progress.md`](./rev5-progress.md) | 蓝图编辑（字号已按要求移除） | 历史归档 |
| [`rev4-progress.md`](./rev4-progress.md) | 项目详情窗口恢复与适配 | 历史归档 |
| [`rev3-progress.md`](./rev3-progress.md) | 连续托管剩余天数、返图预设、画布外工作区 | 历史归档 |
| [`rev2-progress.md`](./rev2-progress.md) | 连续托管模型、预设结构化、视觉与动效 | 历史归档 |
| [`delivery.md`](./delivery.md) | 第一轮交付说明与验收对照（数字已过时） | 历史归档 |

## 两句话总结当前设计

* **数据**：页面 → `services` → `data/repos` → localStorage + Electron 文件（双通道，本地优先）。
* **业务**：一个客户 = 一个托管项目，**续期就是给它加天数并追加一条收费记录**；
  每日执行产生独立的执行记录；归档 = 消耗全部剩余天数并完成该托管。
