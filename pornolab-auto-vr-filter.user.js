// ==UserScript==
// @name         pornolab 搜索自动选 VR 分区
// @name:zh-CN   pornolab 搜索自动选 VR 分区
// @namespace    https://github.com/yiheng/violentmonkey-script
// @version      1.2.0
// @description  pornolab.net 搜索自动选中 3D & VR 分区；话题页把 #tor-reged 第二行下载单元格悬浮到右侧（样式不变）
// @description:zh-CN 在 pornolab.net 搜索时自动选中 3D & Virtual Reality 分区 (VR)；打开话题页时仅把 #tor-reged 表格第二行 td.tCenter.pad_6 悬浮到右侧约 30% 高度处，其余不变
// @match        https://pornolab.net/forum/tracker.php*
// @match        https://www.pornolab.net/forum/tracker.php*
// @match        https://pornolab.net/forum/viewtopic.php*
// @match        https://www.pornolab.net/forum/viewtopic.php*
// @run-at       document-start
// @grant        none
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    const VR_FORUM_ID = '1823';

    // 功能 1：搜索时自动应用 VR 分区筛选
    const url = new URL(location.href);
    const params = url.searchParams;
    if (params.get('nm') && params.get('f') !== VR_FORUM_ID) {
        params.set('f', VR_FORUM_ID);
        location.replace(url.toString());
        return;
    }

    // 功能 2：话题页仅把下载单元格悬浮到右侧
    if (/\/forum\/viewtopic\.php$/.test(location.pathname)) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', floatDownloadCell);
        } else {
            floatDownloadCell();
        }
    }

    function floatDownloadCell() {
        const cell = document.querySelector('#tor-reged > table > tbody > tr:nth-child(2) > td.tCenter.pad_6');
        if (!cell) return;

        // 仅添加定位，保留原样式与宽度，其他元素一律不动
        const width = cell.offsetWidth;
        cell.style.position = 'fixed';
        cell.style.top = '30%';
        cell.style.right = '8px';
        cell.style.zIndex = '9999';
        cell.style.display = 'block';
        if (width) {
            cell.style.width = width + 'px';
        }
    }
})();
