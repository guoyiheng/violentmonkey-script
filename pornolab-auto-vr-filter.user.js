// ==UserScript==
// @name         pornolab 搜索自动选 VR 分区
// @name:zh-CN   pornolab 搜索自动选 VR 分区
// @namespace    https://github.com/yiheng/violentmonkey-script
// @version      1.0.0
// @description  pornolab.net 上搜索时自动选中 3D & Virtual Reality 分区 (f=1823)
// @description:zh-CN 在 pornolab.net 搜索时自动选中 3D & Virtual Reality 分区 (VR)
// @match        https://pornolab.net/forum/tracker.php*
// @match        https://www.pornolab.net/forum/tracker.php*
// @run-at       document-start
// @grant        none
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    const VR_FORUM_ID = '1823';

    const url = new URL(location.href);
    const params = url.searchParams;

    // 仅处理搜索页（URL 带搜索词 nm），且尚未应用 VR 筛选时自动加上 f=1823
    if (params.get('nm') && params.get('f') !== VR_FORUM_ID) {
        params.set('f', VR_FORUM_ID);
        location.replace(url.toString());
    }
})();
