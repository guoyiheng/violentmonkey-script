// ==UserScript==
// @name         PL 论坛助手
// @name:zh-CN   PL 论坛助手
// @namespace    https://github.com/guoyiheng/violentmonkey-script
// @version      1.2.1
// @author       yiheng
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImJnUGwiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjNGY0NmU1Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzFlMWI0YiIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxmaWx0ZXIgaWQ9ImJhZGdlU2hhZG93IiB4PSItMjAlIiB5PSItMjAlIiB3aWR0aD0iMTQwJSIgaGVpZ2h0PSIxNDAlIj4KICAgICAgPGZlRHJvcFNoYWRvdyBkeD0iMCIgZHk9IjIiIHN0ZERldmlhdGlvbj0iMyIgZmxvb2Qtb3BhY2l0eT0iMC4zIi8+CiAgICA8L2ZpbHRlcj4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjEyOCIgaGVpZ2h0PSIxMjgiIHJ4PSIyOCIgZmlsbD0idXJsKCNiZ1BsKSIvPgogIDxnIGZpbGw9IiNmZmZmZmYiPgogICAgPHJlY3QgeD0iMjQiIHk9IjQ0IiB3aWR0aD0iNzYiIGhlaWdodD0iNDAiIHJ4PSIxNCIvPgogICAgPHBhdGggZD0iTTUyIDg0IGExMCAxMCAwIDAgMCAyMCAwIFoiIGZpbGw9IiMxZTFiNGIiLz4KICAgIDxjaXJjbGUgY3g9IjQ0IiBjeT0iNjIiIHI9IjkiIGZpbGw9IiMxZTFiNGIiLz4KICAgIDxjaXJjbGUgY3g9Ijc4IiBjeT0iNjIiIHI9IjkiIGZpbGw9IiMxZTFiNGIiLz4KICAgIDxyZWN0IHg9IjE4IiB5PSI1NiIgd2lkdGg9IjYiIGhlaWdodD0iMTYiIHJ4PSIyIi8+CiAgICA8cmVjdCB4PSIxMDAiIHk9IjU2IiB3aWR0aD0iNiIgaGVpZ2h0PSIxNiIgcng9IjIiLz4KICA8L2c+CiAgCiAgPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoODIsIDgyKSI+CiAgICA8Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIyMSIgZmlsbD0iI2ZmZmZmZiIgZmlsdGVyPSJ1cmwoI2JhZGdlU2hhZG93KSIvPgogICAgPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMTciIGZpbGw9IiM0ZjQ2ZTUiLz4KICAgIDx0ZXh0IHg9IjIwIiB5PSIyNyIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgIlNlZ29lIFVJIiwgUm9ib3RvLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjIwIiBmb250LXdlaWdodD0iOTAwIiBmaWxsPSIjZmZmZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5FPC90ZXh0PgogIDwvZz4KPC9zdmc+
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
