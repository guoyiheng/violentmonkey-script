// ==UserScript==
// @name         Jellyfin 外部播放
// @namespace    https://github.com/guoyiheng/violentmonkey-script
// @version      0.1.1
// @description  在 Jellyfin 网页端一键调用本地 PotPlayer 播放视频
// @author       yiheng
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImJnUG90IiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzkzMzNlYSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMwMjg0YzciLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8ZmlsdGVyIGlkPSJiYWRnZVNoYWRvdyIgeD0iLTIwJSIgeT0iLTIwJSIgd2lkdGg9IjE0MCUiIGhlaWdodD0iMTQwJSI+CiAgICAgIDxmZURyb3BTaGFkb3cgZHg9IjAiIGR5PSIyIiBzdGREZXZpYXRpb249IjMiIGZsb29kLW9wYWNpdHk9IjAuMyIvPgogICAgPC9maWx0ZXI+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiByeD0iMjgiIGZpbGw9InVybCgjYmdQb3QpIi8+CiAgPHBvbHlnb24gcG9pbnRzPSI0NiwzNCA5NCw2NCA0Niw5NCIgZmlsbD0iI2ZiYmYyNCIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KICAKICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSg4MiwgODIpIj4KICAgIDxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjIxIiBmaWxsPSIjZmZmZmZmIiBmaWx0ZXI9InVybCgjYmFkZ2VTaGFkb3cpIi8+CiAgICA8Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxNyIgZmlsbD0iIzkzMzNlYSIvPgogICAgPHRleHQgeD0iMjAiIHk9IjI3IiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCAiU2Vnb2UgVUkiLCBSb2JvdG8sIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIGZvbnQtd2VpZ2h0PSI5MDAiIGZpbGw9IiNmZmZmZmYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkU8L3RleHQ+CiAgPC9nPgo8L3N2Zz4=
// @match        http://localhost:8096/*
// @match        http://192.168.31.155:8096/*
// @match        https://xxn.synology.me:7788/*
// @match        https://jf.yiheng.run/*
// @updateURL    https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/potplayer.user.js
// @downloadURL  https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/potplayer.user.js
// ==/UserScript==
;(function () {
  'use strict'
  let openPotplayer = async (itemid) => {
    let userid = (await ApiClient.getCurrentUser()).Id
    ApiClient.getItem(userid, itemid).then((r) => {
      if (r.Path) {
        let path = r.Path.replace(/\\/g, '/')
        if (path.includes('volume1')) {
          path = path.replace('/volume1/HDD1', 'X:')
        }
        if (path.includes('volume2')) {
          path = path.replace('/volume2/HDD2', 'Y:')
        }
        if (path.includes('volume3')) {
          path = path.replace('/volume3/HDD3', 'Z:')
        }
        console.log('=== Jellyfin path ===', path)

        // Edge/Chrome sometimes strips the colon from custom protocol URLs

        // e.g. potplayer://Z:/... becomes potplayer://Z/...

        // Encoding : as %3A prevents this

        path = path.replace(':', '%3A')

        console.log('=== PotPlayer URL ===', 'potplayer://' + path)
        window.open('potplayer://' + path)
      } else {
        ApiClient.getItems(userid, itemid).then((r) => openPotplayer(r.Items[0].Id))
      }
    })
  }

  let bindEvent = async () => {
    let buttons = []
    let retry = 6 + 1
    while (buttons.length == 0 && retry > 0) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      buttons = document.querySelectorAll('[data-mode=play],[data-mode=resume],[data-action=resume]')
      retry -= 1
    }
    for (let button of buttons) {
      let nextElementSibling = button.nextElementSibling
      let parentElement = button.parentElement
      let outerHTML = button.outerHTML
      button.parentElement.removeChild(button)
      let newButton = document.createElement('button')
      if (nextElementSibling) {
        parentElement.insertBefore(newButton, nextElementSibling)
      } else {
        parentElement.append(newButton)
      }
      newButton.outerHTML = outerHTML
    }
    buttons = document.querySelectorAll('[data-mode=play],[data-mode=resume]')
    for (let button of buttons) {
      button.removeAttribute('data-mode')
      button.addEventListener('click', (e) => {
        e.stopPropagation()
        let itemid = /id=(.*?)&serverId/.exec(window.location.hash)[1]
        openPotplayer(itemid)
      })
    }
    buttons = document.querySelectorAll('[data-action=resume]')
    for (let button of buttons) {
      button.removeAttribute('data-action')
      button.addEventListener('click', (e) => {
        e.stopPropagation()
        let item = e.target
        while (!item.hasAttribute('data-id')) {
          item = item.parentNode
        }
        let itemid = item.getAttribute('data-id')
        openPotplayer(itemid)
      })
    }
  }

  let lazyload = () => {
    let items = document.querySelectorAll('[data-src].lazy')
    let y = document.scrollingElement.scrollTop
    let intersectinglist = []
    for (let item of items) {
      let windowHeight = document.body.offsetHeight
      let itemTop = item.getBoundingClientRect().top
      let itemHeight = item.offsetHeight
      if (itemTop + itemHeight >= 0 && itemTop <= windowHeight) {
        intersectinglist.push(item)
      }
    }
    for (let item of intersectinglist) {
      item.style.setProperty('background-image', `url("${item.getAttribute('data-src')}")`)
      item.classList.remove('lazy')
      item.removeAttribute('data-src')
    }
  }

  window.addEventListener('scroll', lazyload)

  window.addEventListener('viewshow', async () => {
    bindEvent()
    window.addEventListener('hashchange', bindEvent)
  })
})()
