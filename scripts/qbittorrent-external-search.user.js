// ==UserScript==
// @name         qBittorrent 外部搜索按钮
// @namespace    https://github.com/yiheng/violentmonkey-script
// @version      1.0.3
// @description  在未完成的 qBittorrent 任务行中添加 JavDB 和无钱搜搜索按钮
// @match        http://192.168.31.155:8085/*
// @match        https://wuqianso.org/*
// @icon         https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/qbittorrent-search-icon.svg
// @downloadURL  https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/qbittorrent-external-search.user.js
// @updateURL    https://raw.githubusercontent.com/guoyiheng/violentmonkey-script/main/scripts/qbittorrent-external-search.user.js
// @grant        none
// @inject-into  page
// @run-at       document-end
// @noframes
// ==/UserScript==

(function () {
    "use strict";

    // 无钱搜需要先通过首页建立 Cloudflare Cookie，再提交首页自带的搜索表单。
    // 使用 hash 传递关键词，不会把关键词提前作为 /search 的直达请求发送出去。
    if (location.hostname === "wuqianso.org") {
        const marker = "#qb-search=";
        if (!location.hash.startsWith(marker))
            return;

        let keyword = "";
        try {
            keyword = decodeURIComponent(location.hash.slice(marker.length));
        }
        catch (_) {
            return;
        }
        if (!keyword)
            return;

        const submitSearch = () => {
            const form = document.querySelector("#search-form");
            const input = form?.querySelector('input[name="keyword"]');
            if (!form || !input)
                return false;

            input.value = keyword;
            if (typeof form.requestSubmit === "function")
                form.requestSubmit();
            else
                form.submit();
            return true;
        };

        if (submitSearch())
            return;

        const timer = window.setInterval(() => {
            if (submitSearch())
                window.clearInterval(timer);
        }, 500);
        window.setTimeout(() => window.clearInterval(timer), 30000);
        return;
    }

    if (location.hostname !== "192.168.31.155")
        return;

    const COLUMN_NAME = "qb_external_search";
    const STYLE_ID = "qb-external-search-style";
    const TWO_WEEKS_SECONDS = 14 * 24 * 60 * 60;

    function installStyle() {
        if (document.getElementById(STYLE_ID))
            return;

        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            #torrentsTableFixedHeaderDiv th.column_${COLUMN_NAME},
            #torrentsTableDiv td.qb-external-search-cell {
                width: 116px;
                min-width: 116px;
                max-width: 116px;
                box-sizing: border-box;
                text-align: center;
            }
            #torrentsTableDiv td.qb-external-search-cell {
                overflow: visible;
                white-space: nowrap;
            }
            .qb-external-search-buttons {
                display: inline-flex;
                gap: 3px;
                align-items: center;
            }
            .qb-external-search-buttons button {
                border: 1px solid var(--color-border-default, #888);
                border-radius: 3px;
                padding: 1px 4px;
                color: inherit;
                background: var(--color-background-default, transparent);
                cursor: pointer;
                font: inherit;
                line-height: 1.35;
            }
            .qb-external-search-buttons button:hover {
                background: var(--color-background-hover, #555);
            }
            #torrentsTableDiv td.qb-added-on-overdue {
                color: #f04444 !important;
                font-weight: 700;
            }
        `;
        document.head.append(style);
    }

    function updateAddedOnHighlight(table, row) {
        const pos = table.getColumnPos("added_on");
        if (pos < 0)
            return;

        const tr = table.getTrByRowId(row.rowId);
        const cell = tr && table.getRowCells(tr)[pos];
        if (!cell)
            return;

        const progress = Number(row.full_data?.progress);
        const addedOn = Number(row.full_data?.added_on);
        const overdue = Number.isFinite(progress)
            && progress < 1
            && Number.isFinite(addedOn)
            && addedOn > 0
            && (Date.now() / 1000 - addedOn >= TWO_WEEKS_SECONDS);
        cell.classList.toggle("qb-added-on-overdue", overdue);
    }

    function cleanName(name) {
        return name
            .replace(/\.(?:mp4|mkv|avi|wmv|mov|torrent|iso)$/i, "")
            .trim();
    }

    function getJavDbKeyword(name) {
        const cleaned = cleanName(name).normalize("NFKC");
        const fc2 = cleaned.match(/\bFC2[-_ ]*(?:PPV[-_ ]*)?(\d{5,9})(?!\d)/i);
        if (fc2)
            return `FC2-PPV-${fc2[1]}`;
        const match = cleaned.match(/(?:^|[^A-Za-z0-9])([A-Za-z]{2,10})[-_ ]?(\d{2,5})(?!\d)/);
        return match ? `${match[1].toUpperCase()}-${match[2]}` : cleaned;
    }

    function getWuqianKeyword(name) {
        // 两个站点默认使用同一个番号；如果名称不是番号格式，则退回完整名称。
        return getJavDbKeyword(name);
    }

    function openSearch(type, name) {
        const keyword = type === "javdb" ? getJavDbKeyword(name) : getWuqianKeyword(name);
        if (!keyword)
            return;

        const url = type === "javdb"
            ? `https://javdb.com/search?q=${encodeURIComponent(keyword)}&f=all`
            : `https://wuqianso.org/search?keyword=${encodeURIComponent(keyword)}`;

        // 无钱搜由 Cloudflare 保护，直接从新标签页打开 /search 容易被判定为
        // 非浏览器请求并跳回首页。先打开首页建立站点 Cookie，再由同一页面跳转搜索。
        if (type === "wuqian") {
            window.open(`https://wuqianso.org/#qb-search=${encodeURIComponent(keyword)}`, "_blank");
            return;
        }
        window.open(url, "_blank", "noopener");
    }

    function createButton(label, type, name) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.title = type === "javdb" ? "在 JavDB 中搜索" : "在无钱搜中搜索";
        for (const eventType of ["mousedown", "pointerdown", "touchstart", "dblclick", "keydown"])
            button.addEventListener(eventType, (event) => event.stopPropagation());
        button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            openSearch(type, name);
        });
        return button;
    }

    function renderCell(cell, row) {
        cell.classList.add("qb-external-search-cell");
        const progress = row.full_data?.progress === undefined ? 100 : Number(row.full_data.progress) * 100;
        const name = String(row.full_data?.name || "").trim();
        const incomplete = Number.isFinite(progress) && progress >= 0 && progress < 100;
        const state = incomplete ? name : "";
        if (cell.dataset.qbSearchState === state)
            return;
        cell.dataset.qbSearchState = state;
        cell.replaceChildren();

        if (!incomplete)
            return;

        if (!name)
            return;

        const buttons = document.createElement("span");
        buttons.className = "qb-external-search-buttons";
        buttons.append(createButton("JavDB", "javdb", name));
        buttons.append(createButton("无钱搜", "wuqian", name));
        cell.append(buttons);
    }

    function installColumn() {
        const table = window.torrentsTable;
        if (!table || !table.columns || table.columns[COLUMN_NAME])
            return Boolean(table?.columns?.[COLUMN_NAME]);

        table.newColumn(COLUMN_NAME, "", "外部搜索", 116, true);
        const column = table.columns[COLUMN_NAME];
        column.dataProperties = ["name", "progress"];
        column.updateTd = function (td, row) {
            renderCell(td, row);
        };

        const originalUpdateRow = table.updateRow.bind(table);
        table.updateRow = function (tr, fullUpdate) {
            originalUpdateRow(tr, fullUpdate);
            const row = this.rows.get(tr.rowId);
            if (row)
                updateAddedOnHighlight(this, row);
        };

        // 安装时已有的行和虚拟列表缓存也需要补齐新列。
        const existingRows = new Set([...table.getTrs(), ...(table.cachedElements || [])]);
        for (const tr of existingRows) {
            if (!tr)
                continue;
            const td = document.createElement("td");
            td.classList.toggle("invisible", !column.isVisible());
            tr.append(td);
        }
        table.updateTableHeaders();
        table.updateTable(true);
        return true;
    }

    function start() {
        installStyle();
        const timer = window.setInterval(() => {
            if (installColumn())
                window.clearInterval(timer);
        }, 100);
        installColumn();
    }

    if (document.readyState === "loading")
        document.addEventListener("DOMContentLoaded", start, { once: true });
    else
        start();
})();

