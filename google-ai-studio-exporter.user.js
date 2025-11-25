// ==UserScript==
// @name         Google AI Studio Exporter
// @name:zh-CN   Google AI Studio 对话导出器
// @namespace    https://github.com/GhostXia/Google-AI-Studio-Exporter
// @version      1.1.2
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
// @grant        none
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
            'btn_close': '关闭',
            'title_countdown': '准备开始',
            'status_countdown': '请松开鼠标，不要操作！<br><span class="ai-red">{s} 秒后开始自动滚动</span>',
            'title_scrolling': '正在采集...',
            'status_scrolling': '正在向下滚动并抓取内容。<br>按 <b>ESC</b> 键可强制停止并保存。',
            'title_finished': '🎉 导出成功',
            'status_finished': '文件已生成。<br>请检查下载栏。',
            'title_error': '❌ 出错了',
            'file_header': 'Google AI Studio 完整对话记录',
            'file_time': '时间',
            'file_count': '条数',
            'role_user': 'User',
            'role_gemini': 'Gemini',
            'err_no_scroller': '未找到滚动容器。请尝试刷新页面或手动滚动一下再试。',
            'err_runtime': '运行错误: '
        },
        'en': {
            'btn_export': '🚀 Export',
            'title_ready': 'Ready',
            'status_init': 'Initializing...',
            'btn_close': 'Close',
            'title_countdown': 'Get Ready',
            'status_countdown': 'Please release mouse!<br><span class="ai-red">Auto-scroll starts in {s}s</span>',
            'title_scrolling': 'Exporting...',
            'status_scrolling': 'Scrolling down and capturing content.<br>Press <b>ESC</b> to stop and save.',
            'title_finished': '🎉 Finished',
            'status_finished': 'File generated.<br>Check your downloads.',
            'title_error': '❌ Error',
            'file_header': 'Google AI Studio Chat History',
            'file_time': 'Time',
            'file_count': 'Count',
            'role_user': 'User',
            'role_gemini': 'Gemini',
            'err_no_scroller': 'Scroll container not found. Try refreshing or scrolling manually.',
            'err_runtime': 'Runtime Error: '
        }
    };

    function t(key, param) {
        let str = translations[lang][key] || key;
        if (param !== undefined) str = str.replace('{s}', param);
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
        
        .ai-btn {
            background: linear-gradient(135deg, #1a73e8 0%, #1557b0 100%);
            color: white; 
            border: none; 
            padding: 14px 32px;
            border-radius: 12px; 
            cursor: pointer; 
            font-size: 16px; 
            font-weight: 600;
            margin-top: 20px; 
            display: none;
            box-shadow: 0 4px 12px rgba(26, 115, 232, 0.3);
            transition: all 0.2s ease;
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
                <button id="ai-close-btn" class="ai-btn">${t('btn_close')}</button>
            </div>
        `;
        document.body.appendChild(overlay);

        titleEl = overlay.querySelector('.ai-title');
        statusEl = overlay.querySelector('.ai-status');
        countEl = overlay.querySelector('.ai-count');
        closeBtn = overlay.querySelector('#ai-close-btn');

        closeBtn.onclick = () => { overlay.style.display = 'none'; };
    }

    function updateUI(state, msg = "") {
        initUI();
        closeBtn.style.display = 'none';

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
            closeBtn.style.display = 'inline-block';
        } else if (state === 'ERROR') {
            titleEl.innerText = t('title_error');
            statusEl.innerHTML = `<span class="ai-red">${msg}</span>`;
            closeBtn.style.display = 'inline-block';
        }
    }

    // ==========================================
    // 4. 核心流程
    // ==========================================
    async function startProcess() {
        if (isRunning) return;
        isRunning = true;
        hasFinished = false;
        collectedData.clear();

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

        // 移动端增强回到顶部逻辑 - 验证循环
        console.log("回到顶部，当前 scrollTop:", scroller.scrollTop);

        // 多次尝试并验证，最多 5 次
        let scrollAttempts = 0;
        const maxAttempts = 5;

        while (scroller.scrollTop > 10 && scrollAttempts < maxAttempts) {
            scrollAttempts++;
            console.log(`第 ${scrollAttempts} 次尝试回到顶部...`);

            // 方法 1: 直接设置
            scroller.scrollTop = 0;
            await sleep(400);

            // 方法 2: scrollTo
            if (scroller.scrollTop > 10) {
                scroller.scrollTo({ top: 0, behavior: 'instant' });
                await sleep(400);
            }

            // 方法 3: 强制向上滚动
            if (scroller.scrollTop > 10) {
                scroller.scrollBy({ top: -99999, behavior: 'instant' });
                await sleep(400);
            }

            console.log(`尝试后 scrollTop: ${scroller.scrollTop}`);
        }

        if (scroller.scrollTop > 100) {
            console.warn("警告：未能完全回到顶部，当前位置:", scroller.scrollTop);
        } else {
            console.log("✓ 成功回到顶部，当前 scrollTop:", scroller.scrollTop);
        }

        // 额外等待，确保页面渲染稳定
        await sleep(800);

        // 最后一次确认并修正
        if (scroller.scrollTop > 10) {
            console.log("最后修正，scrollTop:", scroller.scrollTop);
            scroller.scrollTop = 0;
            await sleep(500);
        }



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

    function endProcess(status, msg) {
        if (hasFinished) return;
        hasFinished = true;
        isRunning = false;

        if (status === "FINISHED") {
            let content = t('file_header') + "\n";
            content += `${t('file_time')}: ${new Date().toLocaleString()}\n`;
            content += `${t('file_count')}: ${collectedData.size}\n`;
            content += "========================================\n\n";

            for (const [id, item] of collectedData) {
                content += `### ${item.role === 'Gemini' ? t('role_gemini') : t('role_user')}:\n${item.text}\n`;
                content += `----------------------------------------------------------------\n\n`;
            }
            download(content, `Gemini_Chat_v14_${Date.now()}.txt`);
            updateUI('FINISHED', collectedData.size);
        } else {
            updateUI('ERROR', msg);
        }
    }

    function findRealScroller() {
        const bubble = document.querySelector('ms-chat-turn');
        if (!bubble) {
            return document.querySelector('div[class*="scroll"]') || document.body;
        }

        let el = bubble.parentElement;
        while (el && el !== document.body) {
            const style = window.getComputedStyle(el);
            if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight >= el.clientHeight) {
                return el;
            }
            el = el.parentElement;
        }
        return document.documentElement;
    }

    function captureData() {
        const turns = document.querySelectorAll('ms-chat-turn');
        turns.forEach(turn => {
            if (!turn.id || collectedData.has(turn.id)) return;

            const role = (turn.querySelector('[data-turn-role="Model"]') || turn.innerHTML.includes('model-prompt-container')) ? "Gemini" : "User";

            const clone = turn.cloneNode(true);
            const trash = ['.actions-container', '.turn-footer', 'button', 'mat-icon', 'ms-grounding-sources', 'ms-search-entry-point'];
            trash.forEach(s => clone.querySelectorAll(s).forEach(e => e.remove()));

            let text = clone.innerText
                .replace(/edit\s*more_vert/gi, '')
                .replace(/more_vert/gi, '')
                .replace(/Run\s*Delete/gi, '')
                .trim();

            if (text.length > 0) collectedData.set(turn.id, { role, text });
        });
    }

    function download(text, name) {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && isRunning) {
            endProcess("FINISHED");
        }
    });

    setInterval(createEntryButton, 2000);
})();