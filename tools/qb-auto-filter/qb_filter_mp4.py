#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
qBittorrent 自动文件过滤器 (qb_filter_mp4.py)
--------------------------------------------------
功能：监控 qBittorrent 中推入的种子/磁力，拉取元数据后自动将非 MP4 文件设为「不下载」(priority=0)。
特点：
  1. 纯 Python3 标准库编写，零第三方依赖（无需 pip install requests），即插即用；
  2. 支持三种运行方式：
     - 计划任务模式 (--once)：可配置于群晖「任务计划」或系统 cron 每分钟触发一次；
     - 守护进程模式 (--daemon)：在后台常驻轮询（默认每 5 秒扫描一次）；
     - 外部触发模式 (--hash <HASH>)：由 qBittorrent 的「运行外部程序」直接传入 Hash 触发；
  3. 处理完后自动为种子添加 `mp4-filtered` 标签，避免重复比对，且可在 WebUI 中清晰识别。
"""

import argparse
import http.cookiejar
import json
import logging
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

# ----------------- 默认配置 -----------------
DEFAULT_CONFIG = {
    "qb_url": "http://127.0.0.1:8080",      # qBittorrent WebUI 地址
    "username": "admin",                    # 用户名
    "password": "adminadmin",               # 密码
    "category": "magnet",                   # 仅处理指定分类（为空字符串 "" 则处理所有分类）
    "allowed_extensions": [".mp4"],         # 允许下载的文件后缀（小写，包含点）
    "filtered_tag": "mp4-filtered",         # 处理完成后标记的 Tag
    "poll_interval": 5,                     # 守护进程轮询间隔（秒）
    "metadata_timeout": 180,                # 单任务等待元数据最大超时时间（秒）
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("qb_filter")


class QbittorrentClient:
    def __init__(self, base_url, username, password):
        self.base_url = base_url.rstrip("/")
        self.username = username
        self.password = password
        self.cookie_jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.cookie_jar)
        )

    def _request(self, path, method="GET", data=None, retry_auth=True):
        url = f"{self.base_url}{path}"
        body = None
        headers = {"User-Agent": "qb-auto-filter-script/1.0"}
        if data is not None:
            body = urllib.parse.urlencode(data).encode("utf-8")
            headers["Content-Type"] = "application/x-www-form-urlencoded"

        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with self.opener.open(req, timeout=15) as resp:
                return resp.status, resp.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            if e.code in (401, 403) and retry_auth:
                logger.info("认证失效或需要登录，正在尝试登录...")
                if self.login():
                    return self._request(path, method=method, data=data, retry_auth=False)
            raise

    def login(self):
        """登录 qBittorrent 获取 session cookie"""
        try:
            status, text = self._request(
                "/api/v2/auth/login",
                method="POST",
                data={"username": self.username, "password": self.password},
                retry_auth=False,
            )
            if "Ok." in text or status == 200:
                logger.info("qBittorrent 登录成功")
                return True
            else:
                logger.error(f"qBittorrent 登录失败: {text}")
                return False
        except Exception as err:
            logger.error(f"连接 qBittorrent 发生错误: {err}")
            return False

    def get_torrents(self, category=None):
        """获取种子列表"""
        path = "/api/v2/torrents/info"
        if category:
            path += f"?category={urllib.parse.quote(category)}"
        try:
            _, text = self._request(path)
            return json.loads(text)
        except Exception as err:
            logger.error(f"获取种子列表失败: {err}")
            return []

    def get_files(self, torrent_hash):
        """获取指定种子的文件列表"""
        path = f"/api/v2/torrents/files?hash={urllib.parse.quote(torrent_hash)}"
        try:
            _, text = self._request(path)
            return json.loads(text)
        except Exception as err:
            logger.error(f"获取种子 {torrent_hash} 文件列表失败: {err}")
            return []

    def set_file_priorities(self, torrent_hash, file_ids, priority=0):
        """批量设置文件优先级 (0: 不下载, 1: 正常, 6: 高, 7: 最高)"""
        if not file_ids:
            return True
        id_str = "|".join(str(i) for i in file_ids)
        path = "/api/v2/torrents/filePrio"
        data = {
            "hash": torrent_hash,
            "id": id_str,
            "priority": priority,
        }
        try:
            self._request(path, method="POST", data=data)
            return True
        except Exception as err:
            logger.error(f"设置种子 {torrent_hash} 文件优先级失败: {err}")
            return False

    def add_tag(self, torrent_hash, tag):
        """为种子打标签"""
        path = "/api/v2/torrents/addTags"
        data = {
            "hashes": torrent_hash,
            "tags": tag,
        }
        try:
            self._request(path, method="POST", data=data)
            return True
        except Exception as err:
            logger.error(f"为种子 {torrent_hash} 添加标签失败: {err}")
            return False


def filter_torrent(client, torrent, allowed_exts, filtered_tag):
    """
    检查并过滤单个种子的文件列表：
    - 如果是 metaDL 状态（元数据还在下载），暂不处理；
    - 如果已有目标过滤标签，跳过；
    - 遍历文件：非 allowed_exts 的文件全部设为 priority=0；
    - 打上 filtered_tag 标签。
    """
    thash = torrent.get("hash")
    name = torrent.get("name", "未命名")
    tags = [t.strip() for t in torrent.get("tags", "").split(",") if t.strip()]

    if filtered_tag in tags:
        return False  # 已处理过

    # 获取文件列表
    files = client.get_files(thash)
    if not files:
        # 元数据可能尚未下载完毕 (metaDL)
        return False

    skip_ids = []
    keep_names = []
    skip_names = []

    for idx, f in enumerate(files):
        fname = f.get("name", "")
        f_ext = os.path.splitext(fname)[1].lower()
        fid = f.get("index", idx)

        if f_ext in allowed_exts:
            keep_names.append(os.path.basename(fname))
        else:
            skip_ids.append(fid)
            skip_names.append(os.path.basename(fname))

    # 执行屏蔽非目标文件
    if skip_ids:
        logger.info(
            f"🎯 正在处理任务 [{name}] (Hash: {thash[:8]})\n"
            f"   保留文件 ({len(keep_names)} 个): {', '.join(keep_names[:3])}{'...' if len(keep_names) > 3 else ''}\n"
            f"   屏蔽文件 ({len(skip_ids)} 个): {', '.join(skip_names[:3])}{'...' if len(skip_names) > 3 else ''}"
        )
        client.set_file_priorities(thash, skip_ids, priority=0)
    else:
        logger.info(f"✅ 任务 [{name}] 内全部为目标文件或无需过滤")

    # 标记已完成过滤
    client.add_tag(thash, filtered_tag)
    return True


def run_once(client, config):
    """单次扫描模式"""
    category = config.get("category")
    allowed_exts = [ext.lower() for ext in config.get("allowed_extensions", [".mp4"])]
    filtered_tag = config.get("filtered_tag", "mp4-filtered")

    torrents = client.get_torrents(category=category)
    if not torrents:
        logger.debug("当前分类下无种子任务")
        return

    count = 0
    for t in torrents:
        # 跳过已打标的任务
        tags = [x.strip() for x in t.get("tags", "").split(",") if x.strip()]
        if filtered_tag in tags:
            continue

        if filter_torrent(client, t, allowed_exts, filtered_tag):
            count += 1

    if count > 0:
        logger.info(f"本次运行处理完毕，成功过滤 {count} 个任务的文件")


def run_single_hash(client, config, target_hash):
    """针对单一 Hash 进行等待元数据并过滤（供 qB 外部程序调用）"""
    allowed_exts = [ext.lower() for ext in config.get("allowed_extensions", [".mp4"])]
    filtered_tag = config.get("filtered_tag", "mp4-filtered")
    timeout = config.get("metadata_timeout", 180)

    logger.info(f"收到外部触发任务，等待元数据 (Hash: {target_hash})...")
    start_time = time.time()

    while time.time() - start_time < timeout:
        files = client.get_files(target_hash)
        if files:
            torrents = client.get_torrents()
            target_t = next((t for t in torrents if t.get("hash", "").lower() == target_hash.lower()), None)
            t_obj = target_t if target_t else {"hash": target_hash, "name": target_hash, "tags": ""}
            filter_torrent(client, t_obj, allowed_exts, filtered_tag)
            return

        time.sleep(2)

    logger.warning(f"等待任务 {target_hash} 元数据超时（超过 {timeout} 秒），退出")


def run_daemon(client, config):
    """守护进程常驻模式"""
    interval = config.get("poll_interval", 5)
    logger.info(f"启动守护进程模式，每 {interval} 秒扫描一次 qBittorrent...")
    while True:
        try:
            run_once(client, config)
        except Exception as err:
            logger.error(f"扫描异常: {err}")
        time.sleep(interval)


def load_config(config_file_path=None):
    cfg = DEFAULT_CONFIG.copy()
    default_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
    target_path = config_file_path if config_file_path else default_path
    if os.path.exists(target_path):
        try:
            with open(target_path, "r", encoding="utf-8") as f:
                user_cfg = json.load(f)
                cfg.update(user_cfg)
                logger.info(f"已加载配置文件: {target_path}")
        except Exception as err:
            logger.warning(f"读取配置文件失败: {err}，使用默认配置")

    # 环境变量覆盖
    if "QB_URL" in os.environ:
        cfg["qb_url"] = os.environ["QB_URL"]
    if "QB_USER" in os.environ:
        cfg["username"] = os.environ["QB_USER"]
    if "QB_PASS" in os.environ:
        cfg["password"] = os.environ["QB_PASS"]
    if "QB_CATEGORY" in os.environ:
        cfg["category"] = os.environ["QB_CATEGORY"]

    return cfg


def main():
    parser = argparse.ArgumentParser(description="qBittorrent 自动过滤只下载 MP4 文件的工具")
    parser.add_argument("--config", "-c", help="配置文件路径 (默认同目录 config.json)")
    parser.add_argument("--daemon", "-d", action="store_true", help="常驻守护进程模式")
    parser.add_argument("--once", action="store_true", help="单次扫描模式（适合放入 cron / 群晖任务计划）")
    parser.add_argument("--hash", help="指定单独要过滤的 torrent Hash (适合外部程序触发)")
    parser.add_argument("--url", help="覆盖 qB WebUI 地址 (如 http://192.168.31.155:8080)")
    parser.add_argument("--user", help="覆盖 qB 用户名")
    parser.add_argument("--password", help="覆盖 qB 密码")
    parser.add_argument("--category", help="覆盖分类 (默认 magnet)")

    args = parser.parse_args()
    config = load_config(args.config)

    if args.url:
        config["qb_url"] = args.url
    if args.user:
        config["username"] = args.user
    if args.password:
        config["password"] = args.password
    if args.category is not None:
        config["category"] = args.category

    client = QbittorrentClient(
        base_url=config["qb_url"],
        username=config["username"],
        password=config["password"],
    )

    # 初次登录验证
    if not client.login():
        logger.error(f"无法登录 qBittorrent ({config['qb_url']})，请检查地址、端口与账号密码。")
        sys.exit(1)

    if args.hash:
        run_single_hash(client, config, args.hash.strip())
    elif args.daemon:
        run_daemon(client, config)
    else:
        # 默认或 --once
        run_once(client, config)


if __name__ == "__main__":
    main()
