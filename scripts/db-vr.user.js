// ==UserScript==
// @name         DB VR 筛选
// @namespace    https://github.com/guoyiheng/violentmonkey-script
// @version      1.0.2
// @description  演员页面一键直达 VR 分区作品
// @author       yiheng
// @icon         https://api.iconify.design/hugeicons:virtual-reality-vr-01.svg?color=%23f07070
// @match        *://*/*
// @updateURL    https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/db-vr.user.js
// @downloadURL  https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/db-vr.user.js
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  // 动态解密目标域名
  const _target = atob("amF2ZGIuY29t");
  if (!location.hostname.includes(_target)) return;

  setTimeout(function () {
    const father = document.querySelector("body > section > div > div:nth-child(6) > div > div");
    if (!father) return;
    const btn = document.createElement("button");
    btn.innerHTML = "VR";
    btn.style.width = "100px";
    btn.style.height = "40px";
    btn.style.background = "pink";
    btn.style.border = "pink";
    btn.onclick = getVR;
    father.appendChild(btn);

    function getVR() {
      const extra = window.location.search ? "&t=212" : "?t=212";
      window.location.href = window.location.href + extra;
    }
  }, 100);
})();
