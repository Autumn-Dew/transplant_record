import { createApp } from "vue"
import { runStartupMigration } from "./services/migration.js"

// 数据迁移必须先于任何页面读取数据执行（迁移完成后才加载 App）
runStartupMigration()

import("./App.vue").then(({ default: App }) => {
  createApp(App).mount("#app")
})
