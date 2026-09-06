// ==UserScript==
// @name         有谱伴奏助手
// @namespace    https://github.com/guoyiheng/violentmonkey-script
// @version      1.0.1
// @description  有谱伴奏本地会员状态支持
// @author       yiheng
// @icon         https://api.iconify.design/solar:music-note-bold-duotone.svg?color=%2310b981
// @match        *://*.yopu.co/*
// @updateURL    https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/youpu.user.js
// @downloadURL  https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/youpu.user.js
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const KEY = "user-data-user-info";

  const patch = (raw) => {
    if (!raw) return raw;
    try {
      const o = JSON.parse(raw);
      if (o && typeof o === "object") {
        o.isMember = true;
        o.isPianoMember = true;
        o.isBanned = false;
        return JSON.stringify(o);
      }
    } catch (_) { }
    return raw;
  };

  // 1) 拦截 getItem：每次读取均返回会员状态
  const _get = Storage.prototype.getItem;
  Storage.prototype.getItem = function (k) {
    const v = _get.call(this, k);
    return k === KEY ? patch(v) : v;
  };

  // 2) 拦截 setItem：写入前强制覆盖，防止被远程状态重置
  const _set = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    return _set.call(this, k, k === KEY ? patch(v) : v);
  };

  // 3) 启动时直接更新当前本地存储
  try {
    const cur = _get.call(localStorage, KEY);
    if (cur) _set.call(localStorage, KEY, patch(cur));
  } catch (_) { }
})();
