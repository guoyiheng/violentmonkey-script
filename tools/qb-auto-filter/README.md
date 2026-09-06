# qBittorrent 自动过滤只下载 MP4 文件工具

专为配合「磁力快推」等脚本打造的 NAS 服务端轻量自动化工具。

由于磁力链接（Magnet）在推送瞬间尚未获取种子元数据（Metadata），此时 qB 尚无文件列表；本工具在服务端自动监听任务，一旦元数据获取完成，**自动将所有非 `.mp4` 文件设为「不下载」(priority=0)**，仅保留 `.mp4` 文件进行下载。

---

## 核心特性

- **纯 Python3 标准库**：零第三方依赖（无需 `pip install requests`），群晖 DSM 6/7 或 Linux 服务器开箱即用；
- **智能排重与打标**：处理完自动给任务添加 `mp4-filtered` 标签，避免反复轮询，且在 WebUI 中一目了然；
- **多模式支持**：
  - **单次/定时扫描模式 (`--once`)**：最适合群晖「任务计划」每分钟执行一次；
  - **常驻守护模式 (`--daemon`)**：后台长久运行，每 5 秒扫描一次，响应极快；
  - **qB 外部程序挂钩模式 (`--hash`)**：可在 qBittorrent「下载 -> 运行外部程序」中直接调用。

---

## 配置文件说明

脚本同目录下放置 `config.json`（可参考 [`config.example.json`](./config.example.json)）：

```json
{
  "qb_url": "http://192.168.31.155:8080",
  "username": "admin",
  "password": "your_password",
  "category": "magnet",
  "allowed_extensions": [".mp4"],
  "min_size_mb": 25,
  "filtered_tag": "mp4-filtered",
  "poll_interval": 5,
  "metadata_timeout": 180
}
```

* `category`：仅处理推送到此分类的任务（配合「磁力快推」默认的 `magnet` 分类，避免影响其他正常做种分类；如需对所有任务生效可留空 `""`）；
* `allowed_extensions`：允许下载的扩展名列表，默认 `[".mp4"]`，如有需要也可以加 `[".mp4", ".mkv"]`；
* `min_size_mb`：最小文件大小限制（MB），默认 `25`。非目标扩展名或小于此大小的文件（如 sample 预览小片段、广告等）均会被设为「不下载」，设为 `0` 则不限制大小。

---

## 部署指南 (以群晖 NAS 为例)

### 方式一：群晖「任务计划」每分钟自动扫描（推荐，最省心）

1. **上传文件**：
   - 将 `qb_filter_mp4.py` 和 `config.json` 放到群晖的某个共享文件夹中（例如 `/volume1/docker/qbittorrent/scripts/`）；
2. **打开群晖 DSM 控制面板**：
   - 依次进入：**控制面板** -> **任务计划** -> **新增** -> **计划的任务** -> **用户定义的脚本**；
3. **设置常规选项**：
   - 任务名称：`qB 自动过滤 MP4`
   - 用户账号：`root`
4. **设置计划**：
   - 日期：每天运行；
   - 时间：从 `00:00` 到 `23:59`，频率选择 **每 1 分钟** 或 **每 2 分钟**；
5. **设置任务设置（运行命令）**：
   ```bash
   /usr/bin/python3 /volume1/docker/qbittorrent/scripts/qb_filter_mp4.py --once
   ```
   > 💡 提示：群晖系统自带 Python3。保存后右键任务点击「运行」即可立即测试。

---

### 方式二：常驻后台运行 (nohup / Screen)

如果你希望推送完磁力后数秒内立即生效，可以在群晖终端或 Docker 主机中以后台守护模式运行：

```bash
nohup python3 /volume1/docker/qbittorrent/scripts/qb_filter_mp4.py --daemon > /volume1/docker/qbittorrent/scripts/filter.log 2>&1 &
```

可在群晖「任务计划」中添加一条「触发的任务 - 开机时运行」上述命令，实现开机自启。

---

### 方式三：由 qBittorrent 自带的「运行外部程序」直接触发

如果你的 qBittorrent 容器或宿主机环境内包含 Python3：
1. 打开 qBittorrent 网页设置 -> **下载** -> 滚动到底部 **运行外部程序**；
2. 勾选 **添加 torrent 时运行外部程序**；
3. 输入命令：
   ```bash
   python3 /path/to/qb_filter_mp4.py --hash "%I"
   ```
4. 保存即可。每当有新任务加入时，脚本会自动进入 180 秒元数据等待轮询，元数据解析完毕后瞬间剔除非 MP4 文件。

---

## 运行日志效果

```text
2026-09-06 13:16:00 [INFO] qBittorrent 登录成功
2026-09-06 13:16:05 [INFO] 🎯 正在处理任务 [Sample Movie] (Hash: 9a3b8c2d)
   保留文件 (1 个): movie_main.mp4
   屏蔽文件 (4 个): promo.jpg, sample.mkv, track.nfo, readme.txt
2026-09-06 13:16:06 [INFO] 本次运行处理完毕，成功过滤 1 个任务的文件
```
在 qBittorrent WebUI 中，该任务的标签会自动显示为 `mp4-filtered`，其它非 MP4 文件将被自动标记为「不下载」。
