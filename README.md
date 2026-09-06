# Violentmonkey Scripts (暴力猴脚本集合)

自用的高质量 Violentmonkey / Tampermonkey 用户脚本集合。所有脚本均已配置 `@updateURL` 与 `@downloadURL`，支持在暴力猴中**自动检查更新与一键在线安装**。

---

## 脚本列表与一键安装

> **说明**：点击下方「一键安装」链接后，暴力猴会自动拦截并弹出安装窗口。安装后脚本将与 GitHub 仓库自动绑定，后续点击暴力猴面板中的「检查所有脚本更新」即可一键同步最新版本。

| 脚本名称 | 说明 | 当前版本 | 一键安装 (GitHub 直链) | 国内加速安装 (ghproxy) |
| :--- | :--- | :---: | :---: | :---: |
| **Easy Copy & qBittorrent 推送** | 磁力链接自动拦截收集、去重、推送到 NAS qBittorrent (默认 magnet 分类、上传限速 1KB/s)、成功/重复任务自动删除 | `v2.2.0` | [安装脚本](https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/easy-copy.user.js) | [加速安装](https://ghproxy.net/https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/easy-copy.user.js) |
| **Bilibili 纯色关灯模式** | 只保留 B 站播放器区域，其余区域按系统深浅色主题覆盖为纯黑或纯白 | `v1.1.1` | [安装脚本](https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/bilibili.user.js) | [加速安装](https://ghproxy.net/https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/bilibili.user.js) |
| **Jellyfin with PotPlayer** | 在 Jellyfin 网页端一键调用本地 PotPlayer 播放视频 | `v0.1.1` | [安装脚本](https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/potplayer.user.js) | [加速安装](https://ghproxy.net/https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/potplayer.user.js) |
| **PL 自动选 VR 分区助手** | 论坛搜索时自动选中 3D & VR 分区，话题页悬浮下载单元格 | `v1.2.1` | [安装脚本](https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/pl-auto-vr-filter.user.js) | [加速安装](https://ghproxy.net/https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/pl-auto-vr-filter.user.js) |

---

## 项目目录结构

```text
violentmonkey-script/
├── scripts/                              # 用户脚本目录 (统一采用 *.user.js 命名)
│   ├── easy-copy.user.js                # Easy Copy & qBittorrent 推送脚本
│   ├── bilibili.user.js                 # Bilibili 关灯模式脚本
│   ├── potplayer.user.js                # Jellyfin PotPlayer 唤起脚本
│   └── pl-auto-vr-filter.user.js        # PL 自动选 VR 分区助手脚本
├── README.md                             # 项目说明与一键安装索引
├── AGENTS.md                             # AI 协作规范与设计约束
├── TODO.md                               # 任务进展跟踪
└── .gitignore                            # Git 忽略文件
```

---

## 自动更新与日常使用

1. **首次安装**：点击上方表格中的安装链接，暴力猴弹出窗口点击「确认安装」即可；
2. **检查更新**：
   - **手动更新**：点击浏览器右上角暴力猴图标 -> 打开控制台 -> 点击右上角「**检查所有脚本更新**」；
   - **自动更新**：暴力猴默认会在后台定期自动联网比对版本号，发现新版本时自动升级；
3. **版本发布规范**：
   - 每次修改脚本后，递增元数据中的 `// @version` 并在脚本内更新 `SCRIPT_VERSION`；
   - 执行 `git push` 推送至 GitHub 后，暴力猴即可检测到新版本。
