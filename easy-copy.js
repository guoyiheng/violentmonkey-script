// ==UserScript==
// @name         Easy Copy
// @namespace    http://tampermonkey.net/
// @version      1.4.0
// @description  右上角可编辑文本框，自动汇总复制内容、去重、跨标签页同步、记住位置
// @author       you
// @match        *://javdb.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @run-at       document-end
// ==/UserScript==

;(function () {
  'use strict'

  if (window.top !== window.self) return

  const STORE_KEY = 'easy_copy_items_v1'
  const POS_KEY = 'easy_copy_pos_v1'
  const INSTANCE_ID = Math.random().toString(36).slice(2) + Date.now().toString(36)
  const hasGM = typeof GM_setValue === 'function' && typeof GM_getValue === 'function'

  const loadJSON = (key, fallback) => {
    if (!hasGM) return fallback
    try {
      const raw = GM_getValue(key, '')
      return raw ? JSON.parse(raw) : fallback
    } catch (_) {
      return fallback
    }
  }
  const saveJSON = (key, val) => {
    if (!hasGM) return
    try {
      GM_setValue(key, JSON.stringify(val))
    } catch (_) {}
  }

  // ---------- 容器 ----------
  const container = document.createElement('div')
  container.id = '__easy_copy_panel__'
  container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 2147483647;
        width: 300px;
        background: rgba(255, 255, 255, 0.78);
        backdrop-filter: blur(8px) saturate(120%);
        -webkit-backdrop-filter: blur(8px) saturate(120%);
        border: 1px solid rgba(208, 215, 222, 0.55);
        border-radius: 10px;
        padding: 8px;
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.10);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        font-size: 13px;
        color: #24292f;
        opacity: 0.45;
        transition: opacity 0.18s ease;
    `

  // 恢复保存的位置
  const savedPos = loadJSON(POS_KEY, null)
  if (savedPos && typeof savedPos.corner === 'string') {
    const gap = 20
    container.style.right = 'auto'
    container.style.bottom = 'auto'
    if (savedPos.corner === 'tl') {
      container.style.left = gap + 'px'
      container.style.top = gap + 'px'
    } else if (savedPos.corner === 'tr') {
      container.style.left = 'auto'
      container.style.top = gap + 'px'
      container.style.right = gap + 'px'
    } else if (savedPos.corner === 'bl') {
      container.style.left = gap + 'px'
      container.style.top = 'auto'
      container.style.bottom = gap + 'px'
    } else if (savedPos.corner === 'br') {
      container.style.left = 'auto'
      container.style.top = 'auto'
      container.style.right = gap + 'px'
      container.style.bottom = gap + 'px'
    }
  } else if (savedPos && typeof savedPos.left === 'number' && typeof savedPos.top === 'number') {
    container.style.left = savedPos.left + 'px'
    container.style.top = savedPos.top + 'px'
    container.style.right = 'auto'
  }

  const setActive = (active) => {
    container.style.opacity = active ? '1' : '0.45'
  }
  container.addEventListener('mouseenter', () => setActive(true))
  container.addEventListener('mouseleave', () => {
    if (!container.contains(document.activeElement)) setActive(false)
  })
  container.addEventListener('focusin', () => setActive(true))
  container.addEventListener('focusout', () => {
    if (!container.matches(':hover')) setActive(false)
  })

  // ---------- 头部 ----------
  const header = document.createElement('div')
  header.style.cssText = `
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 4px; cursor: move; user-select: none;
    `
  header.innerHTML = `<span style="font-weight:600;">Easy Copy</span>
        <span id="__ec_toggle__" style="cursor:pointer;color:#57606a;padding:0 6px;font-size:16px;line-height:1;">—</span>`

  // ---------- 文本框 ----------
  const textarea = document.createElement('textarea')
  textarea.spellcheck = false
  textarea.placeholder = '在网页上复制的内容会自动出现在这里…'
  const TEXTAREA_DISPLAY = 'block'
  textarea.style.cssText = `
        display: ${TEXTAREA_DISPLAY};
        width: 100%;
        height: 240px;
        box-sizing: border-box;
        padding: 7px 8px;
        border: 1px solid rgba(208, 215, 222, 0.7);
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.85);
        font-size: 12px;
        line-height: 1.5;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        color: #24292f;
        resize: vertical;
        outline: none;
        white-space: pre-wrap;
        word-break: break-word;
    `
  textarea.addEventListener('focus', () => {
    textarea.style.borderColor = 'rgba(9, 105, 218, 0.6)'
    textarea.style.background = '#ffffff'
  })
  textarea.addEventListener('blur', () => {
    textarea.style.borderColor = 'rgba(208, 215, 222, 0.7)'
    textarea.style.background = 'rgba(255, 255, 255, 0.85)'
  })

  // ---------- 按钮行 ----------
  const btnRow = document.createElement('div')
  const BTN_ROW_DISPLAY = 'flex'
  btnRow.style.cssText = `display: ${BTN_ROW_DISPLAY}; gap: 4px; margin-top: 6px;`

  const ICONS = {
    selectAll: `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.2" y="2.2" width="11.6" height="11.6" rx="1.6" stroke-dasharray="2 1.6"/><path d="M5 8.2l2 2 4-4.2"/></svg>`,
    copy: `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5.2" y="5.2" width="8.6" height="8.6" rx="1.4"/><path d="M10.8 5.2V3.6A1.4 1.4 0 0 0 9.4 2.2H3.6A1.4 1.4 0 0 0 2.2 3.6v5.8A1.4 1.4 0 0 0 3.6 10.8h1.6"/></svg>`,
    undo: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.2 6.4h6.4a3.6 3.6 0 0 1 0 7.2H6"/><path d="M5.8 3.6 3 6.4l2.8 2.8"/></svg>`,
    redo: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.8 6.4H6.4a3.6 3.6 0 0 0 0 7.2H10"/><path d="M10.2 3.6 13 6.4l-2.8 2.8"/></svg>`,
  }

  const makeBtn = (label, iconSvg) => {
    const b = document.createElement('button')
    if (iconSvg) {
      b.innerHTML = `<span style="display:inline-flex;align-items:center;justify-content:center;gap:4px;">${iconSvg}<span>${label}</span></span>`
    } else {
      b.textContent = label
    }
    b.style.cssText = `
            flex: 1;
            padding: 5px 0;
            border: 1px solid rgba(208, 215, 222, 0.9);
            border-radius: 6px;
            background: rgba(246, 248, 250, 0.85);
            cursor: pointer;
            font-size: 12px;
            color: #24292f;
            transition: background 0.15s, opacity 0.15s;
            white-space: nowrap;
        `
    b.onmouseenter = () => {
      if (!b.disabled) b.style.background = 'rgba(234, 238, 242, 0.95)'
    }
    b.onmouseleave = () => {
      b.style.background = 'rgba(246, 248, 250, 0.85)'
    }
    return b
  }

  const setBtnLabel = (btn, label, iconSvg) => {
    if (iconSvg) {
      btn.innerHTML = `<span style="display:inline-flex;align-items:center;justify-content:center;gap:4px;">${iconSvg}<span>${label}</span></span>`
    } else {
      btn.textContent = label
    }
  }

  const makeIconBtn = (iconSvg, title) => {
    const b = document.createElement('button')
    b.innerHTML = iconSvg
    b.title = title
    b.setAttribute('aria-label', title)
    b.style.cssText = `
            flex: 0 0 auto;
            width: 28px;
            padding: 5px 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border: 1px solid rgba(208, 215, 222, 0.9);
            border-radius: 6px;
            background: rgba(246, 248, 250, 0.85);
            cursor: pointer;
            color: #24292f;
            transition: background 0.15s, opacity 0.15s;
        `
    b.onmouseenter = () => {
      if (!b.disabled) b.style.background = 'rgba(234, 238, 242, 0.95)'
    }
    b.onmouseleave = () => {
      b.style.background = 'rgba(246, 248, 250, 0.85)'
    }
    return b
  }

  const undoBtn = makeIconBtn(ICONS.undo, '撤销')
  const redoBtn = makeIconBtn(ICONS.redo, '重做')
  const clearBtn = makeBtn('清空')
  const selectAllBtn = makeBtn('全选', ICONS.selectAll)
  const copyBtn = makeBtn('复制', ICONS.copy)

  ;[undoBtn, redoBtn, clearBtn, selectAllBtn, copyBtn].forEach((b) => btnRow.appendChild(b))

  container.appendChild(header)
  container.appendChild(textarea)
  container.appendChild(btnRow)

  const mount = () => {
    if (document.body) document.body.appendChild(container)
    else window.addEventListener('DOMContentLoaded', () => document.body.appendChild(container))
  }
  mount()

  // ---------- 折叠 ----------
  const toggle = header.querySelector('#__ec_toggle__')
  let collapsed = false
  toggle.addEventListener('click', (e) => {
    e.stopPropagation()
    collapsed = !collapsed
    textarea.style.display = collapsed ? 'none' : TEXTAREA_DISPLAY
    btnRow.style.display = collapsed ? 'none' : BTN_ROW_DISPLAY
    toggle.textContent = collapsed ? '+' : '—'
  })

  // ---------- 拖拽（结束后持久化位置） ----------
  let dragging = false,
    offX = 0,
    offY = 0
  header.addEventListener('mousedown', (e) => {
    if (e.target === toggle) return
    dragging = true
    const rect = container.getBoundingClientRect()
    offX = e.clientX - rect.left
    offY = e.clientY - rect.top
    e.preventDefault()
  })
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return
    container.style.left = e.clientX - offX + 'px'
    container.style.top = e.clientY - offY + 'px'
    container.style.right = 'auto'
  })
  document.addEventListener('mouseup', () => {
    if (!dragging) return
    dragging = false
    const rect = container.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const corners = [
      { corner: 'tl', x: 0, y: 0 },
      { corner: 'tr', x: vw, y: 0 },
      { corner: 'bl', x: 0, y: vh },
      { corner: 'br', x: vw, y: vh },
    ]
    let nearest = corners[0]
    let bestDistance = Infinity
    for (const candidate of corners) {
      const dx = centerX - candidate.x
      const dy = centerY - candidate.y
      const distance = dx * dx + dy * dy
      if (distance < bestDistance) {
        bestDistance = distance
        nearest = candidate
      }
    }
    const gap = 20
    container.style.left = 'auto'
    container.style.top = 'auto'
    container.style.right = 'auto'
    container.style.bottom = 'auto'
    if (nearest.corner === 'tl') {
      container.style.left = gap + 'px'
      container.style.top = gap + 'px'
    } else if (nearest.corner === 'tr') {
      container.style.right = gap + 'px'
      container.style.top = gap + 'px'
    } else if (nearest.corner === 'bl') {
      container.style.left = gap + 'px'
      container.style.bottom = gap + 'px'
    } else {
      container.style.right = gap + 'px'
      container.style.bottom = gap + 'px'
    }
    saveJSON(POS_KEY, { corner: nearest.corner })
  })

  // ---------- 数据 & 历史 ----------
  // items 始终是按行存储的去重数组；textarea 显示为 items.join('\n')
  let items = []
  const history = []
  const future = []
  const HISTORY_LIMIT = 200
  let lastCaptured = ''
  let lastCapturedAt = 0
  let suppressClipboardCapture = false
  let applyingRemote = false // 远端同步时不触发本地 input 写回

  const normalizeCapturedText = (text) => {
    const raw = String(text || '').trim()
    if (!raw) return ''
    const magnetMatch = raw.match(/magnet:\?[^\s"'<>]+/i)
    if (magnetMatch) return magnetMatch[0].replace(/[),.，。；;]+$/g, '')
    return raw
  }

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
    btn.style.opacity = disabled ? '0.4' : '1'
    btn.style.cursor = disabled ? 'not-allowed' : 'pointer'
  }

  const updateActionButtons = () => {
    setDisabled(undoBtn, history.length === 0)
    setDisabled(redoBtn, future.length === 0)
  }

  const renderAll = () => {
    applyingRemote = true
    const sel = [textarea.selectionStart, textarea.selectionEnd]
    textarea.value = aggregateText()
    // 尽量保留光标位置
    try {
      textarea.setSelectionRange(sel[0], sel[1])
    } catch (_) {}
    applyingRemote = false
    updateActionButtons()
  }

  const writeToClipboard = async (text) => {
    if (!text) return false
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text)
      else throw new Error('no clipboard api')
      return true
    } catch (_) {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;'
        document.body.appendChild(ta)
        ta.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(ta)
        return ok
      } catch (_) {
        return false
      }
    }
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
  }

  // ---------- 用户在文本框中编辑 ----------
  let editTimer = null
  let beforeEditSnapshot = null
  textarea.addEventListener('input', () => {
    if (applyingRemote) return
    if (beforeEditSnapshot === null) beforeEditSnapshot = items.slice()
    // 不在 input 期间去重，避免吞掉用户正在键入的字符；只按行拆分
    items = textarea.value.split('\n')
    if (editTimer) clearTimeout(editTimer)
    editTimer = setTimeout(() => {
      // 失焦/停顿之后再做一次去重 + 写回 + 同步
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
    // 去重（保留首次出现），去掉首尾空行但保留中间的空行
    const seen = new Set()
    const deduped = []
    for (const line of items) {
      if (seen.has(line)) continue
      seen.add(line)
      deduped.push(line)
    }
    // 去尾部多余空行
    while (deduped.length && deduped[deduped.length - 1] === '') deduped.pop()
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

  // ---------- 复制内容收集 ----------
  const isFromOurPanel = () => {
    const a = document.activeElement
    if (a && container.contains(a)) return true
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      const node = sel.getRangeAt(0).commonAncestorContainer
      if (node && container.contains(node.nodeType === 1 ? node : node.parentNode)) return true
    }
    return false
  }

  const appendContent = (text) => {
    text = normalizeCapturedText(text)
    if (!text || text.length < 15) return
    const now = Date.now()
    if (text === lastCaptured && now - lastCapturedAt < 1000) return
    lastCaptured = text
    lastCapturedAt = now
    // 去重：已存在则不再追加
    if (items.includes(text)) return
    pushHistory()
    items.push(text)
    renderAll()
    textarea.scrollTop = textarea.scrollHeight
    syncOut()
  }

  // copy 事件
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
      if (text) appendContent(text)
    },
    true,
  )

  // ---------- 按钮事件 ----------
  undoBtn.addEventListener('click', () => {
    if (!history.length) return
    future.push(snapshot())
    items = history.pop()
    renderAll()
    syncOut()
  })

  redoBtn.addEventListener('click', () => {
    if (!future.length) return
    history.push(snapshot())
    items = future.pop()
    renderAll()
    syncOut()
  })

  selectAllBtn.addEventListener('click', () => {
    textarea.focus()
    textarea.select()
  })

  copyBtn.addEventListener('click', async () => {
    if (!items.length) return
    const ok = await writeToClipboard(aggregateText())
    const oldHTML = copyBtn.innerHTML
    setBtnLabel(copyBtn, ok ? '已复制 ✓' : '复制失败')
    setTimeout(() => {
      copyBtn.innerHTML = oldHTML
    }, 1000)
  })

  clearBtn.addEventListener('click', () => {
    if (!items.length) return
    pushHistory()
    items = []
    renderAll()
    lastCaptured = ''
    syncOut()
  })

  updateActionButtons()
})()
