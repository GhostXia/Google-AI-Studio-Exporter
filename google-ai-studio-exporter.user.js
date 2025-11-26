// ==UserScript==
// @name         Google AI Studio Exporter
// @name:zh-CN   Google AI Studio 对话导出器
// @namespace    https://github.com/GhostXia/Google-AI-Studio-Exporter
// @version      1.3.5
// @description  Export your Gemini chat history from Google AI Studio to a text file. Features: Auto-scrolling, User/Model role differentiation, clean output, and full mobile optimization.
// @description:zh-CN 完美导出 Google AI Studio 对话记录。具备自动滚动加载、精准去重、防抖动、User/Model角色区分，以及全平台响应式优化。支持 PC、平板、手机全平台。
// @author       GhostXia
// @license      AGPL-3.0
// @match        https://aistudio.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @homepageURL  https://github.com/GhostXia/Google-AI-Studio-Exporter
// @supportURL   https://github.com/GhostXia/Google-AI-Studio-Exporter/issues
// @downloadURL  https://github.com/GhostXia/Google-AI-Studio-Exporter/raw/main/google-ai-studio-exporter.user.js
// @updateURL    https://github.com/GhostXia/Google-AI-Studio-Exporter/raw/main/google-ai-studio-exporter.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
    'use strict';

    // ==========================================
    // 0. 国际化 (i18n)
    // ==========================================
    const lang = navigator.language.startsWith('zh') ? 'zh' : 'en';
    const translations = {
        'zh': {
            'btn_export': '🚀 导出',
            'title_ready': '准备就绪',
            'status_init': '初始化中...',
            'btn_save': '💾 保存',
            'btn_close': '关闭',
            'title_countdown': '准备开始',
            'status_countdown': '请松开鼠标，不要操作！<br><span class="ai-red">{s} 秒后开始自动滚动</span>',
            'title_scrolling': '正在采集...',
            'status_scrolling': '正在向下滚动并抓取内容。<br>按 <b>ESC</b> 键可强制停止并保存。',
            'title_finished': '🎉 导出成功',
            'status_finished': '文件已生成。<br>请检查下载栏。',
            'title_error': '❌ 出错了',
            'title_mode_select': '选择导出模式',
            'status_mode_select': '请选择导出格式',
            'btn_mode_full': '📦 包含附件',
            'btn_mode_text': '📄 纯文本',
            'file_header': 'Google AI Studio 完整对话记录',
            'file_time': '时间',
            'file_count': '条数',
            'role_user': 'User',
            'role_gemini': 'Gemini',
            'err_no_scroller': '未找到滚动容器。请尝试刷新页面或手动滚动一下再试。',
            'err_no_data': '未采集到任何对话数据。请检查页面是否有对话内容。',
            'err_runtime': '运行错误: ',
            'status_packaging_images': '正在打包 {n} 张图片...',
            'status_packaging_images_progress': '打包图片: {c}/{t}',
            'status_packaging_files': '正在打包 {n} 个文件...',
            'status_packaging_files_progress': '打包文件: {c}/{t}'
        },
        'en': {
            'btn_export': '🚀 Export',
            'title_ready': 'Ready',
            'status_init': 'Initializing...',
            'btn_save': '💾 Save',
            'btn_close': 'Close',
            'title_countdown': 'Get Ready',
            'status_countdown': 'Please release mouse!<br><span class="ai-red">Auto-scroll starts in {s}s</span>',
            'title_scrolling': 'Exporting...',
            'status_scrolling': 'Scrolling down and capturing content.<br>Press <b>ESC</b> to stop and save.',
            'title_finished': '🎉 Finished',
            'status_finished': 'File generated.<br>Check your downloads.',
            'title_error': '❌ Error',
            'title_mode_select': 'Select Export Mode',
            'status_mode_select': 'Choose export format',
            'btn_mode_full': '📦 With Attachments',
            'btn_mode_text': '📄 Text Only',
            'file_header': 'Google AI Studio Chat History',
            'file_time': 'Time',
            'file_count': 'Count',
            'role_user': 'User',
            'role_gemini': 'Gemini',
            'err_no_scroller': 'Scroll container not found. Try refreshing or scrolling manually.',
            'err_no_data': 'No conversation data was collected. Please check if the page has any chat content.',
            'err_runtime': 'Runtime Error: ',
            'status_packaging_images': 'Packaging {n} images...',
            'status_packaging_images_progress': 'Packaging images: {c}/{t}',
            'status_packaging_files': 'Packaging {n} files...',
            'status_packaging_files_progress': 'Packaging files: {c}/{t}'
        }
    };

    function t(key, params = {}) {
        let str = translations[lang][key] || key;
        // Legacy support for single parameter
        if (typeof params !== 'object' || params === null) {
            str = str.replace('{s}', params);
            return str;
        }
        for (const pKey in params) {
            str = str.replace(new RegExp(`\\{${pKey}\\}`, 'g'), params[pKey]);
        }
        return str;
    }

    // ==========================================
    // 1. 样式与 UI (全平台响应式优化版)
    // ==========================================
    const style = document.createElement('style');
    style.textContent = `
        /* 全局遮罩层 */
        #ai-overlay-v14 {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.85); z-index: 2147483647;
            display: flex; justify-content: center; align-items: center;
            font-family: 'Google Sans', Roboto, -apple-system, sans-serif;
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            animation: ai-fade-in 0.2s ease-out;
        }
        
        @keyframes ai-fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        /* 主弹窗 */
        #ai-box {
            background: white; 
            padding: 32px; 
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            width: 90%; 
            max-width: 480px;
            text-align: center; 
            position: relative;
            animation: ai-slide-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        @keyframes ai-slide-up {
            from { transform: translateY(30px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }

        .ai-title { 
            font-size: 26px; 
            font-weight: 700; 
            margin-bottom: 16px; 
            color: #202124;
            letter-spacing: -0.5px;
        }
        
        .ai-status { 
            font-size: 15px; 
            margin-bottom: 24px; 
            line-height: 1.7; 
            color: #5f6368; 
        }
        
        .ai-count { 
            font-size: 48px; 
            font-weight: 700; 
            color: #1a73e8; 
            margin: 16px 0;
            font-variant-numeric: tabular-nums;
        }
        
        .ai-btn-container {
            display: flex;
            gap: 12px;
            justify-content: center;
            margin-top: 20px;
        }
        
        .ai-btn {
            background: linear-gradient(135deg, #1a73e8 0%, #1557b0 100%);
            color: white; 
            border: none; 
            padding: 14px 32px;
            border-radius: 12px; 
            cursor: pointer; 
            font-size: 16px; 
            font-weight: 600;
            display: none;
            box-shadow: 0 4px 12px rgba(26, 115, 232, 0.3);
            transition: all 0.2s ease;
            flex: 1;
            max-width: 150px;
        }
        
        .ai-btn-secondary {
            background: linear-gradient(135deg, #5f6368 0%, #3c4043 100%);
        }
        
        .ai-btn-secondary:hover {
            background: linear-gradient(135deg, #4a4d51 0%, #2d3033 100%);
        }
        
        .ai-btn:hover { 
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(26, 115, 232, 0.4);
        }
        
        .ai-btn:active {
            transform: translateY(0);
        }
        
        .ai-red { 
            color: #d93025; 
            font-weight: 700; 
        }

        /* 悬浮按钮 - PC 默认样式 */
        .ai-entry {
            position: fixed; 
            z-index: 2147483646;
            padding: 14px 28px;
            background: linear-gradient(135deg, #1a73e8 0%, #1557b0 100%);
            color: white;
            border: none;
            border-radius: 50px; 
            cursor: pointer;
            box-shadow: 0 6px 20px rgba(26, 115, 232, 0.4);
            font-weight: 700;
            font-size: 15px;
            transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            top: 80px; 
            right: 28px;
            letter-spacing: -0.3px;
            user-select: none;
            -webkit-user-select: none;
            -webkit-tap-highlight-color: transparent;
        }
        
        .ai-entry:hover { 
            transform: scale(1.08) translateY(-2px);
            box-shadow: 0 8px 24px rgba(26, 115, 232, 0.5);
        }
        
        .ai-entry:active {
            transform: scale(1.02);
        }

        /* ========================================== */
        /* 平板适配 (600px - 900px) */
        /* ========================================== */
        @media (max-width: 900px) and (min-width: 601px) {
            .ai-entry {
                top: 70px;
                right: 24px;
                padding: 12px 24px;
                font-size: 14px;
            }
            #ai-box {
                max-width: 420px;
                padding: 28px;
            }
            .ai-title { font-size: 22px; }
            .ai-count { font-size: 40px; }
        }

        /* ========================================== */
        /* 手机适配 (最大 600px) */
        /* ========================================== */
        @media (max-width: 600px) {
            .ai-entry {
                /* 移动端：右下角悬浮球 */
                top: auto; 
                bottom: 140px; 
                right: 16px;
                padding: 16px 20px;
                font-size: 14px;
                min-width: 56px;
                min-height: 56px; /* 符合移动端 44-56px 最小触控标准 */
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 8px 24px rgba(26, 115, 232, 0.6);
            }
            
            #ai-box {
                padding: 24px 20px;
                border-radius: 16px;
                width: 92%;
                max-width: none;
            }
            
            .ai-title { 
                font-size: 20px;
                margin-bottom: 12px;
            }
            
            .ai-status {
                font-size: 14px;
                margin-bottom: 20px;
            }
            
            .ai-count { 
                font-size: 40px;
                margin: 12px 0;
            }
            
            .ai-btn {
                padding: 12px 28px;
                font-size: 15px;
                border-radius: 10px;
                width: 100%;
                max-width: 200px;
            }
        }

        /* ========================================== */
        /* 超小屏幕适配 (最大 360px) */
        /* ========================================== */
        @media (max-width: 360px) {
            .ai-entry {
                bottom: 130px;
                right: 12px;
                padding: 14px 16px;
                font-size: 13px;
            }
            
            #ai-box {
                padding: 20px 16px;
            }
            
            .ai-title { font-size: 18px; }
            .ai-count { font-size: 36px; }
            .ai-status { font-size: 13px; }
        }

        /* 深色模式适配 */
        @media (prefers-color-scheme: dark) {
            #ai-overlay-v14 {
                background: rgba(0, 0, 0, 0.92);
            }
            #ai-box {
                background: #202124;
                box-shadow: 0 20px 60px rgba(0,0,0,0.8);
            }
            .ai-title { color: #e8eaed; }
            .ai-status { color: #9aa0a6; }
        }
    `;
    document.head.appendChild(style);

    // ==========================================
    // 2. 状态管理
    // ==========================================
    let isRunning = false;
    let hasFinished = false;
    let collectedData = new Map();
    let overlay, titleEl, statusEl, countEl, closeBtn;
    let exportMode = null; // 'full' or 'text'

    // ==========================================
    // 3. UI 逻辑
    // ==========================================
    function createEntryButton() {
        if (document.getElementById('ai-entry-btn-v14')) return;
        const btn = document.createElement('button');
        btn.id = 'ai-entry-btn-v14';
        btn.className = 'ai-entry';
        btn.innerHTML = t('btn_export');
        btn.onclick = startProcess;
        document.body.appendChild(btn);
    }

    function initUI() {
        if (document.getElementById('ai-overlay-v14')) {
            overlay.style.display = 'flex';
            return;
        }
        overlay = document.createElement('div');
        overlay.id = 'ai-overlay-v14';
        overlay.innerHTML = `
            <div id="ai-box">
                <div class="ai-title">${t('title_ready')}</div>
                <div class="ai-status">${t('status_init')}</div>
                <div class="ai-count">0</div>
                <div class="ai-btn-container">
                    <button id="ai-save-btn" class="ai-btn">${t('btn_save')}</button>
                    <button id="ai-close-btn" class="ai-btn ai-btn-secondary">${t('btn_close')}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        titleEl = overlay.querySelector('.ai-title');
        statusEl = overlay.querySelector('.ai-status');
        countEl = overlay.querySelector('.ai-count');
        closeBtn = overlay.querySelector('#ai-close-btn');
        const saveBtn = overlay.querySelector('#ai-save-btn');

        closeBtn.onclick = () => { overlay.style.display = 'none'; };
        saveBtn.onclick = async () => {
            try {
                const result = await downloadCollectedData();
                if (!result) {
                    updateUI('ERROR', t('err_no_data'));
                }
            } catch (err) {
                console.error("Failed to re-download file:", err);
                updateUI('ERROR', t('err_runtime') + err.message);
            }
        };
    }

    function updateUI(state, msg = "") {
        initUI();
        const saveBtn = overlay.querySelector('#ai-save-btn');
        const btnContainer = overlay.querySelector('.ai-btn-container');
        btnContainer.style.display = 'none';

        if (state === 'COUNTDOWN') {
            titleEl.innerText = t('title_countdown');
            statusEl.innerHTML = t('status_countdown', msg);
            countEl.innerText = "0";
        } else if (state === 'SCROLLING') {
            titleEl.innerText = t('title_scrolling');
            statusEl.innerHTML = t('status_scrolling');
            countEl.innerText = msg;
        } else if (state === 'FINISHED') {
            titleEl.innerText = t('title_finished');
            statusEl.innerHTML = t('status_finished');
            countEl.innerText = msg;
            btnContainer.style.display = 'flex';
            saveBtn.style.display = 'inline-block';
            closeBtn.style.display = 'inline-block';
        } else if (state === 'ERROR') {
            titleEl.innerText = t('title_error');
            statusEl.innerHTML = `<span class="ai-red">${msg}</span>`;
            btnContainer.style.display = 'flex';
            closeBtn.style.display = 'inline-block';
        }
    }

    function showModeSelection() {
        return new Promise((resolve, reject) => {
            initUI();
            titleEl.innerText = t('title_mode_select');
            statusEl.innerHTML = t('status_mode_select');
            countEl.innerText = '';

            const btnContainer = overlay.querySelector('.ai-btn-container');
            btnContainer.style.display = 'flex';
            btnContainer.innerHTML = ''; // Clear existing buttons

            // Helper to create buttons
            const createModeButton = (id, text, isPrimary, onClick) => {
                const btn = document.createElement('button');
                btn.id = id;
                btn.className = isPrimary ? 'ai-btn' : 'ai-btn ai-btn-secondary';
                btn.textContent = text;
                btn.onclick = onClick;
                btnContainer.appendChild(btn);
            };

            createModeButton('ai-mode-full', t('btn_mode_full'), true, () => {
                exportMode = 'full';
                resolve('full');
            });

            createModeButton('ai-mode-text', t('btn_mode_text'), false, () => {
                exportMode = 'text';
                resolve('text');
            });

            createModeButton('ai-mode-close', t('btn_close'), false, () => {
                overlay.style.display = 'none';
                reject(new Error('Export cancelled by user.'));
            });
        });
    }

    // ==========================================
    // 4. 核心流程
    // ==========================================
    async function startProcess() {
        if (isRunning) return;
        isRunning = true;
        hasFinished = false;
        collectedData.clear();

        // 显示模式选择
        try {
            await showModeSelection();
        } catch (e) {
            console.log('Export cancelled.');
            isRunning = false;
            return;
        }

        for (let i = 3; i > 0; i--) {
            updateUI('COUNTDOWN', i);
            await sleep(1000);
        }

        let scroller = findRealScroller();

        // 移动端增强激活逻辑
        if (!scroller || scroller.scrollHeight <= scroller.clientHeight) {
            console.log("尝试主动激活滚动容器...");
            // 先尝试滚动 window
            window.scrollBy(0, 1);
            await sleep(100);
            scroller = findRealScroller();
        }

        // 如果还是找不到，尝试触摸激活
        if (!scroller || scroller.scrollHeight <= scroller.clientHeight) {
            console.log("尝试触摸激活...");
            const bubble = document.querySelector('ms-chat-turn');
            if (bubble) {
                bubble.scrollIntoView({ behavior: 'instant' });
                await sleep(200);
                scroller = findRealScroller();
            }
        }

        if (!scroller) {
            endProcess("ERROR", t('err_no_scroller'));
            return;
        }

        updateUI('SCROLLING', 0);

        // ========================================
        // 智能跳转：使用滚动条按钮直接跳到第一个对话
        // ========================================
        console.log("尝试使用滚动条按钮跳转到第一个对话...");

        // 查找所有对话轮次按钮
        const scrollbarButtons = document.querySelectorAll('button[id^="scrollbar-item-"]');
        console.log(`找到 ${scrollbarButtons.length} 个对话轮次按钮`);

        if (scrollbarButtons.length > 0) {
            // 点击第一个按钮（最早的对话）
            const firstButton = scrollbarButtons[0];
            console.log("点击第一个对话按钮:", firstButton.getAttribute('name') || firstButton.id);
            firstButton.click();

            // 等待跳转和渲染
            await sleep(1500);
            console.log("跳转后 scrollTop:", scroller.scrollTop);
        } else {
            console.log("未找到滚动条按钮，使用备用方案...");
        }

        // 备用方案：如果按钮不存在或跳转失败，逐步向上滚动
        const initialScrollTop = scroller.scrollTop;
        if (initialScrollTop > 500) {
            console.log("执行备用滚动方案，当前 scrollTop:", initialScrollTop);
            let currentPos = initialScrollTop;
            let upwardAttempts = 0;
            const maxUpwardAttempts = 15; // 减少尝试次数

            while (currentPos > 100 && upwardAttempts < maxUpwardAttempts) {
                upwardAttempts++;

                // 每次向上滚动一个视口高度
                const scrollAmount = Math.min(window.innerHeight, currentPos);
                scroller.scrollBy({ top: -scrollAmount, behavior: 'smooth' });

                await sleep(500);

                const newPos = scroller.scrollTop;
                console.log(`向上滚动 ${upwardAttempts}/${maxUpwardAttempts}: ${currentPos} → ${newPos}`);

                // 如果卡住了，尝试直接设置
                if (Math.abs(newPos - currentPos) < 10) {
                    console.log("检测到卡住，尝试直接设置...");
                    scroller.scrollTop = Math.max(0, currentPos - scrollAmount);
                    await sleep(300);
                }

                currentPos = scroller.scrollTop;

                // 如果已经到顶部附近，退出
                if (currentPos < 100) {
                    break;
                }
            }
        }

        // 最终确保到达顶部
        console.log("执行最终回到顶部，当前 scrollTop:", scroller.scrollTop);
        scroller.scrollTop = 0;
        await sleep(500);

        // 再次确认
        if (scroller.scrollTop > 10) {
            scroller.scrollTo({ top: 0, behavior: 'instant' });
            await sleep(500);
        }

        console.log("✓ 回到顶部完成，最终 scrollTop:", scroller.scrollTop);

        // 等待 DOM 稳定
        await sleep(800);





        let lastScrollTop = -9999;
        let stuckCount = 0;

        try {
            while (isRunning) {
                captureData();
                updateUI('SCROLLING', collectedData.size);

                scroller.scrollBy({ top: window.innerHeight * 0.7, behavior: 'smooth' });

                await sleep(900);

                const currentScroll = scroller.scrollTop;

                if (Math.abs(currentScroll - lastScrollTop) <= 2) {
                    stuckCount++;
                    if (stuckCount >= 3) {
                        console.log("判定到底", currentScroll);
                        break;
                    }
                } else {
                    stuckCount = 0;
                }
                lastScrollTop = currentScroll;
            }
        } catch (e) {
            console.error(e);
            endProcess("ERROR", t('err_runtime') + e.message);
            return;
        }

        endProcess("FINISHED");
    }

    // ==========================================
    // 5. 辅助功能
    // ==========================================

    // Shared Regex Constants
    // Capture: 1=Alt/Text, 2=URL, 3=Title(optional)
    const IMG_REGEX = /!\[([^\]]*)\]\(([^\s)]+)(\s+"[^"]*")?\)/g;
    const LINK_REGEX = /\[([^\]]*)\]\(([^\s)]+)(\s+"[^"]*")?\)/g;

    function findRealScroller() {
        const candidates = document.querySelectorAll('[role="main"], .conversation-container, ms-chat-container');
        for (const el of candidates) {
            if (el.scrollHeight > el.clientHeight) return el;
        }
        return document.scrollingElement || document.documentElement;
    }

    function captureData() {
        const turns = document.querySelectorAll('ms-chat-turn');
        turns.forEach(turn => {
            if (!turn.id || collectedData.has(turn.id)) return;

            const role = (turn.querySelector('[data-turn-role="Model"]') || turn.innerHTML.includes('model-prompt-container')) ? "Gemini" : "User";

            const clone = turn.cloneNode(true);
            const trash = ['.actions-container', '.turn-footer', 'button', 'mat-icon', 'ms-grounding-sources', 'ms-search-entry-point'];
            trash.forEach(s => clone.querySelectorAll(s).forEach(e => e.remove()));

            let text = htmlToMarkdown(clone);

            if (text.length > 0) collectedData.set(turn.id, { role, text });
        });
    }

    function htmlToMarkdown(node, listContext = null) {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return '';

        const tag = node.tagName.toLowerCase();

        // Images
        if (tag === 'img') {
            const alt = node.getAttribute('alt') || '';
            const src = node.getAttribute('src') || '';
            return `![${alt}](${src})`;
        }

        // Code blocks
        if (tag === 'pre') {
            const codeEl = node.querySelector('code');
            if (codeEl) {
                const language = Array.from(codeEl.classList).find(c => c.startsWith('language-'))?.replace('language-', '') || '';
                const code = codeEl.textContent;
                return `\n\`\`\`${language}\n${code}\n\`\`\`\n`;
            }
        }

        // Inline code
        if (tag === 'code') {
            return `\`${node.textContent}\``;
        }

        // Headings
        if (/^h[1-6]$/.test(tag)) {
            const level = parseInt(tag[1]);
            return '\n' + '#'.repeat(level) + ' ' + getChildrenText(node, listContext) + '\n';
        }

        // Bold
        if (tag === 'strong' || tag === 'b') {
            return `**${getChildrenText(node, listContext)}**`;
        }

        // Italic
        if (tag === 'em' || tag === 'i') {
            return `*${getChildrenText(node, listContext)}*`;
        }

        // Links
        if (tag === 'a') {
            const href = node.getAttribute('href') || '';
            const text = getChildrenText(node, listContext);
            return `[${text}](${href})`;
        }

        // Lists - pass context to children
        if (tag === 'ul' || tag === 'ol') {
            const listType = tag; // 'ul' or 'ol'
            let index = 0;
            let result = '\n';

            for (const child of node.childNodes) {
                if (child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() === 'li') {
                    index++;
                    result += htmlToMarkdown(child, { type: listType, index: index });
                } else {
                    result += htmlToMarkdown(child, { type: listType, index: index });
                }
            }

            return result + '\n';
        }

        // List items - use context to determine format
        if (tag === 'li') {
            const content = getChildrenText(node, listContext).trim();
            if (listContext && listContext.type === 'ol') {
                return `${listContext.index}. ${content}\n`;
            } else {
                return `- ${content}\n`;
            }
        }

        // Line breaks
        if (tag === 'br') {
            return '\n';
        }

        // Blockquotes - prefix each line with >
        if (tag === 'blockquote') {
            const content = getChildrenText(node, listContext);
            // Split by lines and prefix each with "> "
            return '\n' + content.split('\n')
                .map(line => `> ${line}`)
                .join('\n') + '\n';
        }

        // Block elements
        if (['div', 'p'].includes(tag)) {
            return '\n' + getChildrenText(node, listContext) + '\n';
        }

        return getChildrenText(node, listContext);
    }

    function getChildrenText(node, listContext = null) {
        return Array.from(node.childNodes).map(child => htmlToMarkdown(child, listContext)).join('');
    }

    // Helper: Download text-only mode
    function downloadTextOnly() {
        let content = `# ${t('file_header')}\n\n`;
        content += `**${t('file_time')}:** ${new Date().toLocaleString()}\n\n`;
        content += `**${t('file_count')}:** ${collectedData.size}\n\n`;
        content += "---\n\n";

        for (const [id, item] of collectedData) {
            const roleName = item.role === 'Gemini' ? t('role_gemini') : t('role_user');
            content += `## ${roleName}\n\n${item.text}\n\n`;
            content += `---\n\n`;
        }

        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        downloadBlob(blob, `Gemini_Chat_v14_${Date.now()}.md`);
    }

    // Helper: Process and download images
    async function processImages(allText, imgFolder) {
        const imgMap = new Map();
        // Use shared regex constant
        const imgMatches = [...allText.matchAll(IMG_REGEX)];
        const uniqueImgUrls = new Set(imgMatches.map(m => m[2])); // URL is in group 2

        if (uniqueImgUrls.size > 0) {
            updateUI('SCROLLING', t('status_packaging_images', { n: uniqueImgUrls.size }));
            let completedCount = 0;

            const imagePromises = Array.from(uniqueImgUrls).map(async (url, index) => {
                try {
                    const blob = await fetchResource(url);
                    if (blob) {
                        const extension = (blob.type.split('/')[1] || 'png').split('+')[0];
                        const finalName = `image_${index}.${extension}`;
                        imgFolder.file(finalName, blob);
                        imgMap.set(url, `images/${finalName}`);
                    }
                } catch (e) {
                    console.error("图片下载失败:", url, e);
                }
                completedCount++;
                if (completedCount % 5 === 0 || completedCount === uniqueImgUrls.size) {
                    updateUI('SCROLLING', t('status_packaging_images_progress', { c: completedCount, t: uniqueImgUrls.size }));
                }
            });

            await Promise.all(imagePromises);
        }

        return imgMap;
    }

    // Helper: Process and download files
    async function processFiles(allText, fileFolder) {
        const fileMap = new Map();
        // Use shared regex constant
        const linkMatches = [...allText.matchAll(LINK_REGEX)];
        const uniqueFileUrls = new Set();
        const downloadableExtensions = ['.pdf', '.csv', '.txt', '.json', '.py', '.js', '.html', '.css', '.md', '.zip', '.tar', '.gz'];

        for (const match of linkMatches) {
            // Skip image links (those starting with !)
            if (match[0].startsWith('!')) {
                continue;
            }
            const url = match[2]; // URL is now in group 2
            const lowerUrl = url.toLowerCase();
            const isBlob = lowerUrl.startsWith('blob:');
            const isGoogleStorage = lowerUrl.includes('googlestorage') || lowerUrl.includes('googleusercontent');
            const hasExt = downloadableExtensions.some(ext => lowerUrl.split('?')[0].endsWith(ext));

            if (isBlob || isGoogleStorage || hasExt) {
                uniqueFileUrls.add(url);
            }
        }

        if (uniqueFileUrls.size > 0) {
            updateUI('SCROLLING', t('status_packaging_files', { n: uniqueFileUrls.size }));
            let completedCount = 0;

            const filePromises = Array.from(uniqueFileUrls).map(async (url, index) => {
                try {
                    let filename = "file";
                    try {
                        const urlObj = new URL(url);
                        filename = urlObj.pathname.substring(urlObj.pathname.lastIndexOf('/') + 1);
                    } catch (e) {
                        filename = url.split('/').pop().split('?')[0];
                    }

                    let decodedFilename = filename;
                    try {
                        decodedFilename = decodeURIComponent(filename);
                    } catch (e) {
                        console.warn(`Could not decode filename: ${filename}`, e);
                    }
                    // Increased limit from 50 to 100 as per PR review
                    if (!decodedFilename || decodedFilename.length > 100) decodedFilename = `file_${index}`;
                    const finalName = `${index}_${decodedFilename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

                    const blob = await fetchResource(url);
                    if (blob) {
                        fileFolder.file(finalName, blob);
                        fileMap.set(url, `files/${finalName}`);
                    }
                } catch (e) {
                    console.error("文件下载失败:", url, e);
                }
                completedCount++;
                if (completedCount % 5 === 0 || completedCount === uniqueFileUrls.size) {
                    updateUI('SCROLLING', t('status_packaging_files_progress', { c: completedCount, t: uniqueFileUrls.size }));
                }
            });

            await Promise.all(filePromises);
        }

        return fileMap;
    }

    // Helper: Generate Markdown content with URL replacements
    function generateMarkdownContent(imgMap, fileMap) {
        let content = `# ${t('file_header')}\n\n`;
        content += `**${t('file_time')}:** ${new Date().toLocaleString()}\n\n`;
        content += `**${t('file_count')}:** ${collectedData.size}\n\n`;
        content += "---\n\n";

        for (const [id, item] of collectedData) {
            const roleName = item.role === 'Gemini' ? t('role_gemini') : t('role_user');
            let processedText = item.text;

            // Replace image URLs
            processedText = processedText.replace(IMG_REGEX, (match, alt, url, title) => {
                if (imgMap.has(url)) {
                    const titleStr = title || '';
                    return `![${alt}](${imgMap.get(url)}${titleStr})`;
                }
                return match;
            });

            // Replace file URLs
            processedText = processedText.replace(LINK_REGEX, (match, text, url, title) => {
                // Skip image links
                if (match.startsWith('!')) {
                    return match;
                }
                if (fileMap.has(url)) {
                    const titleStr = title || '';
                    return `[${text}](${fileMap.get(url)}${titleStr})`;
                }
                return match;
            });

            content += `## ${roleName}\n\n${processedText}\n\n`;
            content += `---\n\n`;
        }

        return content;
    }

    // Main function: orchestrate the download process
    async function downloadCollectedData() {
        if (collectedData.size === 0) return false;

        // Text-only mode
        if (exportMode === 'text') {
            downloadTextOnly();
            return true;
        }

        // Full mode with attachments
        const zip = new JSZip();
        const imgFolder = zip.folder("images");
        const fileFolder = zip.folder("files");

        const allText = Array.from(collectedData.values()).map(v => v.text).join('\n');

        // Process images and files in parallel
        const [imgMap, fileMap] = await Promise.all([
            processImages(allText, imgFolder),
            processFiles(allText, fileFolder)
        ]);

        // Generate final Markdown content
        const content = generateMarkdownContent(imgMap, fileMap);

        // Create and download ZIP
        zip.file("chat_history.md", content);
        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, `Gemini_Chat_v14_${Date.now()}.zip`);

        return true;
    }

    function fetchResource(url) {
        return new Promise((resolve) => {
            if (typeof GM_xmlhttpRequest !== 'undefined') {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: url,
                    responseType: "blob",
                    onload: (response) => resolve(response.response),
                    onerror: () => resolve(null)
                });
            } else {
                fetch(url)
                    .then(r => r.blob())
                    .then(resolve)
                    .catch(() => resolve(null));
            }
        });
    }

    function downloadBlob(blob, name) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function endProcess(status, msg) {
        if (hasFinished) return;
        hasFinished = true;
        isRunning = false;

        if (status === "FINISHED") {
            if (collectedData.size > 0) {
                downloadCollectedData().then(() => {
                    updateUI('FINISHED', collectedData.size);
                }).catch(err => {
                    console.error("Failed to generate and download file:", err);
                    updateUI('ERROR', t('err_runtime') + err.message);
                });
            } else {
                updateUI('ERROR', t('err_no_data'));
            }
        } else {
            updateUI('ERROR', msg);
        }
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && isRunning) {
            endProcess("FINISHED");
        }
    });

    setInterval(createEntryButton, 2000);
})();
