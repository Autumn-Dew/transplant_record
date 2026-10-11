# 代肝日记本 — 集成到 rhizome 的部署说明

## 文件清单

| 文件 | 目标位置 | 说明 |
|------|----------|------|
| `BoostingDiary.vue` | `src/views/player/BoostingDiary.vue` | 核心组件 |
| `storage-keys.diff` | 在 `src/constants/storage-keys.js` 末尾添加 | 两个新存储键 |
| `router.diff` | 在 `src/router/index.js` 中添加路由 + import | 注册路由 |

## 部署步骤

### 1. 拷贝组件
将 `BoostingDiary.vue` 复制到 `src/views/player/BoostingDiary.vue`

### 2. 添加存储键
在 `src/constants/storage-keys.js` 的 `K_SONG_CACHE` 之后添加：

```js
export const K_BOOSTING_DIARY     = 'rhizome-boosting-diary'
export const K_BOOSTING_CUSTOMERS = 'rhizome-boosting-customers'
```

并在 `ALL_STORAGE_KEYS` 数组中追加这两个导出名。

### 3. 注册路由
在 `src/router/index.js` 中：
- `import` 区添加：`const BoostingDiary = () => import('@/views/player/BoostingDiary.vue')`
- `children` 数组添加：`{ path: 'boosting', component: BoostingDiary }`

### 4. 添加入口（可选）
在 `PlayHistory.vue` 的 `header-actions` 区域添加按钮：
```html
<button class="tl-entry-btn" @click="goBoosting" title="代肝日记">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M17 3v18M7 3v1m0 4v1m0 4v1m0 4v1M3 7h18M3 11h18M3 15h18M3 19h18"/>
  </svg>
  <span>代肝</span>
</button>
```

并在 script 中添加：
```js
const goBoosting = () => router.push('/player/boosting')
```

### 5. 访问
启动后访问 `#/player/boosting`

## 数据说明

- 客户数据预置了 Excel 中的 13 条记录（Sheet2）
- 日记数据持久化在 `localStorage`，键名 `rhizome-boosting-diary`
- 客户数据也存储在 `localStorage`，首次加载使用预置数据，之后可自行增删改
