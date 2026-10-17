# 文档索引

> 这些文档按「先读哪份」排序；后面的 `revN-progress.md` 是各轮修正记录，属于历史归档。

| 文档 | 内容 | 何时看 |
|---|---|---|
| [`architecture.md`](./architecture.md) | 分层架构、职责边界、数据流 | 想改代码结构 |
| [`data-model.md`](./data-model.md) | 数据模型、存储键、迁移与回滚 | 想改数据结构 |
| [`workflow.md`](./workflow.md) | 业务流程：创建 / 每日执行 / 续期 / 归档 | 想改业务规则 |
| [`visual-design.md`](./visual-design.md) | 视觉与动效方案（令牌、转场、版式重排） | 想改界面与动效 |
| [`rev13-progress.md`](./rev13-progress.md) | **最新**：续费字段并排（scoped 样式问题）/ 天数增减实测 / 列表列宽 / 分组折叠真根因 | 想了解当前状态 |
| [`rev12-progress.md`](./rev12-progress.md) | 天数可增可减 / 记录按周期完成统计 / 备份可加载 / 续费版式 / 弹窗半屏 | 查上一轮改动 |
| [`rev11-progress.md`](./rev11-progress.md) | 真实数据体检（查出周期天数与结束日差一天）/ 备份移设置页 / 蓝图备注 | 查上一轮改动 |
| [`rev10-progress.md`](./rev10-progress.md) | 改天数实测结论 / 真实数据放 testdata / 数据备份 / 汇报显示备注 / 记录页统计与排序 | 查上一轮改动 |
| [`rev9-progress.md`](./rev9-progress.md) | 游戏名统一 / 天数逻辑修正 / 续费多一天 / 金额重复计算 / 蓝图备注与收纳 / 店铺信息隐藏 | 查上一轮改动 |
| [`rev8-progress.md`](./rev8-progress.md) | 游戏 id 统一（已被 rev9 改为游戏名）/ 归档不再是续费候选 / 天数可改可减 | 查上一轮改动 |
| [`rev7-progress.md`](./rev7-progress.md) | 按钮机制统一 / 价格策略定案 / 1.0.42 数据无损继承 / 项目整理 | 查上一轮改动 |
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
