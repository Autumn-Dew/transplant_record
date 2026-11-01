import { createApp } from "vue"
import { runStartupMigration } from "./services/migration.js"
import { hydrateAll } from "./data/repos.js"

// 数据迁移必须先于任何页面读取数据执行（迁移完成后才加载 App）
runStartupMigration()

import("./App.vue").then(({ default: App }) => {
  createApp(App).mount("#app")
  // 挂载之后再把 Electron 文件里的数据补齐：不阻塞首屏；读到数据会通过响应式状态即时刷新。
  // 「谁负责补数据」只有这一处，页面不再各自 hydrate。
  hydrateAll()
})
