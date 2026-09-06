// ==UserScript==
// @name         网盘自动转存
// @namespace    https://github.com/guoyiheng/violentmonkey-script
// @version      1.0.1
// @description  自动填充提取码并保存分享文件到网盘
// @author       yiheng
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImJnUGFuIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzI1NjNlYiIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMxZDRlZDgiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8ZmlsdGVyIGlkPSJiYWRnZVNoYWRvdyIgeD0iLTIwJSIgeT0iLTIwJSIgd2lkdGg9IjE0MCUiIGhlaWdodD0iMTQwJSI+CiAgICAgIDxmZURyb3BTaGFkb3cgZHg9IjAiIGR5PSIyIiBzdGREZXZpYXRpb249IjMiIGZsb29kLW9wYWNpdHk9IjAuMyIvPgogICAgPC9maWx0ZXI+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiByeD0iMjgiIGZpbGw9InVybCgjYmdQYW4pIi8+CiAgPCEtLSBDbG91ZCB3aXRoIGRvd25sb2FkIGFycm93IC0tPgogIDxnIGZpbGw9IiNmZmZmZmYiPgogICAgPHBhdGggZD0iTTc4IDQwIGMtMi40IDAtNC44IDAuNS03IDEuNCBDNjcuNCAzNS44IDYwLjIgMzIgNTIgMzIgYy0xMy4zIDAtMjQgMTAuNy0yNCAyNCAwIDAuOCAwIDEuNiAwLjIgMi40IEMyMyA2MC44IDE5IDY3LjggMTkgNzYgYzAgMTEgOSAyMCAyMCAyMCBoNDIgYzExIDAgMjAtOSAyMC0yMCAwLTkuOC03LjItMTgtMTYuOC0xOS43IEM4My4yIDQ2LjUgNzguNCA0MCA3OCA0MCBaIi8+CiAgICA8cG9seWdvbiBwb2ludHM9IjU2LDYwIDU2LDc2IDQ2LDc2IDYwLDkyIDc0LDc2IDY0LDc2IDY0LDYwIiBmaWxsPSIjMjU2M2ViIi8+CiAgPC9nPgogIAogIDxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDgyLCA4MikiPgogICAgPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjEiIGZpbGw9IiNmZmZmZmYiIGZpbHRlcj0idXJsKCNiYWRnZVNoYWRvdykiLz4KICAgIDxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjE3IiBmaWxsPSIjMjU2M2ViIi8+CiAgICA8dGV4dCB4PSIyMCIgeT0iMjciIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCBCbGlua01hY1N5c3RlbUZvbnQsICJTZWdvZSBVSSIsIFJvYm90bywgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyMCIgZm9udC13ZWlnaHQ9IjkwMCIgZmlsbD0iI2ZmZmZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+RTwvdGV4dD4KICA8L2c+Cjwvc3ZnPg==
// @match        https://pan.baidu.com/*
// @updateURL    https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/baidu-pan.user.js
// @downloadURL  https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/baidu-pan.user.js
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  window.onload = async function () {
    function sleep(wait) {
      return new Promise((resolve) => setTimeout(resolve, wait * 1000));
    }
    // 获取url中的参数
    function getUrlParam(name) {
      var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)");
      var r = window.location.search.substr(1).match(reg);
      if (r != null) return unescape(r[2]);
      return null;
    }

    const 提取码 = "#accessCode";
    const 提取文件 = "#submitBtn";
    const 全选 =
      "#shareqr > div.KPDwCE > div.QxJxtg > div > ul.QAfdwP.tvPMvPb > li.fufHyA.yfHIsP > div > span.zbyDdwb";
    const 保存到网盘 =
      "#shareqr > div.KPDwCE.JS-module-list-multselected > div.QxJxtg.cazEfA > div > div > div > div.x-button-box > a:nth-child(2) > span > span";
    const 保存到网盘2 =
      "#layoutMain > div.frame-content > div.module-share-header > div > div.slide-show-right > div > div > div.x-button-box > a.g-button.tools-share-save-hb > span";
    const 保存到网盘3 =
      "#bd-main > div > div.module-share-header > div > div.slide-show-right > div > div > div.x-button-box > a.g-button.tools-share-save-hb.tools-share-V20-btn.save_btn > span > span";
    const 我的资源 =
      "#fileTreeDialog > div.dialog-body > div > ul > li > ul > li:nth-child(4) > div > span > span";
    const 确定 =
      "#fileTreeDialog > div.dialog-footer.g-clearfix > a.g-button.g-button-blue-large";

    function _dom(selector) {
      return document.querySelector(selector);
    }
    function _trigger(selector) {
      const triggerDom = _dom(selector);
      if (triggerDom) triggerDom.click();
    }
    function _input(selector) {
      const triggerDom = _dom(selector);
      if (triggerDom) triggerDom.value = getUrlParam("code");
    }

    await sleep(1);
    if (_dom(提取码)) {
      _input(提取码);
      await sleep(1);
      _trigger(提取文件);
      await sleep(1);
    }
    if (_dom(全选)) {
      await sleep(1);
    }
    if (_dom(保存到网盘)) {
      _trigger(保存到网盘);
      await sleep(1);
    } else if (_dom(保存到网盘2)) {
      _trigger(保存到网盘2);
      await sleep(1);
    } else if (_dom(保存到网盘3)) {
      _trigger(保存到网盘3);
      await sleep(1);
    }
    if (_dom(我的资源)) {
      _trigger(我的资源);
      await sleep(0.5);
    }
    if (_dom(确定)) {
      _trigger(确定);
      await sleep(1);
    }
  };
})();
