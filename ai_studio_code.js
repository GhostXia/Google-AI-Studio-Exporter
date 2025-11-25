// ==UserScript==
// @name         Google AI Studio 导出助手 (v14.0 主动探测版)
// @namespace    http://tampermonkey.net/
// @version      14.0
// @description  增加主动探测机制，解决冷启动时找不到滚动条的问题。保留单次下载锁和v10精准算法。
// @author       You
// @match        https://aistudio.google.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // 1. 样式与 UI (保持 v13)
    // ==========================================
    const style = document.createElement('style');
    style.textContent = `
        #ai-overlay-v14 {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.8); z-index: 2147483647;
            display: flex; justify-content: center; align-items: center;
            font-family: 'Google Sans', Roboto, sans-serif;
            backdrop-filter: blur(4px);
        }
        #ai-box {
            background: white; padding: 32px; border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5); width: 460px;
            text-align: center; position: relative;
        }
        .ai-title { font-size: 24px; font-weight: 700; margin-bottom: 16px; color: #202124; }
        .ai-status { font-size: 15px; margin-bottom: 24px; line-height: 1.6; color: #5f6368; }
        .ai-count { font-size: 42px; font-weight: bold; color: #1a73e8; margin: 10px 0; }
        .ai-btn {
            background: #1a73e8; color: white; border: none; padding: 12px 30px;
            border-radius: 8px; cursor: pointer; font-size: 15px; font-weight: 600;
            margin-top: 20px; display: none;
        }
        .ai-btn:hover { background: #1557b0; }
        .ai-red { color: #d93025; font-weight: bold; }
        .ai-entry {
            position: fixed; top: 80px; right: 24px; z-index: 2147483646;
            padding: 12px 24px; background: #1a73e8; color: white;
            border: 2px solid #fff; border-radius: 50px; cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3); font-weight: 700;
            transition: transform 0.2s;
        }
        .ai-entry:hover { transform: scale(1.05); }
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
        if(document.getElementById('ai-entry-btn-v14')) return;
        const btn = document.createElement('button');
        btn.id = 'ai-entry-btn-v14';
        btn.className = 'ai-entry';
        btn.innerHTML = '🚀 导出对话 (v14)';
        btn.onclick = startProcess;
        document.body.appendChild(btn);
    }

    function initUI() {
        if(document.getElementById('ai-overlay-v14')) {
            overlay.style.display = 'flex';
            return;
        }
        overlay = document.createElement('div');
        overlay.id = 'ai-overlay-v14';
        overlay.innerHTML = `
            <div id="ai-box">
                <div class="ai-title">准备就绪</div>
                <div class="ai-status">初始化中...</div>
                <div class="ai-count">0</div>
                <button id="ai-close-btn" class="ai-btn">关闭窗口</button>
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
            titleEl.innerText = "准备开始";
            statusEl.innerHTML = `请松开鼠标，不要操作！<br><span class="ai-red">${msg} 秒后开始自动滚动</span>`;
            countEl.innerText = "0";
        } else if (state === 'SCROLLING') {
            titleEl.innerText = "正在采集...";
            statusEl.innerHTML = `正在向下滚动并抓取内容。<br>按 <b>ESC</b> 键可强制停止并保存。`;
            countEl.innerText = msg;
        } else if (state === 'FINISHED') {
            titleEl.innerText = "🎉 导出成功";
            statusEl.innerHTML = `文件已生成。<br>请检查下载栏。`;
            countEl.innerText = msg;
            closeBtn.style.display = 'inline-block';
        } else if (state === 'ERROR') {
            titleEl.innerText = "❌ 出错了";
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
        
        for(let i=3; i>0; i--) {
            updateUI('COUNTDOWN', i);
            await sleep(1000);
        }

        // --- 核心修复：主动探测 + 精准定位 ---
        // 先尝试用 v10 逻辑找
        let scroller = findRealScroller();
        
        // 如果找不到，或者找到了但看起来不能滚 (scrollTopMax为0)，进行主动激活
        if (!scroller || scroller.scrollHeight <= scroller.clientHeight) {
            console.log("尝试主动激活滚动容器...");
            // 尝试让 body 滚一下，可能会触发布局更新
            window.scrollBy(0, 1);
            await sleep(100);
            scroller = findRealScroller(); // 再找一次
        }

        if (!scroller) {
            endProcess("ERROR", "未找到滚动容器。请尝试刷新页面或手动滚动一下再试。");
            return;
        }

        // 回到顶部
        updateUI('SCROLLING', 0);
        scroller.scrollTop = 0;
        await sleep(1500);

        // 滚动循环
        let lastScrollTop = -9999; 
        let stuckCount = 0;

        try {
            while (isRunning) {
                // 1. 抓取
                captureData();
                updateUI('SCROLLING', collectedData.size);

                // 2. 滚动动作
                scroller.scrollBy({ top: window.innerHeight * 0.7, behavior: 'smooth' });

                await sleep(900);

                // 3. 检查到底
                const currentScroll = scroller.scrollTop;
                
                // 允许 2px 误差
                if (Math.abs(currentScroll - lastScrollTop) <= 2) {
                    stuckCount++;
                    // 增加判定：必须确实是滚动了（或者已经到底了）
                    // 有时候 currentScroll 是 0，stuckCount 也会增加，这在开头会被 lastScrollTop=-9999 挡住
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
            endProcess("ERROR", "运行错误: " + e.message);
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
            let content = "Google AI Studio 完整对话记录\n";
            content += `时间: ${new Date().toLocaleString()}\n`;
            content += `条数: ${collectedData.size}\n`;
            content += "========================================\n\n";
            
            for (const [id, item] of collectedData) {
                content += `### ${item.role}:\n${item.text}\n`;
                content += `----------------------------------------------------------------\n\n`;
            }
            download(content, `Gemini_Chat_v14_${Date.now()}.txt`);
            updateUI('FINISHED', collectedData.size);
        } else {
            updateUI('ERROR', msg);
        }
    }

    function findRealScroller() {
        // 策略：从气泡反向查找 (v10 经典逻辑)
        const bubble = document.querySelector('ms-chat-turn');
        if (!bubble) {
            // 如果连气泡都没有，可能是没加载出来，或者确实是空的
            // 尝试找 class 包含 scroll 的 div
            return document.querySelector('div[class*="scroll"]') || document.body;
        }

        let el = bubble.parentElement;
        while (el && el !== document.body) {
            const style = window.getComputedStyle(el);
            // 关键：不仅要 overflow 是 auto/scroll，而且要确实比它的父级或者视口高
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
            
            if (text.length > 0) collectedData.set(turn.id, {role, text});
        });
    }

    function download(text, name) {
        const blob = new Blob([text], {type: 'text/plain;charset=utf-8'});
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