// ==UserScript==
// @name         Easy Copy & qBittorrent 推送
// @namespace    http://tampermonkey.net/
// @version      2.1.0
// @description  边缘吸附可折叠面板，自动拦截并汇总复制的磁力链接、去重、一键推送 NAS qBittorrent、跨标签页同步、记住位置
// @author       you
// @match        http://*/*
// @match        https://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      *
// @connect      192.168.31.155
// @connect      localhost
// @connect      127.0.0.1
// @run-at       document-end
// ==/UserScript==

;(function () {
  'use strict'

  if (window.top !== window.self) return

  const SCRIPT_VERSION = 'v2.1.0'
  const STORE_KEY = 'easy_copy_items_v1'
  const DOCK_KEY = 'easy_copy_dock_v2'
  const LEGACY_POS_KEY = 'easy_copy_pos_v1'
  const QB_SETTINGS_KEY = 'easy_copy_qb_settings_v1'
  const QB_SID_KEY = 'easy_copy_qb_sid'
  const INSTANCE_ID = Math.random().toString(36).slice(2) + Date.now().toString(36)
  const hasGM = typeof GM_setValue === 'function' && typeof GM_getValue === 'function'

  // ---------- 通用存储工具 ----------
  const loadJSON = (key, fallback) => {
    if (!hasGM) {
      try {
        const raw = localStorage.getItem(key)
        return raw ? JSON.parse(raw) : fallback
      } catch (_) {
        return fallback
      }
    }
    try {
      const raw = GM_getValue(key, '')
      return raw ? JSON.parse(raw) : fallback
    } catch (_) {
      return fallback
    }
  }

  const saveJSON = (key, val) => {
    if (!hasGM) {
      try {
        localStorage.setItem(key, JSON.stringify(val))
      } catch (_) {}
      return
    }
    try {
      GM_setValue(key, JSON.stringify(val))
    } catch (_) {}
  }

  const escapeHTML = (str) => {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  // ---------- qBittorrent 配置与状态 ----------
  const DEFAULT_QB_SETTINGS = {
    serverUrl: 'http://192.168.31.155:8085/',
    username: '',
    password: '',
    savepath: '',
    category: 'magnet',
    autoSend: false,
  }

  // 兼容读取之前 qbittorrent.user.js 的配置
  const savedQbSettings = loadJSON(QB_SETTINGS_KEY, null) || loadJSON('qb_magnet_settings_v1', null) || {}
  let qbSettings = Object.assign({}, DEFAULT_QB_SETTINGS, savedQbSettings)
  if (!qbSettings.category || !qbSettings.category.trim()) {
    qbSettings.category = DEFAULT_QB_SETTINGS.category
  }

  let cachedSid = loadJSON(QB_SID_KEY, '') || ''
  let qbBusy = false

  // ---------- 磁力解析工具 ----------
  const extractMagnets = (raw) => {
    if (!raw || typeof raw !== 'string') return []
    let text = raw
    if (text.includes('%3A') || text.includes('%3a') || text.includes('%3F') || text.includes('%3f')) {
      try {
        text = decodeURIComponent(text)
      } catch (_) {}
    }
    const matches = text.match(/magnet:\?[^\s"'<>]+/gi)
    if (!matches || !matches.length) return []
    const cleanList = matches
      .map((m) => m.replace(/[),.，。；;]+$/g, '').replace(/&amp;/g, '&').trim())
      .filter((m) => /^magnet:\?/i.test(m))
    return Array.from(new Set(cleanList))
  }

  const extractMagnetName = (magnetUrl) => {
    try {
      const qIndex = magnetUrl.indexOf('?')
      if (qIndex !== -1) {
        const params = new URLSearchParams(magnetUrl.substring(qIndex + 1))
        const dn = params.get('dn')
        if (dn) return dn.trim()
        const xt = params.get('xt') || ''
        const hashMatch = xt.match(/urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i)
        if (hashMatch) {
          const hash = hashMatch[1].toUpperCase()
          return `${hash.slice(0, 8)}...${hash.slice(-6)}`
        }
      }
    } catch (_) {}
    return '磁力链接'
  }

  const getCleanHash = (rawHash) => {
    if (!rawHash) return ''
    rawHash = rawHash.trim().toLowerCase()
    if (/^[0-9a-f]{40}$/i.test(rawHash)) return rawHash
    if (/^[a-z2-7]{32}$/i.test(rawHash)) {
      const alphabet = 'abcdefghijklmnopqrstuvwxyz234567'
      let bits = ''
      for (let i = 0; i < 32; i++) {
        const val = alphabet.indexOf(rawHash[i])
        if (val === -1) return rawHash
        bits += val.toString(2).padStart(5, '0')
      }
      let hex = ''
      for (let i = 0; i + 4 <= bits.length; i += 4) {
        hex += parseInt(bits.substring(i, i + 4), 2).toString(16)
      }
      return hex.toLowerCase()
    }
    return rawHash
  }

  const extractMagnetHash = (magnetUrl) => {
    try {
      const qIndex = magnetUrl.indexOf('?')
      if (qIndex !== -1) {
        const params = new URLSearchParams(magnetUrl.substring(qIndex + 1))
        const xt = params.get('xt') || ''
        const hashMatch = xt.match(/urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i)
        if (hashMatch) {
          return getCleanHash(hashMatch[1])
        }
      }
    } catch (_) {}
    return ''
  }

  // ---------- 样式安装 ----------
  const css = `
#easy-copy-root {
  --ec-ink: #222725;
  --ec-ink-soft: #5e6863;
  --ec-ink-muted: #8e9993;
  --ec-paper: #f4f6f3;
  --ec-surface: #ffffff;
  --ec-surface-elevated: #ffffff;
  --ec-line: #dee3dd;
  --ec-line-soft: #eaeee9;
  --ec-hover: #edf1ec;
  --ec-accent: #86d5e8;
  --ec-accent-strong: #1f7d96;
  --ec-accent-bg: rgba(31, 125, 150, 0.08);
  --ec-success: #287a56;
  --ec-error: #be5349;
  position: fixed;
  z-index: 2147483647;
  color: var(--ec-ink);
  font-family: "IBM Plex Sans", "Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  line-height: 1.4;
  letter-spacing: 0;
  pointer-events: none;
  transition: top 0.3s cubic-bezier(0.18, 0.9, 0.3, 1.2), bottom 0.3s cubic-bezier(0.18, 0.9, 0.3, 1.2), left 0.3s cubic-bezier(0.18, 0.9, 0.3, 1.2), right 0.3s cubic-bezier(0.18, 0.9, 0.3, 1.2), transform 0.3s cubic-bezier(0.18, 0.9, 0.3, 1.2);
}

#easy-copy-root.is-dragging {
  transition: none !important;
  opacity: 0.95;
}

/* 边缘停靠位置（避开 web-shelf 的 80px / 50% 居中，错开 56px 堆叠，互不遮挡） */
#easy-copy-root.ec-dock-right {
  right: 0;
  left: auto;
}

#easy-copy-root.ec-dock-left {
  left: 0;
  right: auto;
}

#easy-copy-root.ec-dock-center {
  top: calc(50% + 56px);
  bottom: auto;
  transform: translateY(-50%);
}

#easy-copy-root.ec-dock-top {
  top: 140px;
  bottom: auto;
  transform: translateY(0);
}

#easy-copy-root.ec-dock-bottom {
  top: auto;
  bottom: 140px;
  transform: translateY(0);
}

#easy-copy-root *,
#easy-copy-root *::before,
#easy-copy-root *::after {
  box-sizing: border-box;
}

#easy-copy-root button,
#easy-copy-root input,
#easy-copy-root textarea {
  font: inherit;
  letter-spacing: 0;
}

#easy-copy-root button {
  -webkit-tap-highlight-color: transparent;
}

/* 边缘悬浮胶囊：专用于一键呼出收集页面 */
.ec-launcher {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 42px;
  border: 1px solid var(--ec-line);
  background: var(--ec-surface);
  pointer-events: auto;
  opacity: 0.5;
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.24s ease, box-shadow 0.24s ease, background 0.2s ease, border-color 0.2s ease;
  user-select: none;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
}

.ec-launcher:active,
#easy-copy-root.is-dragging .ec-launcher {
  cursor: grabbing;
}

/* 右侧停靠 */
#easy-copy-root.ec-dock-right .ec-launcher {
  border-right: none;
  border-radius: 21px 0 0 21px;
  transform: translateX(18px);
  box-shadow: -4px 8px 24px rgba(25, 35, 30, 0.12), -1px 2px 6px rgba(25, 35, 30, 0.06);
}

#easy-copy-root.ec-dock-right .ec-launcher:hover,
#easy-copy-root.ec-dock-right .ec-launcher:focus-within,
#easy-copy-root.ec-dock-right.is-open .ec-launcher {
  transform: translateX(0);
  opacity: 1;
  box-shadow: -6px 10px 28px rgba(25, 35, 30, 0.18), -2px 3px 8px rgba(25, 35, 30, 0.1);
  background: var(--ec-surface-elevated);
}

/* 左侧停靠 */
#easy-copy-root.ec-dock-left .ec-launcher {
  border-left: none;
  border-radius: 0 21px 21px 0;
  transform: translateX(-18px);
  box-shadow: 4px 8px 24px rgba(25, 35, 30, 0.12), 1px 2px 6px rgba(25, 35, 30, 0.06);
}

#easy-copy-root.ec-dock-left .ec-launcher:hover,
#easy-copy-root.ec-dock-left .ec-launcher:focus-within,
#easy-copy-root.ec-dock-left.is-open .ec-launcher {
  transform: translateX(0);
  opacity: 1;
  box-shadow: 6px 10px 28px rgba(25, 35, 30, 0.18), 2px 3px 8px rgba(25, 35, 30, 0.1);
  background: var(--ec-surface-elevated);
}

/* 胶囊主按钮：呼出收集页面 */
.ec-launcher-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  border: 0;
  background: transparent;
  color: var(--ec-ink);
  cursor: pointer;
  padding: 0 12px;
  gap: 6px;
  font-weight: 500;
  font-size: 12px;
  transition: background 0.15s ease, color 0.15s ease;
  outline: none;
}

.ec-launcher-button:hover {
  background: var(--ec-hover);
  color: var(--ec-accent-strong);
}

.ec-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--ec-accent-bg);
  color: var(--ec-accent-strong);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  transition: background 0.2s, color 0.2s;
}

.ec-launcher[data-has-items="true"] .ec-badge {
  background: var(--ec-accent-strong);
  color: #ffffff;
}

.ec-launcher[data-state="success"] {
  border-color: var(--ec-success);
}

/* 浮动面板 */
.ec-panel {
  position: absolute;
  width: min(360px, calc(100vw - 32px));
  max-height: min(580px, calc(100vh - 40px));
  display: flex;
  flex-direction: column;
  border: 1px solid var(--ec-line);
  border-radius: 12px;
  padding: 14px 16px;
  background: var(--ec-surface);
  box-shadow: 0 16px 40px rgba(25, 35, 30, 0.16), 0 3px 10px rgba(25, 35, 30, 0.08);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease, transform 0.24s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.2s ease;
  visibility: hidden;
  box-sizing: border-box;
  text-align: left;
}

/* 面板定位：右侧停靠 */
#easy-copy-root.ec-dock-right .ec-panel {
  right: calc(100% + 12px);
  left: auto;
}

#easy-copy-root.ec-dock-right.ec-dock-center .ec-panel {
  top: 50%;
  bottom: auto;
  transform: translateY(-50%) translateX(12px) scale(0.96);
  transform-origin: center right;
}
#easy-copy-root.ec-dock-right.ec-dock-center .ec-panel.is-open {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(-50%) translateX(0) scale(1);
  visibility: visible;
}

#easy-copy-root.ec-dock-right.ec-dock-top .ec-panel {
  top: 0;
  bottom: auto;
  transform: translateX(12px) scale(0.96);
  transform-origin: top right;
}
#easy-copy-root.ec-dock-right.ec-dock-top .ec-panel.is-open {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(0) scale(1);
  visibility: visible;
}

#easy-copy-root.ec-dock-right.ec-dock-bottom .ec-panel {
  top: auto;
  bottom: 0;
  transform: translateX(12px) scale(0.96);
  transform-origin: bottom right;
}
#easy-copy-root.ec-dock-right.ec-dock-bottom .ec-panel.is-open {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(0) scale(1);
  visibility: visible;
}

/* 面板定位：左侧停靠 */
#easy-copy-root.ec-dock-left .ec-panel {
  left: calc(100% + 12px);
  right: auto;
}

#easy-copy-root.ec-dock-left.ec-dock-center .ec-panel {
  top: 50%;
  bottom: auto;
  transform: translateY(-50%) translateX(-12px) scale(0.96);
  transform-origin: center left;
}
#easy-copy-root.ec-dock-left.ec-dock-center .ec-panel.is-open {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(-50%) translateX(0) scale(1);
  visibility: visible;
}

#easy-copy-root.ec-dock-left.ec-dock-top .ec-panel {
  top: 0;
  bottom: auto;
  transform: translateX(-12px) scale(0.96);
  transform-origin: top left;
}
#easy-copy-root.ec-dock-left.ec-dock-top .ec-panel.is-open {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(0) scale(1);
  visibility: visible;
}

#easy-copy-root.ec-dock-left.ec-dock-bottom .ec-panel {
  top: auto;
  bottom: 0;
  transform: translateX(-12px) scale(0.96);
  transform-origin: bottom left;
}
#easy-copy-root.ec-dock-left.ec-dock-bottom .ec-panel.is-open {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(0) scale(1);
  visibility: visible;
}

/* 面板头部 */
.ec-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.ec-panel-header:active {
  cursor: grabbing;
}

.ec-header-title-wrap {
  display: flex;
  flex-direction: column;
}

.ec-kicker-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
}

.ec-kicker {
  display: block;
  color: var(--ec-accent-strong);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  line-height: 1;
}

.ec-version-badge {
  display: inline-block;
  padding: 1px 4px;
  border-radius: 4px;
  background: var(--ec-line-soft);
  color: var(--ec-ink-muted);
  font-size: 10px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  line-height: 1;
}

.ec-panel-header h2 {
  margin: 0;
  color: var(--ec-ink);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.2;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.ec-header-actions {
  display: flex;
  align-items: center;
  gap: 3px;
}

.ec-icon-btn-header {
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border: 0;
  border-radius: 6px;
  color: var(--ec-ink-soft);
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  transition: color 0.15s ease, background 0.15s ease;
}

.ec-icon-btn-header:hover {
  color: var(--ec-ink);
  background: var(--ec-hover);
}

.ec-icon-btn-header.is-active,
.ec-icon-btn-header.is-pinned {
  color: var(--ec-accent-strong);
  background: var(--ec-accent-bg);
}

/* 面板内容视图切换 */
.ec-view {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ec-view[hidden] {
  display: none !important;
}

/* 文本域 */
.ec-textarea {
  width: 100%;
  height: 220px;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid var(--ec-line);
  border-radius: 8px;
  background: var(--ec-paper);
  font-size: 12px;
  line-height: 1.5;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--ec-ink);
  resize: vertical;
  outline: none;
  white-space: pre-wrap;
  word-break: break-all;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}

.ec-textarea:hover {
  border-color: #b8c0b9;
}

.ec-textarea:focus {
  border-color: var(--ec-accent-strong);
  box-shadow: 0 0 0 2px var(--ec-accent-bg);
  background: var(--ec-surface);
}

.ec-textarea::placeholder {
  color: var(--ec-ink-muted);
}

/* 设置表单 */
.ec-form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 8px;
}

.ec-form-label {
  color: var(--ec-ink-soft);
  font-size: 11px;
  font-weight: 600;
}

.ec-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.ec-input {
  width: 100%;
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--ec-line);
  border-radius: 6px;
  background: var(--ec-paper);
  color: var(--ec-ink);
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.ec-input:focus {
  border-color: var(--ec-accent-strong);
  box-shadow: 0 0 0 2px var(--ec-accent-bg);
  background: var(--ec-surface);
}

.ec-input-pwd {
  padding-right: 28px;
  font-family: monospace;
}

.ec-pwd-toggle {
  position: absolute;
  right: 6px;
  border: 0;
  background: transparent;
  color: var(--ec-ink-soft);
  cursor: pointer;
  padding: 2px;
  font-size: 12px;
  line-height: 1;
}

.ec-checkbox-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--ec-ink);
  margin-top: 2px;
  cursor: pointer;
}

.ec-checkbox-row input {
  cursor: pointer;
}

/* 按钮工具栏 */
.ec-btn-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}

.ec-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--ec-line);
  border-radius: 6px;
  background: var(--ec-surface);
  color: var(--ec-ink);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
  white-space: nowrap;
}

.ec-btn:hover:not(:disabled) {
  background: var(--ec-hover);
  border-color: #b8c0b9;
}

.ec-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ec-btn-icon {
  width: 34px;
  padding: 0;
  flex: 0 0 auto;
}

.ec-btn-primary {
  flex: 1;
  background: var(--ec-ink);
  color: #f7faf8;
  border-color: var(--ec-ink);
  font-weight: 600;
}

.ec-btn-primary:hover:not(:disabled) {
  background: #39423d;
  border-color: #39423d;
  color: #ffffff;
}

.ec-status {
  margin-top: 6px;
  font-size: 11px;
  min-height: 16px;
  line-height: 1.4;
  word-break: break-all;
}

.ec-status:empty {
  display: none;
}

.ec-status--pending {
  color: var(--ec-accent-strong);
}

.ec-status--success {
  color: var(--ec-success);
  font-weight: 500;
}

.ec-status--error {
  color: var(--ec-error);
  font-weight: 500;
}

/* 正中间 Toast 提示区 */
.ec-center-toast-region {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 2147483647;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  max-width: min(480px, calc(100vw - 32px));
  font-family: "IBM Plex Sans", "Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.ec-center-toast {
  position: relative;
  pointer-events: auto;
  display: inline-flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 240px;
  max-width: 520px;
  padding: 12px 18px;
  border-radius: 12px;
  border: 1px solid var(--ec-line);
  background: var(--ec-surface-elevated);
  color: var(--ec-ink);
  box-shadow: 0 20px 48px rgba(25, 35, 30, 0.22), 0 4px 14px rgba(25, 35, 30, 0.08);
  font-size: 13px;
  line-height: 1.4;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  opacity: 0;
  transform: scale(0.9) translateY(10px);
  transition: opacity 0.22s ease, transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
  box-sizing: border-box;
  text-align: left;
}

.ec-center-toast.is-visible {
  opacity: 1;
  transform: scale(1) translateY(0);
}

.ec-center-toast.is-leaving {
  opacity: 0;
  transform: scale(0.92) translateY(-10px);
  pointer-events: none;
}

.ec-toast-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
}

.ec-toast-indicator svg {
  width: 20px;
  height: 20px;
}

.ec-center-toast--success .ec-toast-indicator {
  color: var(--ec-success);
}

.ec-center-toast--warning .ec-toast-indicator {
  color: #d97706;
}

.ec-center-toast--danger .ec-toast-indicator {
  color: var(--ec-error);
}

.ec-toast-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ec-toast-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--ec-ink);
}

.ec-toast-subtitle {
  font-size: 11px;
  color: var(--ec-ink-soft);
  word-break: break-word;
  white-space: pre-wrap;
  max-width: 440px;
  line-height: 1.45;
}

/* 暗色主题适配 */
@media (prefers-color-scheme: dark) {
  #easy-copy-root {
    --ec-ink: #ecf1ed;
    --ec-ink-soft: #a3afa8;
    --ec-ink-muted: #74817a;
    --ec-paper: #1c221f;
    --ec-surface: #252c28;
    --ec-surface-elevated: #2b332f;
    --ec-line: #3f4a43;
    --ec-line-soft: #323b35;
    --ec-hover: #2f3732;
    --ec-accent: #89d7e8;
    --ec-accent-strong: #8dd4e3;
    --ec-accent-bg: rgba(141, 212, 227, 0.15);
    --ec-success: #8bd5b0;
    --ec-error: #f0a099;
  }
  .ec-launcher {
    background: #1e2421;
    border-color: #3f4a43;
    box-shadow: -4px 8px 24px rgba(0, 0, 0, 0.4), -1px 2px 8px rgba(0, 0, 0, 0.25);
  }
  .ec-panel {
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.25);
  }
  .ec-center-toast {
    box-shadow: 0 20px 48px rgba(0, 0, 0, 0.55), 0 4px 16px rgba(0, 0, 0, 0.35);
  }
  .ec-textarea:hover,
  .ec-input:hover {
    border-color: #5b6960;
  }
  .ec-btn-primary {
    background: #3c4942;
    color: #f3f7f4;
    border-color: #4a5850;
  }
  .ec-btn-primary:hover:not(:disabled) {
    background: #495850;
    color: #ffffff;
  }
}

@media (max-width: 520px) {
  .ec-panel {
    position: fixed;
    right: 12px !important;
    left: 12px !important;
    top: auto !important;
    bottom: 20px !important;
    transform: translateY(12px) scale(0.97) !important;
    width: auto;
    max-height: 80vh;
    transform-origin: bottom center;
  }
  .ec-panel.is-open {
    transform: translateY(0) scale(1) !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  #easy-copy-root *,
  #easy-copy-root *::before,
  #easy-copy-root *::after {
    transition-duration: 0.01ms !important;
  }
}
`

  const installStyles = () => {
    if (document.getElementById('easy-copy-styles')) return
    const style = document.createElement('style')
    style.id = 'easy-copy-styles'
    style.textContent = css
    ;(document.head || document.documentElement).appendChild(style)
  }

  // ---------- 图标库 ----------
  const ICONS = {
    magnet: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4v7a8 8 0 0 0 16 0V4"/><line x1="4" y1="8" x2="8" y2="8"/><line x1="16" y1="8" x2="20" y2="8"/></svg>`,
    rocket: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    undo: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.2 6.4h6.4a3.6 3.6 0 0 1 0 7.2H6"/><path d="M5.8 3.6 3 6.4l2.8 2.8"/></svg>`,
    redo: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.8 6.4H6.4a3.6 3.6 0 0 0 0 7.2H10"/><path d="M10.2 3.6 13 6.4l-2.8 2.8"/></svg>`,
    pin: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a1 1 0 0 0 0-2H8a1 1 0 0 0 0 2h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z"/></svg>`,
    check: `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.2 8.5l3.2 3.2 6.4-6.4"/></svg>`,
    info: `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><line x1="8" y1="5" x2="8" y2="8"/><circle cx="8" cy="11" r="0.5" fill="currentColor"/></svg>`,
  }

  // ---------- 屏幕正中 Toast 提示系统 ----------
  let centerToastRegion = null
  const getCenterToastRegion = () => {
    if (!centerToastRegion || !document.body.contains(centerToastRegion)) {
      centerToastRegion = document.createElement('div')
      centerToastRegion.className = 'ec-center-toast-region'
      document.body.appendChild(centerToastRegion)
    }
    return centerToastRegion
  }

  const showCenterToast = (title, subtitle = '', type = 'success', duration = 2200) => {
    const region = getCenterToastRegion()
    const toast = document.createElement('div')
    toast.className = `ec-center-toast ec-center-toast--${type}`

    const icon = type === 'warning' || type === 'danger' ? ICONS.info : ICONS.check
    toast.innerHTML = `
      <span class="ec-toast-indicator">${icon}</span>
      <div class="ec-toast-body">
        <div class="ec-toast-title">${escapeHTML(title)}</div>
        ${subtitle ? `<div class="ec-toast-subtitle">${escapeHTML(subtitle)}</div>` : ''}
      </div>
    `
    region.appendChild(toast)
    requestAnimationFrame(() => {
      toast.classList.add('is-visible')
    })

    const dismiss = () => {
      if (toast.classList.contains('is-leaving')) return
      toast.classList.remove('is-visible')
      toast.classList.add('is-leaving')
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast)
      }, 240)
    }

    const timer = setTimeout(dismiss, duration)
    toast.addEventListener('click', () => {
      clearTimeout(timer)
      dismiss()
    })
  }

  // ---------- qBittorrent API 通信 ----------
  const getQbBaseUrl = () => {
    let url = (qbSettings.serverUrl || DEFAULT_QB_SETTINGS.serverUrl).trim()
    if (!/^https?:\/\//i.test(url)) url = 'http://' + url
    return url.replace(/\/+$/, '')
  }

  const qbRequest = (endpoint, options) => {
    const baseUrl = getQbBaseUrl()
    const url = baseUrl + endpoint
    return new Promise((resolve, reject) => {
      const headers = Object.assign({}, options && options.headers)
      // 携带 Origin 与 Referer 防范 qBittorrent 默认开启的 CSRF 保护校验
      headers['Origin'] = baseUrl
      headers['Referer'] = baseUrl + '/'
      if (cachedSid) {
        headers['Cookie'] = `SID=${cachedSid}`
      }
      if (typeof GM_xmlhttpRequest !== 'function') {
        reject(new Error('当前运行环境不支持 GM_xmlhttpRequest，请在脚本管理器中授权'))
        return
      }
      GM_xmlhttpRequest({
        method: (options && options.method) || 'GET',
        url: url,
        headers: headers,
        data: options && options.data,
        timeout: 12000,
        onload: (res) => {
          try {
            const rawHeaders = res.responseHeaders || ''
            const match = rawHeaders.match(/set-cookie:\s*SID=([^;]+)/i)
            if (match && match[1]) {
              cachedSid = match[1]
              saveJSON(QB_SID_KEY, cachedSid)
            }
          } catch (_) {}
          resolve(res)
        },
        ontimeout: () => {
          reject(new Error('请求超时，请检查 NAS 连通性或端口'))
        },
        onerror: () => {
          reject(new Error(`无法连接 qBittorrent 服务 (${baseUrl})`))
        },
      })
    })
  }

  const qbLogin = async () => {
    const user = (qbSettings.username || '').trim()
    const pwd = qbSettings.password || ''
    if (!user && !pwd) {
      throw new Error('qBittorrent 服务需要登录鉴权，请在设置中配置用户名与密码')
    }

    const data = `username=${encodeURIComponent(user)}&password=${encodeURIComponent(pwd)}`
    const res = await qbRequest('/api/v2/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: data,
    })
    const body = (res.responseText || '').trim()
    if (res.status === 200 && body === 'Ok.') {
      return true
    }
    if (body === 'Fails.') {
      throw new Error('用户名或密码错误，请在设置中重新核对')
    }
    throw new Error(`登录返回异常 (${res.status}): ${body || '未知错误'}`)
  }

  // 查询某个 hash 是否已存在于 qBittorrent 任务列表中 (下载中/已完成等)
  const checkTorrentExists = async (hash) => {
    if (!hash) return null
    try {
      let res = await qbRequest(`/api/v2/torrents/info?hashes=${encodeURIComponent(hash)}`)
      if (res.status === 403 || res.status === 401) {
        await qbLogin()
        res = await qbRequest(`/api/v2/torrents/info?hashes=${encodeURIComponent(hash)}`)
      }
      if (res.status === 200) {
        const list = JSON.parse(res.responseText || '[]')
        if (Array.isArray(list) && list.length > 0) {
          return list[0]
        }
      }
    } catch (_) {}
    return null
  }

  // 推送单条磁力并返回结构化执行结果 (含成功/重复/失败详情)
  const pushSingleMagnet = async (magnet) => {
    const name = extractMagnetName(magnet)
    const hash = extractMagnetHash(magnet)

    // 1. 若提取出 hash，先检查该任务是否已经在 qBittorrent 下载列表或已完成中
    if (hash) {
      try {
        const existing = await checkTorrentExists(hash)
        if (existing) {
          const stateDesc = existing.state ? `[${existing.state}] ` : ''
          const progressDesc = existing.progress !== undefined ? ` (进度 ${(existing.progress * 100).toFixed(0)}%)` : ''
          return {
            magnet,
            name: existing.name || name,
            hash,
            success: true,
            isDuplicate: true,
            shouldRemove: true,
            reason: `任务已在 qBittorrent 中存在 ${stateDesc}${progressDesc}`,
          }
        }
      } catch (_) {}
    }

    // 2. 发起添加任务请求
    const executeAdd = async () => {
      const params = new URLSearchParams()
      params.append('urls', magnet)
      if (qbSettings.savepath) params.append('savepath', qbSettings.savepath.trim())
      if (qbSettings.category) params.append('category', qbSettings.category.trim())
      params.append('paused', 'false')
      params.append('upLimit', '1024') // 限制上传速度为 1KB/s (1024 字节/秒)，下载速度不设限

      return await qbRequest('/api/v2/torrents/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: params.toString(),
      })
    }

    let res
    try {
      res = await executeAdd()
      if (res.status === 403 || res.status === 401) {
        await qbLogin()
        res = await executeAdd()
      }
    } catch (netErr) {
      return {
        magnet,
        name,
        hash,
        success: false,
        isDuplicate: false,
        shouldRemove: false,
        reason: `无法连接 NAS: ${netErr.message || '网络超时或端口未开放'}`,
      }
    }

    const body = (res.responseText || '').trim()

    // 情况 A：添加成功
    if (res.status === 200 && body === 'Ok.') {
      return {
        magnet,
        name,
        hash,
        success: true,
        isDuplicate: false,
        shouldRemove: true,
        reason: '添加成功',
      }
    }

    // 情况 B：409 冲突 或 返回文本包含 already / duplicate / conflict
    if (res.status === 409 || /already|duplicate|conflict|exists/i.test(body)) {
      return {
        magnet,
        name,
        hash,
        success: true,
        isDuplicate: true,
        shouldRemove: true,
        reason: '任务已在 qBittorrent 中存在 (重复任务)',
      }
    }

    // 情况 C：部分 qB 版本返回 Fails. 但实际已在任务列表中，再次做二次确认
    if (hash) {
      const existingAfter = await checkTorrentExists(hash)
      if (existingAfter) {
        return {
          magnet,
          name: existingAfter.name || name,
          hash,
          success: true,
          isDuplicate: true,
          shouldRemove: true,
          reason: '任务已在 qBittorrent 中存在 (重复任务)',
        }
      }
    }

    // 情况 D：真正失败，分析具体详细原因
    let reason = ''
    if (res.status === 403 || res.status === 401) {
      reason = '鉴权失败：用户名或密码错误，请点击设置核对'
    } else if (res.status === 404) {
      reason = '404 错误：未找到 API 接口，请检查 WebUI 地址及端口'
    } else if (body === 'Fails.') {
      const extra = qbSettings.savepath ? `（指定路径: ${qbSettings.savepath}）` : ''
      reason = `qB 拒绝添加 (Fails)。可能原因：保存路径不存在或无权限${extra}、或 NAS 磁盘已满`
    } else {
      reason = `添加失败 (HTTP ${res.status}): ${body || '未知错误'}`
    }

    return {
      magnet,
      name,
      hash,
      success: false,
      isDuplicate: false,
      shouldRemove: false,
      reason,
    }
  }

  // 批量推送磁力链接（并发处理并返回每条详细结果）
  const pushToQbittorrent = async (magnets) => {
    const list = Array.isArray(magnets) ? magnets : [magnets]
    const cleanList = list.filter((m) => m && typeof m === 'string' && m.trim())
    if (!cleanList.length) throw new Error('磁力链接列表为空')
    return await Promise.all(cleanList.map((m) => pushSingleMagnet(m)))
  }

  const testQbConnection = async () => {
    setQbStatus('正在连接 qBittorrent...', 'pending')
    try {
      let res = await qbRequest('/api/v2/app/webapiVersion')
      if (res.status === 403 || res.status === 401) {
        setQbStatus('正在尝试鉴权登录...', 'pending')
        await qbLogin()
        res = await qbRequest('/api/v2/app/webapiVersion')
      }
      if (res.status === 200) {
        const apiVer = (res.responseText || '').trim()
        let appVer = ''
        try {
          const aRes = await qbRequest('/api/v2/app/version')
          if (aRes.status === 200) appVer = (aRes.responseText || '').trim()
        } catch (_) {}
        const info = appVer ? `qBittorrent ${appVer} (API v${apiVer})` : `API v${apiVer}`
        setQbStatus(`连接成功！${info}`, 'success')
        showCenterToast('已成功连通 NAS qBittorrent', info, 'success')
        return true
      }
      throw new Error(`HTTP ${res.status}: ${res.responseText || '权限不足'}`)
    } catch (err) {
      setQbStatus(`连接失败: ${err.message}`, 'error')
      showCenterToast('连接 qBittorrent 失败', err.message, 'danger', 4000)
      return false
    }
  }

  // ---------- DOM 构建 ----------
  installStyles()

  const root = document.createElement('div')
  root.id = 'easy-copy-root'

  root.innerHTML = `
    <!-- 边缘悬浮胶囊：专用于一键呼出收集页面 -->
    <div class="ec-launcher" data-has-items="false">
      <button class="ec-launcher-button" type="button" aria-label="展开已收集磁力页面" title="已收集磁力 (点击展开/收起页面)">
        ${ICONS.magnet}
        <span class="ec-badge">0</span>
      </button>
    </div>

    <!-- 浮动操作面板 -->
    <section class="ec-panel" aria-label="Easy Copy 面板" aria-hidden="true">
      <header class="ec-panel-header">
        <div class="ec-header-title-wrap">
          <div class="ec-kicker-row">
            <span class="ec-kicker">EASY COPY & QBITTORRENT</span>
            <span class="ec-version-badge">${SCRIPT_VERSION}</span>
          </div>
          <h2 class="ec-panel-title">已收集磁力</h2>
        </div>
        <div class="ec-header-actions">
          <button class="ec-icon-btn-header ec-settings-toggle-btn" type="button" aria-label="qBittorrent 设置" title="qBittorrent NAS 推送设置">
            ${ICONS.settings}
          </button>
          <button class="ec-icon-btn-header ec-pin-btn" type="button" aria-label="固定面板" title="固定面板（不自动关闭）">
            ${ICONS.pin}
          </button>
          <button class="ec-icon-btn-header ec-close-btn" type="button" aria-label="关闭面板" title="关闭面板 (Esc)">
            &times;
          </button>
        </div>
      </header>

      <!-- 视图1：磁力列表与编辑 (仅保留文本、版本历史撤销重做与推送 qB) -->
      <div class="ec-view ec-view-main">
        <textarea class="ec-textarea" spellcheck="false" placeholder="在此自动汇总磁力链接，支持直接编辑或粘贴…"></textarea>
        <div class="ec-btn-row">
          <button class="ec-btn ec-btn-icon ec-undo-btn" type="button" aria-label="撤销版本" title="撤销至上一个版本">${ICONS.undo}</button>
          <button class="ec-btn ec-btn-icon ec-redo-btn" type="button" aria-label="重做版本" title="恢复至下一个版本">${ICONS.redo}</button>
          <button class="ec-btn ec-btn-primary ec-push-all-btn" type="button">
            ${ICONS.rocket}
            <span>推送至 qBittorrent</span>
          </button>
        </div>
      </div>

      <!-- 视图2：qBittorrent NAS 推送配置 -->
      <div class="ec-view ec-view-settings" hidden>
        <div class="ec-form-group">
          <label class="ec-form-label" for="ec-qb-url">qBittorrent WebUI 地址</label>
          <div class="ec-input-wrap">
            <input id="ec-qb-url" class="ec-input" type="text" placeholder="http://192.168.31.155:8085/" spellcheck="false" />
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          <div class="ec-form-group" style="flex:1;">
            <label class="ec-form-label" for="ec-qb-user">用户名</label>
            <input id="ec-qb-user" class="ec-input" type="text" placeholder="可选 (未设置免密)" autocomplete="off" spellcheck="false" />
          </div>
          <div class="ec-form-group" style="flex:1;">
            <label class="ec-form-label" for="ec-qb-pwd">密码</label>
            <div class="ec-input-wrap">
              <input id="ec-qb-pwd" class="ec-input ec-input-pwd" type="password" placeholder="密码" autocomplete="off" />
              <button class="ec-pwd-toggle" type="button" title="显示/隐藏密码">👁</button>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          <div class="ec-form-group" style="flex:1;">
            <label class="ec-form-label" for="ec-qb-path">下载保存路径 (可选)</label>
            <input id="ec-qb-path" class="ec-input" type="text" placeholder="留空使用 qB 默认" spellcheck="false" />
          </div>
          <div class="ec-form-group" style="flex:1;">
            <label class="ec-form-label" for="ec-qb-cat">分类 Category (默认: magnet)</label>
            <input id="ec-qb-cat" class="ec-input" type="text" placeholder="magnet" spellcheck="false" />
          </div>
        </div>
        <label class="ec-checkbox-row">
          <input id="ec-qb-autosend" type="checkbox" />
          <span>复制或点击磁力时自动推送至 NAS</span>
        </label>
        <div style="font-size:11px;color:var(--ec-ink-muted);line-height:1.4;margin:4px 0 2px 2px;">
          ⚡ 推送规则：上传限速 1 KB/s，下载不限速；推送成功后自动从框中删除。
        </div>
        <div class="ec-status ec-qb-status"></div>
        <div class="ec-btn-row" style="margin-top:10px;">
          <button class="ec-btn ec-test-btn" type="button" style="flex:1;">测试连接</button>
          <button class="ec-btn ec-btn-primary ec-back-btn" type="button" style="flex:1;">返回磁力列表</button>
        </div>
      </div>
    </section>
  `

  const launcher = root.querySelector('.ec-launcher')
  const launcherBtn = root.querySelector('.ec-launcher-button')
  const badge = root.querySelector('.ec-badge')
  const panel = root.querySelector('.ec-panel')
  const panelHeader = root.querySelector('.ec-panel-header')
  const panelTitle = root.querySelector('.ec-panel-title')
  const settingsToggleBtn = root.querySelector('.ec-settings-toggle-btn')
  const pinBtn = root.querySelector('.ec-pin-btn')
  const closeBtn = root.querySelector('.ec-close-btn')

  const mainView = root.querySelector('.ec-view-main')
  const settingsView = root.querySelector('.ec-view-settings')

  const textarea = root.querySelector('.ec-textarea')
  const undoBtn = root.querySelector('.ec-undo-btn')
  const redoBtn = root.querySelector('.ec-redo-btn')
  const pushBtn = root.querySelector('.ec-push-all-btn')

  const qbUrlInput = root.querySelector('#ec-qb-url')
  const qbUserInput = root.querySelector('#ec-qb-user')
  const qbPwdInput = root.querySelector('#ec-qb-pwd')
  const qbPwdToggle = root.querySelector('.ec-pwd-toggle')
  const qbPathInput = root.querySelector('#ec-qb-path')
  const qbCatInput = root.querySelector('#ec-qb-cat')
  const qbAutoSendCheckbox = root.querySelector('#ec-qb-autosend')
  const qbStatusNode = root.querySelector('.ec-qb-status')
  const qbTestBtn = root.querySelector('.ec-test-btn')
  const qbBackBtn = root.querySelector('.ec-back-btn')

  // ---------- 停靠吸附与位置规则 (错开 web-shelf，互不遮挡) ----------
  let currentDock = 'right-center'
  let isPinned = false

  const applyDockPosition = (dockName) => {
    currentDock = dockName || 'right-center'
    root.classList.remove('ec-dock-left', 'ec-dock-right', 'ec-dock-top', 'ec-dock-center', 'ec-dock-bottom')
    const parts = currentDock.split('-')
    const side = parts[0] || 'right'
    const vert = parts[1] || 'center'
    root.classList.add('ec-dock-' + side)
    root.classList.add('ec-dock-' + vert)
    root.style.left = ''
    root.style.right = ''
    root.style.top = ''
    root.style.bottom = ''
    root.style.transform = ''
  }

  const getSnapPoints = () => {
    const winW = window.innerWidth || 1280
    const winH = window.innerHeight || 800
    // 错开 web-shelf (80px, 50%, 80px) 约 56px 堆叠，实现零重叠优雅停靠
    const topY = 140
    const centerY = winH / 2 + 56
    const bottomY = Math.max(140, winH - 140)

    return [
      { name: 'left-top', x: 0, y: topY },
      { name: 'left-center', x: 0, y: centerY },
      { name: 'left-bottom', x: 0, y: bottomY },
      { name: 'right-top', x: winW, y: topY },
      { name: 'right-center', x: winW, y: centerY },
      { name: 'right-bottom', x: winW, y: bottomY },
    ]
  }

  const findClosestDock = (x, y) => {
    const points = getSnapPoints()
    let closest = points[0]
    let minDist = Infinity
    for (let i = 0; i < points.length; i++) {
      const p = points[i]
      const dist = Math.hypot(p.x - x, p.y - y)
      if (dist < minDist) {
        minDist = dist
        closest = p
      }
    }
    return closest.name
  }

  // 恢复保存的停靠位置
  let initialDock = loadJSON(DOCK_KEY, null)
  if (!initialDock) {
    const legacy = loadJSON(LEGACY_POS_KEY, null)
    if (legacy && legacy.corner) {
      const cornerMap = {
        tl: 'left-top',
        bl: 'left-bottom',
        tr: 'right-top',
        br: 'right-bottom',
      }
      initialDock = cornerMap[legacy.corner] || 'right-center'
    }
  }
  applyDockPosition(initialDock || 'right-center')

  // ---------- 拖拽交互 (PointerEvents, 阈值防误触) ----------
  let hasDragged = false

  const initDragBehavior = () => {
    let startX = 0
    let startY = 0
    let initialLeft = 0
    let initialTop = 0
    let isPointerDown = false
    let isDragging = false

    const onPointerDown = (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return
      if (e.target.closest('textarea, input')) return
      isPointerDown = true
      isDragging = false
      hasDragged = false
      startX = e.clientX
      startY = e.clientY
      const rect = root.getBoundingClientRect()
      initialLeft = rect.left
      initialTop = rect.top
    }

    launcher.addEventListener('pointerdown', onPointerDown)
    panelHeader.addEventListener('pointerdown', onPointerDown)

    window.addEventListener('pointermove', (e) => {
      if (!isPointerDown) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (!isDragging && Math.hypot(dx, dy) > 5) {
        isDragging = true
        hasDragged = true
        root.classList.add('is-dragging')
      }
      if (isDragging) {
        root.style.left = initialLeft + dx + 'px'
        root.style.top = initialTop + dy + 'px'
        root.style.right = 'auto'
        root.style.bottom = 'auto'
        root.style.transform = 'none'
      }
    })

    window.addEventListener('pointerup', (e) => {
      if (!isPointerDown) return
      isPointerDown = false
      if (isDragging) {
        root.classList.remove('is-dragging')
        const bestDock = findClosestDock(e.clientX, e.clientY)
        applyDockPosition(bestDock)
        saveJSON(DOCK_KEY, bestDock)
        setTimeout(() => {
          hasDragged = false
          isDragging = false
        }, 120)
      }
    })

    window.addEventListener('pointercancel', () => {
      if (isPointerDown) {
        isPointerDown = false
        root.classList.remove('is-dragging')
        applyDockPosition(currentDock)
        hasDragged = false
        isDragging = false
      }
    })
  }
  initDragBehavior()

  // ---------- 面板展开/收起/视图切换 ----------
  const setPanelOpen = (open, showSettings = false) => {
    panel.classList.toggle('is-open', open)
    panel.setAttribute('aria-hidden', String(!open))
    root.classList.toggle('is-open', open)
    if (open) {
      if (showSettings) {
        switchView('settings')
      } else {
        switchView('main')
      }
    }
  }

  const isPanelOpen = () => panel.classList.contains('is-open')

  const switchView = (viewName) => {
    const isSettings = viewName === 'settings'
    mainView.hidden = isSettings
    settingsView.hidden = !isSettings
    panelTitle.textContent = isSettings ? 'qBittorrent 设置' : '已收集磁力'
    settingsToggleBtn.classList.toggle('is-active', isSettings)
    if (isSettings) {
      syncFormFromSettings()
      setTimeout(() => qbUrlInput.focus(), 60)
    } else {
      setTimeout(() => textarea.focus(), 60)
    }
  }

  const syncFormFromSettings = () => {
    qbUrlInput.value = qbSettings.serverUrl || ''
    qbUserInput.value = qbSettings.username || ''
    qbPwdInput.value = qbSettings.password || ''
    qbPathInput.value = qbSettings.savepath || ''
    qbCatInput.value = qbSettings.category || ''
    qbAutoSendCheckbox.checked = !!qbSettings.autoSend
  }

  const saveSettingsFromForm = () => {
    qbSettings.serverUrl = (qbUrlInput.value && qbUrlInput.value.trim()) || DEFAULT_QB_SETTINGS.serverUrl
    qbSettings.username = (qbUserInput.value && qbUserInput.value.trim()) || ''
    qbSettings.password = qbPwdInput.value || ''
    qbSettings.savepath = (qbPathInput.value && qbPathInput.value.trim()) || ''
    qbSettings.category = (qbCatInput.value && qbCatInput.value.trim()) || DEFAULT_QB_SETTINGS.category
    qbSettings.autoSend = !!qbAutoSendCheckbox.checked
    saveJSON(QB_SETTINGS_KEY, qbSettings)
  }

  const setQbStatus = (msg, type) => {
    qbStatusNode.textContent = msg || ''
    qbStatusNode.className = 'ec-status ec-qb-status' + (type ? ' ec-status--' + type : '')
  }

  // 绑定设置表单输入自动保存
  ;[qbUrlInput, qbUserInput, qbPwdInput, qbPathInput, qbCatInput].forEach((el) => {
    if (el) {
      el.addEventListener('input', saveSettingsFromForm)
      el.addEventListener('change', saveSettingsFromForm)
    }
  })
  qbAutoSendCheckbox.addEventListener('change', saveSettingsFromForm)

  qbPwdToggle.addEventListener('click', (e) => {
    e.stopPropagation()
    qbPwdInput.type = qbPwdInput.type === 'password' ? 'text' : 'password'
  })

  settingsToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    switchView(mainView.hidden ? 'main' : 'settings')
  })

  qbBackBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    saveSettingsFromForm()
    switchView('main')
  })

  qbTestBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    saveSettingsFromForm()
    testQbConnection()
  })

  // 胶囊主按钮点击：专用于切换收集页面
  launcherBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    if (hasDragged) return
    setPanelOpen(!isPanelOpen())
  })

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    setPanelOpen(false)
  })

  pinBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    isPinned = !isPinned
    pinBtn.classList.toggle('is-pinned', isPinned)
    pinBtn.title = isPinned ? '已固定面板（点击取消固定）' : '固定面板（不自动关闭）'
  })

  document.addEventListener(
    'click',
    (e) => {
      if (!isPanelOpen() || isPinned) return
      const target = e.target
      if (panel.contains(target) || launcher.contains(target)) return
      setPanelOpen(false)
    },
    true,
  )

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isPanelOpen()) {
      setPanelOpen(false)
    }
  })

  // ---------- 数据 & 历史版本 ----------
  let items = []
  const history = []
  const future = []
  const HISTORY_LIMIT = 200
  let lastCaptured = ''
  let lastCapturedAt = 0
  let suppressClipboardCapture = false
  let applyingRemote = false

  const snapshot = () => items.slice()
  const aggregateText = () => items.join('\n')

  const pushHistory = () => {
    history.push(snapshot())
    if (history.length > HISTORY_LIMIT) history.shift()
    future.length = 0
    updateActionButtons()
  }

  const setDisabled = (btn, disabled) => {
    btn.disabled = disabled
  }

  const updateActionButtons = () => {
    setDisabled(undoBtn, history.length === 0)
    setDisabled(redoBtn, future.length === 0)
    setDisabled(pushBtn, items.length === 0)
  }

  const updateBadge = () => {
    const count = items.length
    badge.textContent = String(count)
    launcher.dataset.hasItems = count > 0 ? 'true' : 'false'
    launcherBtn.title = count > 0
      ? `已收集磁力 (${count} 条，点击展开页面)`
      : `已收集磁力 (当前暂无内容)`
  }

  const renderAll = () => {
    applyingRemote = true
    const sel = [textarea.selectionStart, textarea.selectionEnd]
    textarea.value = aggregateText()
    try {
      textarea.setSelectionRange(sel[0], sel[1])
    } catch (_) {}
    applyingRemote = false
    updateBadge()
    updateActionButtons()
  }

  // ---------- 跨页面同步 ----------
  const syncOut = () => {
    saveJSON(STORE_KEY, { items, originId: INSTANCE_ID, ts: Date.now() })
  }

  const applyRemote = (payload) => {
    if (!payload || !Array.isArray(payload.items)) return
    items = payload.items.slice()
    renderAll()
  }

  if (hasGM) {
    const payload = loadJSON(STORE_KEY, null)
    if (payload && Array.isArray(payload.items)) {
      items = payload.items.slice()
      renderAll()
    }
    try {
      GM_addValueChangeListener(STORE_KEY, (_name, _oldVal, newVal, remote) => {
        if (!remote) return
        try {
          const p = JSON.parse(newVal)
          if (p && p.originId !== INSTANCE_ID) applyRemote(p)
        } catch (_) {}
      })
    } catch (_) {}
  } else {
    window.addEventListener('storage', (e) => {
      if (e.key === STORE_KEY && e.newValue) {
        try {
          const p = JSON.parse(e.newValue)
          if (p && p.originId !== INSTANCE_ID) applyRemote(p)
        } catch (_) {}
      }
    })
  }

  // ---------- 用户手动在文本框中编辑 (严格校验磁力) ----------
  let editTimer = null
  let beforeEditSnapshot = null
  textarea.addEventListener('input', () => {
    if (applyingRemote) return
    if (beforeEditSnapshot === null) beforeEditSnapshot = items.slice()
    items = textarea.value.split('\n')
    if (editTimer) clearTimeout(editTimer)
    editTimer = setTimeout(() => {
      commitEdit()
    }, 600)
  })

  textarea.addEventListener('blur', () => {
    if (editTimer) {
      clearTimeout(editTimer)
      editTimer = null
    }
    if (beforeEditSnapshot !== null) commitEdit()
  })

  const commitEdit = () => {
    const seen = new Set()
    const deduped = []
    for (let line of items) {
      line = line.trim()
      const found = extractMagnets(line)
      for (const m of found) {
        if (!seen.has(m)) {
          seen.add(m)
          deduped.push(m)
        }
      }
    }
    items = deduped

    if (beforeEditSnapshot !== null) {
      history.push(beforeEditSnapshot)
      if (history.length > HISTORY_LIMIT) history.shift()
      future.length = 0
      beforeEditSnapshot = null
    }
    renderAll()
    syncOut()
  }

  // ---------- 推送磁力至 NAS qBittorrent ----------
  const flashSuccess = () => {
    launcher.dataset.state = 'success'
    setTimeout(() => {
      if (launcher.dataset.state === 'success') {
        delete launcher.dataset.state
      }
    }, 1200)
  }

  const triggerPushAll = async () => {
    if (qbBusy) return
    if (beforeEditSnapshot !== null) {
      if (editTimer) clearTimeout(editTimer)
      editTimer = null
      commitEdit()
    }
    if (!items.length) {
      showCenterToast('当前暂无收集的磁力链接', '请先在网页上复制或点击磁力链接', 'warning', 1800)
      return
    }

    qbBusy = true
    showCenterToast(
      '正在推送磁力至 qBittorrent...',
      `正在处理 ${items.length} 条磁力链接 (上传限速 1KB/s)...`,
      'info',
      1200,
    )

    try {
      const magnetsToPush = [...items]
      const results = await pushToQbittorrent(magnetsToPush)

      // 提取成功或重复（需从输入框删除）的磁力
      const toRemoveHashes = new Set(
        results.filter((r) => r.shouldRemove && r.hash).map((r) => r.hash),
      )
      const toRemoveMagnets = new Set(
        results.filter((r) => r.shouldRemove).map((r) => r.magnet),
      )

      // 只要有任何成功或重复项，立即从列表中删除
      if (toRemoveMagnets.size > 0 || toRemoveHashes.size > 0) {
        pushHistory()
        items = items.filter((m) => {
          if (toRemoveMagnets.has(m)) return false
          const h = extractMagnetHash(m)
          if (h && toRemoveHashes.has(h)) return false
          return true
        })
        renderAll()
        syncOut()
      }

      const added = results.filter((r) => r.success && !r.isDuplicate)
      const dups = results.filter((r) => r.isDuplicate)
      const failed = results.filter((r) => !r.success)

      if (failed.length === 0) {
        flashSuccess()
        if (dups.length === results.length) {
          showCenterToast(
            '磁力任务已在 qBittorrent 中存在',
            `检测到 ${dups.length} 条重复任务，已全部从框中删除 ✓`,
            'info',
            3200,
          )
        } else if (dups.length > 0) {
          showCenterToast(
            '推送完成！已添加至 NAS qBittorrent',
            `新增 ${added.length} 条，重复 ${dups.length} 条（均已从框中删除）✓`,
            'success',
            3200,
          )
        } else {
          showCenterToast(
            '推送成功！已添加至 NAS qBittorrent',
            `共 ${added.length} 条任务已开始下载（已从框中删除）✓`,
            'success',
            2600,
          )
        }

        const origHtml = pushBtn.innerHTML
        pushBtn.innerHTML = `${ICONS.check}<span>已推送完成 ✓</span>`
        setTimeout(() => {
          pushBtn.innerHTML = origHtml
        }, 1400)
      } else {
        // 存在推送失败的任务，详细说明失败原因
        const failLines = failed
          .map((f) => `${f.name}: ${f.reason}`)
          .slice(0, 3)
          .join('\n')

        const summaryParts = []
        if (added.length) summaryParts.push(`成功 ${added.length} 条 (已删)`)
        if (dups.length) summaryParts.push(`重复 ${dups.length} 条 (已删)`)
        summaryParts.push(`失败 ${failed.length} 条 (已保留)`)

        showCenterToast(
          `推送结果 (${summaryParts.join('，')})`,
          failLines,
          'danger',
          5500,
        )
      }
    } catch (err) {
      showCenterToast('推送至 qBittorrent 发生异常', err.message || '未知异常', 'danger', 4500)
    } finally {
      qbBusy = false
    }
  }

  // ---------- 磁力追加并弹出正中间 Toast ----------
  const appendMagnetsFromText = async (rawText) => {
    const magnets = extractMagnets(rawText)
    if (!magnets || !magnets.length) {
      return false
    }

    const now = Date.now()
    const magnetKey = magnets.join('|')
    if (magnetKey === lastCaptured && now - lastCapturedAt < 800) return false
    lastCaptured = magnetKey
    lastCapturedAt = now

    const newMagnets = magnets.filter((m) => !items.includes(m))

    if (!newMagnets.length) {
      showCenterToast('该磁力链接已在收集列表中', `当前已汇总 ${items.length} 条磁力`, 'warning', 1800)
      return false
    }

    pushHistory()
    items.push(...newMagnets)
    renderAll()
    textarea.scrollTop = textarea.scrollHeight
    syncOut()

    flashSuccess()
    const firstName = extractMagnetName(newMagnets[0])
    const subtitle = newMagnets.length > 1
      ? `${firstName} 等 ${newMagnets.length} 个新磁力 · 当前共 ${items.length} 条`
      : `${firstName} · 当前共 ${items.length} 条`

    showCenterToast('收集磁力链接成功！', subtitle, 'success', 2200)

    // 若开启自动推送至 NAS
    if (qbSettings.autoSend) {
      try {
        const results = await pushToQbittorrent(newMagnets)

        const toRemoveHashes = new Set(
          results.filter((r) => r.shouldRemove && r.hash).map((r) => r.hash),
        )
        const toRemoveMagnets = new Set(
          results.filter((r) => r.shouldRemove).map((r) => r.magnet),
        )

        if (toRemoveMagnets.size > 0 || toRemoveHashes.size > 0) {
          pushHistory()
          items = items.filter((m) => {
            if (toRemoveMagnets.has(m)) return false
            const h = extractMagnetHash(m)
            if (h && toRemoveHashes.has(h)) return false
            return true
          })
          renderAll()
          syncOut()
        }

        const added = results.filter((r) => r.success && !r.isDuplicate)
        const dups = results.filter((r) => r.isDuplicate)
        const failed = results.filter((r) => !r.success)

        if (failed.length === 0) {
          if (dups.length === results.length) {
            showCenterToast(
              '任务已在 qBittorrent 中存在',
              `${results[0].name}（重复任务，已从列表删除）`,
              'info',
              2400,
            )
          } else {
            showCenterToast(
              '已自动推送至 NAS 下载！',
              `${results[0].name} 已发送（上传限速 1KB/s，已从列表删除）`,
              'success',
              2400,
            )
          }
        } else {
          showCenterToast(
            '自动推送至 qBittorrent 失败',
            failed.map((f) => `${f.name}: ${f.reason}`).join('\n'),
            'danger',
            4500,
          )
        }
      } catch (err) {
        showCenterToast('自动推送至 qBittorrent 失败', err.message, 'danger', 3500)
      }
    }

    return true
  }

  // ---------- 判定是否来自自身面板 ----------
  const isFromOurPanel = () => {
    const a = document.activeElement
    if (a && root.contains(a)) return true
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      const node = sel.getRangeAt(0).commonAncestorContainer
      if (node && root.contains(node.nodeType === 1 ? node : node.parentNode)) return true
    }
    return false
  }

  // ---------- 监听 1：复制内容捕获 (仅限磁力链接) ----------
  document.addEventListener(
    'copy',
    (e) => {
      if (suppressClipboardCapture) return
      if (isFromOurPanel()) return
      let text = ''
      try {
        text = e.clipboardData && e.clipboardData.getData('text/plain')
      } catch (_) {}
      if (!text) {
        const sel = window.getSelection()
        text = sel ? sel.toString() : ''
      }
      if (text) {
        appendMagnetsFromText(text)
      }
    },
    true,
  )

  // ---------- 监听 2：拦截点击磁力链接跳转 ----------
  const handleMagnetClick = (e) => {
    if (root && root.contains(e.target)) return

    let magnetTarget = ''
    const link = e.target.closest('a[href]')
    if (link) {
      const href = (link.getAttribute('href') || link.href || '').trim()
      if (/^magnet:\?/i.test(href) || href.includes('magnet%3A%3F') || href.includes('magnet%3a%3f')) {
        magnetTarget = href
      }
    }

    if (!magnetTarget) {
      const el = e.target.closest('[data-magnet], [data-clipboard-text*="magnet:?" i]')
      if (el) {
        const val = el.getAttribute('data-magnet') || el.getAttribute('data-clipboard-text') || ''
        if (/^magnet:\?/i.test(val.trim())) {
          magnetTarget = val.trim()
        }
      }
    }

    if (magnetTarget) {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      appendMagnetsFromText(magnetTarget)
    }
  }

  document.addEventListener('click', handleMagnetClick, true)
  document.addEventListener('auxclick', handleMagnetClick, true)

  // ---------- 按钮事件监听 ----------
  undoBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    if (!history.length) return
    future.push(snapshot())
    items = history.pop()
    renderAll()
    syncOut()
    showCenterToast('已撤销至上一版本', `当前剩余 ${items.length} 条磁力`, 'info', 1500)
  })

  redoBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    if (!future.length) return
    history.push(snapshot())
    items = future.pop()
    renderAll()
    syncOut()
    showCenterToast('已恢复至下一版本', `当前共 ${items.length} 条磁力`, 'info', 1500)
  })

  pushBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    triggerPushAll()
  })

  // ---------- 挂载至文档 ----------
  const mount = () => {
    if (document.body) {
      document.body.appendChild(root)
    } else {
      window.addEventListener('DOMContentLoaded', () => document.body.appendChild(root))
    }
  }
  mount()

  // ---------- 注册菜单命令 ----------
  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('展开/收起已收集磁力页面', () => setPanelOpen(!isPanelOpen()))
    GM_registerMenuCommand('推送磁力至 NAS qBittorrent', triggerPushAll)
    GM_registerMenuCommand('打开 qBittorrent NAS 设置', () => setPanelOpen(true, true))
  }

  updateBadge()
  updateActionButtons()
})()
