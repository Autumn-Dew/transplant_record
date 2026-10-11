/* ══════ 在 src/router/index.js 中修改 ══════ */

/* 1. 在 import 区域（AlbumDetail 之后）添加： */
const BoostingDiary = () => import('@/views/player/BoostingDiary.vue')

/* 2. 在 children 数组中（stats 路由之后）添加： */
{ path: 'boosting', component: BoostingDiary }

/* ══════ 完整 children 数组参考 ══════ */
// children: [
//     { path: '', component: LocalMusic },
//     { path: 'local', component: LocalMusic },
//     { path: 'playlist', component: MyPlaylist },
//     { path: 'playlist-detail/:id', component: PlaylistDetail },
//     { path: 'detail', component: SongDetail },
//     { path: 'timeline', component: MusicTimeline },
//     { path: 'diary', component: DiaryPage },
//     { path: 'album/:type/:name', component: AlbumDetail },
//     { path: 'settings', component: SettingsPage },
//     { path: 'history', component: PlayHistory },
//     { path: 'stats', component: PlayStats },
//     { path: 'boosting', component: BoostingDiary },  // ← 新增
// ]
