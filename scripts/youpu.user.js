// ==UserScript==
// @name         有谱伴奏助手
// @namespace    https://github.com/guoyiheng/violentmonkey-script
// @version      1.0.1
// @description  有谱伴奏本地会员状态支持
// @author       yiheng
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImJnWW91cHUiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMTBiOTgxIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzA0Nzg1NyIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxmaWx0ZXIgaWQ9ImJhZGdlU2hhZG93IiB4PSItMjAlIiB5PSItMjAlIiB3aWR0aD0iMTQwJSIgaGVpZ2h0PSIxNDAlIj4KICAgICAgPGZlRHJvcFNoYWRvdyBkeD0iMCIgZHk9IjIiIHN0ZERldmlhdGlvbj0iMyIgZmxvb2Qtb3BhY2l0eT0iMC4zIi8+CiAgICA8L2ZpbHRlcj4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjEyOCIgaGVpZ2h0PSIxMjgiIHJ4PSIyOCIgZmlsbD0idXJsKCNiZ1lvdXB1KSIvPgogIDwhLS0gTXVzaWMgTm90ZSAvIFNoZWV0IC0tPgogIDxnIGZpbGw9IiNmZmZmZmYiPgogICAgPHBhdGggZD0iTTQ2IDc2IGMwLTUuNSA0LjUtMTAgMTAtMTAgYzEuNCAwIDIuOCAwLjMgNCAwLjggVjM2IGwyNi02IHYzMiBjMC01LjUgNC41LTEwIDEwLTEwIGM1LjUgMCAxMCA0LjUgMTAgMTAgcy00LjUgMTAtMTAgMTAgYy01LjUgMC0xMC00LjUtMTAtMTAgVjQ2IGwtMjAgNC42IHYyNS40IGMwIDUuNS00LjUgMTAtMTAgMTAgcy0xMC00LjUtMTAtMTAgWiIvPgogIDwvZz4KICAKICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSg4MiwgODIpIj4KICAgIDxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjIxIiBmaWxsPSIjZmZmZmZmIiBmaWx0ZXI9InVybCgjYmFkZ2VTaGFkb3cpIi8+CiAgICA8Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxNyIgZmlsbD0iIzEwYjk4MSIvPgogICAgPHRleHQgeD0iMjAiIHk9IjI3IiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCAiU2Vnb2UgVUkiLCBSb2JvdG8sIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIGZvbnQtd2VpZ2h0PSI5MDAiIGZpbGw9IiNmZmZmZmYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkU8L3RleHQ+CiAgPC9nPgo8L3N2Zz4=
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
