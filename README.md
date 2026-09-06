# Violentmonkey Scripts (暴力猴脚本集合)

自用的高质量 Violentmonkey / Tampermonkey 用户脚本集合。所有脚本作者统一为 `yiheng`，图标均内置「E」角标身份标识，所有脚本均配置 `@updateURL` 与 `@downloadURL`，支持在暴力猴中**自动检查更新与一键在线安装**。

---

## 脚本列表与一键安装

> **说明**：点击下方「一键安装」链接后，暴力猴会自动拦截并弹出安装窗口。安装后脚本将与 GitHub 仓库自动绑定，后续点击暴力猴面板中的「检查所有脚本更新」即可一键同步最新版本。

| 脚本名称 | 说明 | 当前版本 | 作者 | 一键安装 (GitHub 直链) | 国内加速安装 (ghproxy) |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **磁力快推** | 自动汇总复制的磁力链接并推送到 NAS qBittorrent (默认 magnet 分类、上传限速 1KB/s，成功/重复任务自动删除) | `v2.2.0` | `yiheng` | [安装脚本](https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/easy-copy.user.js) | [加速安装](https://ghproxy.net/https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/easy-copy.user.js) |
| **B站关灯模式** | 只保留 B 站播放器区域，其余区域按系统深浅色主题覆盖为纯黑或纯白 | `v1.1.1` | `yiheng` | [安装脚本](https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/bilibili.user.js) | [加速安装](https://ghproxy.net/https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/bilibili.user.js) |
| **Jellyfin 外部播放** | 在 Jellyfin 网页端一键调用本地 PotPlayer 播放视频 | `v0.1.1` | `yiheng` | [安装脚本](https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/potplayer.user.js) | [加速安装](https://ghproxy.net/https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/potplayer.user.js) |
| **PL 论坛助手** | 论坛搜索时自动选中 3D & VR 分区，话题页悬浮下载单元格 | `v1.2.1` | `yiheng` | [安装脚本](https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/pl-auto-vr-filter.user.js) | [加速安装](https://ghproxy.net/https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/pl-auto-vr-filter.user.js) |
| **网盘自动转存** | 百度网盘分享页面自动填充提取码并保存到个人网盘 | `v1.0.1` | `yiheng` | [安装脚本](https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/baidu-pan.user.js) | [加速安装](https://ghproxy.net/https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/baidu-pan.user.js) |
| **DB VR 筛选** | 演员作品页面一键直达 VR 分区列表 | `v1.0.1` | `yiheng` | [安装脚本](https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/db-vr.user.js) | [加速安装](https://ghproxy.net/https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/db-vr.user.js) |
| **有谱伴奏助手** | 有谱伴奏网页端本地状态支持 | `v1.0.1` | `yiheng` | [安装脚本](https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/youpu.user.js) | [加速安装](https://ghproxy.net/https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/youpu.user.js) |

---

## 项目目录结构

```text
violentmonkey-script/
├── scripts/                              # 用户脚本目录 (统一采用 *.user.js 命名)
│   ├── easy-copy.user.js                # 磁力快推脚本
│   ├── bilibili.user.js                 # B站关灯模式脚本
│   ├── potplayer.user.js                # Jellyfin 外部播放脚本
│   ├── pl-auto-vr-filter.user.js        # PL 论坛助手脚本
│   ├── baidu-pan.user.js                # 网盘自动转存脚本
│   ├── db-vr.user.js                    # DB VR 筛选脚本
│   └── youpu.user.js                    # 有谱伴奏助手脚本
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
