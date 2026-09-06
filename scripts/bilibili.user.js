// ==UserScript==
// @name         B站关灯模式
// @namespace    https://github.com/guoyiheng/violentmonkey-script
// @version      1.1.2
// @description  只保留 B 站播放器区域，其余区域按系统深浅色主题覆盖为纯黑或纯白
// @author       yiheng
// @icon         https://api.iconify.design/ri:bilibili-fill.svg?color=%23fb7299
// @match        https://www.bilibili.com/video/*
// @match        https://www.bilibili.com/list/*
// @match        https://www.bilibili.com/bangumi/play/*
// @updateURL    https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/bilibili.user.js
// @downloadURL  https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/bilibili.user.js
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const INSTALL_FLAG = 'biliLightsOffInstalled';
  const STORAGE_KEY = 'bili-lights-off-enabled';
  const ACTIVE_CLASS = 'bili-lights-off-active';
  const ROOT_ID = 'bili-lights-off-mask';
  const PLAYER_SELECTORS = [
    '.plp-player',
    '.bpx-player-video-wrap',
    '.bpx-player-container',
  ];

  if (document.documentElement.dataset[INSTALL_FLAG] === '1') {
    return;
  }
  document.documentElement.dataset[INSTALL_FLAG] = '1';

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  let enabled = readSavedState();
  let updateFrame = 0;
  let observedPlayer = null;
  let resizeObserver = null;

  const style = document.createElement('style');
  style.id = `${ROOT_ID}-style`;
  style.textContent = `
    :root {
      --bili-lights-off-color: #ffffff;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bili-lights-off-color: #000000;
      }
    }

    #${ROOT_ID} {
      position: fixed;
      inset: 0;
      z-index: 2147483646;
      overflow: hidden;
      pointer-events: none;
      display: none;
    }

    html.${ACTIVE_CLASS} #${ROOT_ID} {
      display: block;
    }

    html.${ACTIVE_CLASS} .plp-player .bpx-player-sending-area {
      display: none !important;
    }

    #${ROOT_ID} > .bili-lights-off-panel {
      position: absolute;
      background: var(--bili-lights-off-color) !important;
      pointer-events: auto;
    }
  `;

  const mask = document.createElement('div');
  mask.id = ROOT_ID;
  mask.setAttribute('aria-hidden', 'true');

  const panels = {
    top: createPanel('top'),
    right: createPanel('right'),
    bottom: createPanel('bottom'),
    left: createPanel('left'),
  };

  Object.values(panels).forEach((panel) => {
    mask.appendChild(panel);
  });
  document.documentElement.append(style, mask);

  const mutationObserver = new MutationObserver(scheduleUpdate);
  mutationObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  window.addEventListener('resize', scheduleUpdate, { passive: true });
  window.addEventListener('scroll', scheduleUpdate, { passive: true, capture: true });
  document.addEventListener('fullscreenchange', scheduleUpdate, true);
  document.addEventListener('keydown', handleShortcut, true);

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', scheduleUpdate, { passive: true });
    window.visualViewport.addEventListener('scroll', scheduleUpdate, { passive: true });
  }

  if (typeof systemTheme.addEventListener === 'function') {
    systemTheme.addEventListener('change', scheduleUpdate);
  } else if (typeof systemTheme.addListener === 'function') {
    systemTheme.addListener(scheduleUpdate);
  }

  applyState();

  function createPanel(position) {
    const panel = document.createElement('div');
    panel.className = `bili-lights-off-panel bili-lights-off-${position}`;
    return panel;
  }

  function readSavedState() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) !== 'off';
    } catch {
      return true;
    }
  }

  function saveState() {
    try {
      window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
    } catch {
      // 浏览器禁用本地存储时，当前页面内仍可正常使用。
    }
  }

  function handleShortcut(event) {
    if (
      event.code !== 'KeyL' ||
      !event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.repeat
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    toggle();
  }

  function toggle() {
    enabled = !enabled;
    saveState();
    applyState();
  }

  function applyState() {
    document.documentElement.classList.toggle(ACTIVE_CLASS, enabled);
    mask.hidden = !enabled;
    scheduleUpdate();
  }

  function scheduleUpdate() {
    if (updateFrame) {
      return;
    }

    updateFrame = window.requestAnimationFrame(() => {
      updateFrame = 0;
      updateMask();
    });
  }

  function findPlayer() {
    for (const selector of PLAYER_SELECTORS) {
      const element = document.querySelector(selector);
      if (!element) {
        continue;
      }

      const rect = element.getBoundingClientRect();
      if (rect.width >= 200 && rect.height >= 100) {
        return element;
      }
    }

    return null;
  }

  function observePlayer(player) {
    if (observedPlayer === player) {
      return;
    }

    resizeObserver?.disconnect();
    observedPlayer = player;

    if (!player || typeof ResizeObserver !== 'function') {
      return;
    }

    resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(player);
  }

  function updateMask() {
    if (!enabled) {
      return;
    }

    const player = findPlayer();
    observePlayer(player);

    if (!player) {
      coverWholeViewport();
      return;
    }

    const rect = player.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;

    const left = clamp(Math.floor(rect.left), 0, viewportWidth);
    const right = clamp(Math.ceil(rect.right), 0, viewportWidth);
    const top = clamp(Math.floor(rect.top), 0, viewportHeight);
    const bottom = clamp(Math.ceil(rect.bottom), 0, viewportHeight);

    if (right <= left || bottom <= top) {
      coverWholeViewport();
      return;
    }

    setPanelRect(panels.top, 0, 0, viewportWidth, top);
    setPanelRect(panels.bottom, 0, bottom, viewportWidth, viewportHeight - bottom);
    setPanelRect(panels.left, 0, top, left, bottom - top);
    setPanelRect(panels.right, right, top, viewportWidth - right, bottom - top);
  }

  function coverWholeViewport() {
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;

    setPanelRect(panels.top, 0, 0, viewportWidth, viewportHeight);
    setPanelRect(panels.right, 0, 0, 0, 0);
    setPanelRect(panels.bottom, 0, 0, 0, 0);
    setPanelRect(panels.left, 0, 0, 0, 0);
  }

  function setPanelRect(panel, x, y, width, height) {
    panel.style.left = `${x}px`;
    panel.style.top = `${y}px`;
    panel.style.width = `${Math.max(0, width)}px`;
    panel.style.height = `${Math.max(0, height)}px`;
  }
})();
