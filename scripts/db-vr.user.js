// ==UserScript==
// @name         DB VR 筛选
// @namespace    https://github.com/guoyiheng/violentmonkey-script
// @version      1.0.1
// @description  演员页面一键直达 VR 分区作品
// @author       yiheng
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImJnRGJWciIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiNmNDNmNWUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjOWYxMjM5Ii8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGZpbHRlciBpZD0iYmFkZ2VTaGFkb3ciIHg9Ii0yMCUiIHk9Ii0yMCUiIHdpZHRoPSIxNDAlIiBoZWlnaHQ9IjE0MCUiPgogICAgICA8ZmVEcm9wU2hhZG93IGR4PSIwIiBkeT0iMiIgc3RkRGV2aWF0aW9uPSIzIiBmbG9vZC1vcGFjaXR5PSIwLjMiLz4KICAgIDwvZmlsdGVyPgogIDwvZGVmcz4KICA8cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgcng9IjI4IiBmaWxsPSJ1cmwoI2JnRGJWcikiLz4KICA8IS0tIEZpbG0gLyBGaWx0ZXIgd2l0aCBWUiB0ZXh0IC0tPgogIDxnIGZpbGw9IiNmZmZmZmYiPgogICAgPHJlY3QgeD0iMjQiIHk9IjM2IiB3aWR0aD0iNzYiIGhlaWdodD0iNTIiIHJ4PSIxMiIgZmlsbD0iI2ZmZmZmZiIgZmlsbC1vcGFjaXR5PSIwLjIiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLXdpZHRoPSI0Ii8+CiAgICA8dGV4dCB4PSI2MiIgeT0iNzIiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCBCbGlua01hY1N5c3RlbUZvbnQsICJTZWdvZSBVSSIsIFJvYm90bywgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyOCIgZm9udC13ZWlnaHQ9IjkwMCIgZmlsbD0iI2ZmZmZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgbGV0dGVyLXNwYWNpbmc9IjEiPlZSPC90ZXh0PgogIDwvZz4KICAKICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSg4MiwgODIpIj4KICAgIDxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjIxIiBmaWxsPSIjZmZmZmZmIiBmaWx0ZXI9InVybCgjYmFkZ2VTaGFkb3cpIi8+CiAgICA8Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxNyIgZmlsbD0iI2Y0M2Y1ZSIvPgogICAgPHRleHQgeD0iMjAiIHk9IjI3IiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCAiU2Vnb2UgVUkiLCBSb2JvdG8sIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIGZvbnQtd2VpZ2h0PSI5MDAiIGZpbGw9IiNmZmZmZmYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkU8L3RleHQ+CiAgPC9nPgo8L3N2Zz4=
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
