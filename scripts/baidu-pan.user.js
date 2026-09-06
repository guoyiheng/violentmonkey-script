// ==UserScript==
// @name         网盘自动转存
// @namespace    https://github.com/guoyiheng/violentmonkey-script
// @version      1.0.1
// @description  自动填充提取码并保存分享文件到网盘
// @author       yiheng
// @icon         https://api.iconify.design/solar:cloud-download-bold-duotone.svg?color=%232563eb
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
