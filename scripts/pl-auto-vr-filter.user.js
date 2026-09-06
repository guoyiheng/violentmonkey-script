// ==UserScript==
// @name         PL 论坛助手
// @name:zh-CN   PL 论坛助手
// @namespace    https://github.com/guoyiheng/violentmonkey-script
// @version      1.2.2
// @author       yiheng
// @icon         https://api.iconify.design/hugeicons:virtual-reality-vr-01.svg?color=%234f46e5
// @description  论坛搜索自动选中 3D & VR 分区；话题页把第二行下载单元格悬浮到右侧
// @description:zh-CN 论坛搜索时自动选中 3D & Virtual Reality 分区 (VR)；打开话题页时悬浮下载单元格
// @match        *://*/*
// @updateURL    https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/pl-auto-vr-filter.user.js
// @downloadURL  https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/pl-auto-vr-filter.user.js
// @run-at       document-start
// @grant        none
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    // 动态解密目标域名
    const _target = atob('cG9ybm9sYWIubmV0');
    if (!location.hostname.endsWith(_target)) return;

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
