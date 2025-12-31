// ==UserScript==
// @name         Google AI Studio Exporter
// @name:zh-CN   Google AI Studio 对话导出器
// @namespace    https://github.com/GhostXia/Google-AI-Studio-Exporter
// @version      1.5.0
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
// @grant        unsafeWindow
// @connect      cdnjs.cloudflare.com
// @connect      cdn.jsdelivr.net
// @connect      unpkg.com
// @connect      lh3.googleusercontent.com
// @connect      googleusercontent.com
// @connect      storage.googleapis.com
// @connect      gstatic.com
// ==/UserScript==

// Capture JSZip loaded by @require outside IIFE (avoid sandbox scope issues) / 在 IIFE 外部捕获 @require 加载的 JSZip（避免沙盒作用域问题）
/* global JSZip */
const _JSZipRef = (typeof JSZip !== 'undefined') ? JSZip : null;

(function () {
    'use strict';

    const DEBUG = false;
    const dlog = (...args) => { if (DEBUG) console.log(...args); };
    const debugLog = dlog; // Alias for compatibility / 兼容性别名

    const Constants = {
        IMG_REGEX: /!\[([^\]]*)\]\((.+?)(\s+["'][^"']*["'])?\)/g,
        LINK_REGEX: /\[([^\]]*)\]\((.+?)(\s+["'][^"']*["'])?\)/g,
        ROLE_USER: 'User',
        ROLE_GEMINI: 'Gemini',
        ROLE_GEMINI_THOUGHTS: 'Gemini-Thoughts',
        ATTACHMENT_COMBINED_FALLBACK: true,
        ATTACHMENT_MAX_DIST: 10,
        ATTACHMENT_SCAN_CONCURRENCY: 5,
        DISABLE_SCRIPT_INJECTION: false,
        JSZIP_URLS: [
            'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
            'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
            'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js'
        ]
    };

    dlog('[AI Studio Exporter] Script started');

    // ==========================================
    // -1. Network Interceptor (XHR Mode)
    // ==========================================
    const ChatDataStore = {
        data: new Map(), // Map<turnId, {role, text, thoughts, attachments}>
        order: [],       // Array<turnId>
        hasData: false,
        listeners: [],

        subscribe(callback) {
            this.listeners.push(callback);
        },

        notify() {
            this.listeners.forEach(cb => cb(this.order.length));
        },

        addTurn(id, role, content) {
            if (!id) return;
            const existing = this.data.get(id) || { role };

            // Only update if new content is present and not empty / 仅在有新内容且不为空时更新
            if (content.text && content.text.length > 0) existing.text = content.text;
            if (content.thoughts && content.thoughts.length > 0) existing.thoughts = content.thoughts;

            if (content.attachments && content.attachments.length > 0) {
                const prev = existing.attachments || [];
                // Merge and deduplicate attachments / 合并并去重附件
                const newAttachments = content.attachments.filter(a => !prev.includes(a));
                if (newAttachments.length > 0) {
                    existing.attachments = [...prev, ...newAttachments];
                }
            }

            this.data.set(id, existing);
            if (!this.order.includes(id)) {
                this.order.push(id);
                // Sort order based on ID if possible, or rely on insertion order / 如果可能，基于 ID 排序，否则依赖插入顺序
                // For now insertion order is fine as we usually get data sequentially / 目前插入顺序即可，因为通常是按顺序获取数据
            }
            this.hasData = true;
            this.notify();
            dlog('[NetworkInterceptor] Captured/Updated turn:', id, role);
        },

        clear() {
            this.data.clear();
            this.order = [];
            this.hasData = false;
            this.notify();
        }
    };

    const NetworkInterceptor = {
        originalXHR: window.XMLHttpRequest,
        originalFetch: window.fetch,

        init() {
            this.hookXHR();
            this.hookFetch();
            dlog('[NetworkInterceptor] Initialized');
        },

        hookXHR() {
            const self = this;
            const XHR = window.XMLHttpRequest;
            const open = XHR.prototype.open;
            const send = XHR.prototype.send;

            XHR.prototype.open = function (method, url) {
                this._url = url;
                return open.apply(this, arguments);
            };

            XHR.prototype.send = function (body) {
                this.addEventListener('load', function () {
                    self.handleResponse(this._url, this.responseText);
                });
                return send.apply(this, arguments);
            };
        },

        hookFetch() {
            const self = this;
            window.fetch = async function (input, init) {
                const response = await self.originalFetch.apply(this, arguments);
                const clone = response.clone();
                const url = (typeof input === 'string') ? input : input.url;

                clone.text().then(text => {
                    self.handleResponse(url, text);
                }).catch(err => dlog('[NetworkInterceptor] Fetch read error:', err));

                return response;
            };
        },

        handleResponse(url, responseText) {
            if (!url || !responseText) return;

            // Check for relevant RPCs / 检查相关的 RPC 请求
            if (url.includes('ResolveDriveResource') ||
                url.includes('CreatePrompt') ||
                url.includes('UpdatePrompt') ||
                url.includes('ListPrompts')) { // Added ListPrompts just in case / 以防万一添加了 ListPrompts

                try {
                    const json = this.parseResponse(responseText);
                    if (json) {
                        this.processData(json);
                    }
                } catch (e) {
                    dlog('[NetworkInterceptor] Parse error:', e);
                }
            }
        },

        parseResponse(text) {
            // Remove XSSI prefix )]}' / 移除 XSSI 前缀 )]}'
            const clean = text.replace(/^\)\]\}'/, '').trim();
            try {
                return JSON.parse(clean);
            } catch (e) {
                return null;
            }
        },

        processData(json) {
            // Use the ported recursive search to find the history array / 使用移植的递归搜索查找历史数组
            let historyArray = null;

            // Normalize structure: ResolveDriveResource returns [[...]], others return [...] / 规范化结构：ResolveDriveResource 返回 [[...]]，其他返回 [...]
            // Wrap to [[...]] format so we can search consistently / 包装为 [[...]] 格式以便一致搜索
            // But wait, findHistoryRecursive handles nested arrays. / 等等，findHistoryRecursive 会处理嵌套数组。

            // Check if it's a single turn update (CreatePrompt/UpdatePrompt) or full history / 检查是单回合更新还是完整历史
            // Usually full history is deep inside. / 通常完整历史在深层结构中。

            historyArray = findHistoryRecursive(json);

            if (!historyArray) {
                // If not found, maybe it's a flat array of turns? / 如果未找到，也许是扁平的回合数组？
                if (Array.isArray(json) && json.some(isTurn)) {
                    historyArray = json;
                }
            }

            if (historyArray) {
                dlog(`[NetworkInterceptor] Found history with ${historyArray.length} items.`);

                // Process each turn
                historyArray.forEach((turn, index) => {
                    if (!Array.isArray(turn)) return;

                    // Identify Role / 识别角色
                    let role = 'unknown';
                    if (turn.includes('user')) role = 'user';
                    else if (turn.includes('model')) role = 'model';

                    // Extract Content / 提取内容
                    const text = extractTextFromTurn(turn);

                    // Extract Thinking (if model) / 提取思考过程（如果是模型）
                    let thought = null;
                    if (role === 'model' && isThinkingTurn(turn)) {
                        thought = text; // In this schema, thinking is the main text of a thinking turn / 在此架构中，思考是思考回合的主文本
                        // Wait, isThinkingTurn checks index 19. / 等等，isThinkingTurn 检查索引 19。
                        // If it's a thinking turn, the text extracted IS the thought. / 如果是思考回合，提取的文本就是思考内容。
                    }

                    // Generate a stable ID based on content hash or index if possible / 如果可能，基于内容哈希或索引生成稳定 ID
                    // Since we don't have a clear ID in the array, we use a combination of role and index/content / 由于数组中没有明确 ID，我们结合角色和索引/内容
                    // But wait, we need to deduplicate. / 等等，我们需要去重。
                    // The 'turn' array object reference itself might be stable if we were holding it, but we are parsing fresh JSON. / 如果我们持有它，'turn' 数组对象引用本身可能是稳定的，但我们正在解析新鲜的 JSON。
                    // Let's use a simple hash of the content as ID for now, or just append to list. / 目前使用内容的简单哈希作为 ID，或者直接追加到列表。
                    // Actually, ChatDataStore uses ID. / 实际上，ChatDataStore 使用 ID。
                    // Let's generate an ID: `${role}_${index}_${text.substring(0, 20)}` / 生成 ID
                    // This is risky if order changes. / 如果顺序改变，这会有风险。
                    // Better: Use a global counter or just rely on the order in the array. / 更好：使用全局计数器或仅依赖数组中的顺序。

                    // REVISION: The reference script just dumps the whole JSON. / 修订：参考脚本只是转储整个 JSON。
                    // But we want to support our existing UI which expects structured data. / 但我们希望支持现有的需要结构化数据的 UI。
                    // Let's map it to our structure. / 让我们将其映射到我们的结构。

                    const id = `turn_${Date.now()}_${index}`; // Temporary ID / 临时 ID

                    // We need to handle "Thinking" vs "Response" / 我们需要处理“思考”与“响应”
                    // The reference script treats them as separate turns in the array. / 参考脚本将它们视为数组中的独立回合。
                    // Our ChatDataStore expects { role, text, thoughts } / 我们的 ChatDataStore 期望 { role, text, thoughts }
                    // We might need to merge them. / 我们可能需要合并它们。

                    // Strategy: / 策略：
                    // 1. If User -> New Entry / 1. 如果是用户 -> 新条目
                    // 2. If Model Thinking -> New Entry / 2. 如果是模型思考 -> 新条目
                    //    Actually, Gemini 2.0 Flash Thinking returns thinking as a separate turn BEFORE the response turn? / 实际上，Gemini 2.0 Flash Thinking 在响应回合之前返回思考作为独立回合？
                    //    Or is it a single turn with multiple parts? / 或者是具有多个部分的单回合？
                    //    Reference script says: "Thinking-only turn, buffer it for the next response" / 参考脚本说：“仅思考回合，为下一个响应缓冲它”

                    // So we should store them as they are, and let the export logic handle the merging. / 所以我们应该按原样存储它们，让导出逻辑处理合并。
                    // ChatDataStore.addTurn(id, role, { text, thoughts: thought })

                    // Wait, if it's a thinking turn, 'text' is the thought. / 等等，如果是思考回合，'text' 就是思考内容。
                    // So:
                    if (thought) {
                        ChatDataStore.addTurn(id, role, { text: '', thoughts: thought });
                    } else {
                        ChatDataStore.addTurn(id, role, { text: text });
                    }
                });

                // Since we are getting a full snapshot (usually), we might want to clear old data?
                // ResolveDriveResource is full history. CreatePrompt is append.
                // But we don't know which is which easily without URL context.
                // Let's assume if we find a LARGE history (>1), it's a full reload. / 假设如果我们发现大型历史（>1），则是完整重载。
                if (historyArray.length > 2) {
                    // Optional: ChatDataStore.clear(); 
                    // But user might have scrolled back.
                    // Let's just append/update.
                }
            } else {
                dlog('[NetworkInterceptor] Could not find history in JSON.');
            }
        }
    };

    NetworkInterceptor.init();

    // ==========================================
    // 1. i18n (Translations)
    // ==========================================
    const translations = {
        'zh': {
            'btn_export': '🚀 导出',
            'title_ready': '准备就绪',
            'status_init': '正在初始化...',
            'btn_save': '💾 保存',
            'btn_close': '关闭',
            'title_countdown': '准备开始',
            'status_countdown': '请松开鼠标！<br><span class="ai-red">自动滚动将在 {s} 秒后开始</span>',
            'title_scrolling': '正在导出...',
            'status_scrolling': '正在向下滚动并抓取内容。<br>按 <b>ESC</b> 停止并保存。',
            'title_finished': '🎉 完成',
            'status_finished': '文件已生成。<br>请检查下载内容。',
            'title_error': '❌ 错误',
            'title_mode_select': '选择导出模式',
            'status_mode_select': '请选择导出格式',
            'btn_mode_full': '📦 带附件 (ZIP)',
            'btn_mode_text': '📄 仅文本 (Markdown)',
            'file_header': 'Google AI Studio 聊天记录',
            'file_time': '时间',
            'file_count': '统计',
            'file_turns': '回合数',
            'file_paragraphs': '输出段落数',
            'role_user': '用户',
            'role_gemini': 'Gemini',
            'role_thoughts': '思考过程',
            'err_no_scroller': '未找到滚动容器。请尝试刷新页面或手动滚动一下。',
            'err_no_data': '未收集到对话数据。请检查页面是否有聊天内容。',
            'err_runtime': '运行时错误: ',
            'status_packaging_images': '正在打包 {n} 张图片...',
            'status_packaging_images_progress': '打包图片: {c}/{t}',
            'status_packaging_files': '正在打包 {n} 个文件...',
            'status_packaging_files_progress': '打包文件: {c}/{t}',
            'ui_turns': '回合数',
            'ui_paragraphs': '输出段落数',
            'title_zip_missing': 'JSZip 加载失败',
            'status_zip_missing': '无法加载附件打包库。是否回退到纯文本？',
            'btn_retry': '重试',
            'btn_cancel': '取消',
            'status_esc_hint': '按 <b>ESC</b> 可取消并选择保存方式',
            'title_cancel': '已取消导出',
            'status_cancel': '请选择继续打包附件或改为纯文本保存',
            'banner_top': '📎 附件已合并为 Markdown 链接（纯文本导出）',
            'attachments_section': '附件',
            'attachments_link_unavailable': '链接不可用',
            'btn_settings': '⚙️ 设置',
            'title_settings': '设置',
            'label_extraction_mode': '导出模式',
            'mode_xhr': 'XHR (极速)',
            'mode_dom': 'DOM (滚动)',
            'desc_xhr': '拦截网络请求。速度快，无需滚动。',
            'desc_dom': '模拟滚动抓取。速度慢，作为备用。',
            'warn_xhr_no_data': '未检测到网络数据。请刷新页面以重新捕获，或切换到 DOM 模式。',
            'label_thinking': '思考过程',
            'option_include_thinking': '包含思考过程',
            'option_collapsible_thinking': '折叠思考过程 (Details)',
            'btn_mode_html': 'HTML 导出',
            'hint_full': '（含图片/附件）'
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
            'file_turns': 'Turns',
            'file_paragraphs': 'Output paragraphs',
            'role_user': 'User',
            'role_gemini': 'Gemini',
            'role_thoughts': 'Thoughts',
            'err_no_scroller': 'Scroll container not found. Try refreshing or scrolling manually.',
            'err_no_data': 'No conversation data was collected. Please check if the page has any chat content.',
            'err_runtime': 'Runtime Error: ',
            'status_packaging_images': 'Packaging {n} images...',
            'status_packaging_images_progress': 'Packaging images: {c}/{t}',
            'status_packaging_files': 'Packaging {n} files...',
            'status_packaging_files_progress': 'Packaging files: {c}/{t}',
            'ui_turns': 'Turns',
            'ui_paragraphs': 'Output paragraphs',
            'title_zip_missing': 'JSZip load failed',
            'status_zip_missing': 'Could not load ZIP library. Fallback to text?',
            'btn_retry': 'Retry',
            'btn_cancel': 'Cancel',
            'status_esc_hint': 'Press <b>ESC</b> to cancel and choose how to save',
            'title_cancel': 'Export cancelled',
            'status_cancel': 'Choose to continue attachments or save as text',
            'banner_top': '📎 Attachments merged as Markdown links (Text-only export)',
            'attachments_section': 'Attachments',
            'attachments_link_unavailable': 'link unavailable',
            'btn_settings': '⚙️ Settings',
            'title_settings': 'Settings',
            'label_extraction_mode': 'Extraction Mode',
            'mode_xhr': 'XHR (Instant)',
            'mode_dom': 'DOM (Scroll)',
            'desc_xhr': 'Intercepts network requests. Fast, no scrolling.',
            'desc_dom': 'Scrolls through page. Slower, fallback.',
            'warn_xhr_no_data': 'No network data found. Please reload the page to capture history, or switch to DOM mode.',
            'label_thinking': 'Thinking Process',
            'option_include_thinking': 'Include Thinking',
            'option_collapsible_thinking': 'Collapsible Thinking',
            'btn_mode_html': 'HTML Export',
            'hint_full': '(w/ Images)'
        }
    };

    const lang = navigator.language.startsWith('zh') ? 'zh' : 'en';

    function t(key, params = {}) {
        let str = translations[lang][key] || key;
        if (typeof params !== 'object' || params === null) {
            str = str.replace(/{s}/g, params);
            return str;
        }
        for (const pKey in params) {
            str = str.replace(new RegExp(`\\{${pKey}\\}`, 'g'), params[pKey]);
        }
        return str;
    }

    // ==========================================
    // 2. AppSettings
    // ==========================================
    const AppSettings = {
        get mode() { return localStorage.getItem('ai_exporter_mode') || 'xhr'; },
        set mode(val) { localStorage.setItem('ai_exporter_mode', val); },

        get includeThinking() { return localStorage.getItem('ai_exporter_thinking') !== 'false'; }, // Default true / 默认为 true
        set includeThinking(val) { localStorage.setItem('ai_exporter_thinking', val); },

        get collapsibleThinking() { return localStorage.getItem('ai_exporter_collapsible') !== 'false'; }, // Default true / 默认为 true
        set collapsibleThinking(val) { localStorage.setItem('ai_exporter_collapsible', val); }
    };

    // ==========================================
    // 3. Helper Functions
    // ==========================================
    function isTurn(arr) {
        if (!Array.isArray(arr)) return false;
        return arr.includes('user') || arr.includes('model');
    }

    function findHistoryRecursive(node, depth = 0) {
        if (depth > 4) return null;
        if (!Array.isArray(node)) return null;

        const firstFew = node.slice(0, 5);
        const childrenAreTurns = firstFew.some(child => isTurn(child));

        if (childrenAreTurns) {
            dlog(`[Helper] Found history at depth ${depth}. Contains ${node.length} items.`);
            return node;
        }

        for (const child of node) {
            if (Array.isArray(child)) {
                const result = findHistoryRecursive(child, depth + 1);
                if (result) return result;
            }
        }
        return null;
    }

    function extractTextFromTurn(turn) {
        let candidates = [];

        function scan(item, d = 0) {
            if (d > 3) return;
            if (typeof item === 'string' && item.length > 1) {
                if (!['user', 'model', 'function'].includes(item)) candidates.push(item);
            } else if (Array.isArray(item)) {
                item.forEach(sub => scan(sub, d + 1));
            }
        }

        scan(turn.slice(0, 3));
        return candidates.sort((a, b) => b.length - a.length)[0] || "";
    }

    function isThinkingTurn(turn) {
        return Array.isArray(turn) && turn.length > 19 && turn[19] === 1;
    }

    function isResponseTurn(turn) {
        return Array.isArray(turn) && turn.length > 16 && turn[16] === 1;
    }


    // ==========================================
    // 4. UIManager
    // ==========================================
    const UIManager = {
        overlay: null,
        titleEl: null,
        statusEl: null,
        countEl: null,
        closeBtn: null,
        saveBtn: null,
        settingsBtn: null,

        init() {
            if (document.getElementById('ai-overlay-v14')) {
                this.overlay = document.getElementById('ai-overlay-v14');
                this.overlay.style.display = 'flex';
                this.bindElements();
                return;
            }
            this.overlay = document.createElement('div');
            this.overlay.id = 'ai-overlay-v14';
            this.overlay.innerHTML = `
            <div id="ai-box">
                <div class="ai-title">${t('title_ready')}</div>
                <div class="ai-banner">${t('banner_top')}</div>
                <div class="ai-status">${t('status_init')}</div>
                <div class="ai-count">0</div>
                <div class="ai-btn-container">
                    <button id="ai-save-btn" class="ai-btn">${t('btn_save')}</button>
                    <button id="ai-settings-btn" class="ai-btn ai-btn-secondary">${t('btn_settings')}</button>
                    <button id="ai-close-btn" class="ai-btn ai-btn-secondary">${t('btn_close')}</button>
                </div>
            </div>
        `;
            document.body.appendChild(this.overlay);
            this.bindElements();
        },

        bindElements() {
            this.titleEl = this.overlay.querySelector('.ai-title');
            this.statusEl = this.overlay.querySelector('.ai-status');
            this.countEl = this.overlay.querySelector('.ai-count');
            this.closeBtn = this.overlay.querySelector('#ai-close-btn');
            this.saveBtn = this.overlay.querySelector('#ai-save-btn');
            this.settingsBtn = this.overlay.querySelector('#ai-settings-btn');

            this.closeBtn.onclick = () => { this.overlay.style.display = 'none'; };
            this.settingsBtn.onclick = () => { this.showSettingsPanel(); };
            this.saveBtn.onclick = () => ExporterCore.save();
        },

        update(state, msg = "") {
            this.init();
            const btnContainer = this.overlay.querySelector('.ai-btn-container');
            btnContainer.style.display = 'none';
            btnContainer.querySelectorAll('.ai-mode-btn').forEach(btn => btn.style.display = 'none');

            if (state === 'READY') {
                this.titleEl.innerText = t('title_ready');
                this.statusEl.innerHTML = t('status_init');
                this.countEl.style.display = 'none';
                this.countEl.innerText = '0';
                btnContainer.style.display = 'flex';
                if (this.saveBtn) this.saveBtn.style.display = 'inline-block';
                if (this.settingsBtn) this.settingsBtn.style.display = 'inline-block';
                this.closeBtn.style.display = 'inline-block';
            } else if (state === 'COUNTDOWN') {
                this.titleEl.innerText = t('title_countdown');
                this.statusEl.innerHTML = t('status_countdown', msg);
                this.countEl.style.display = 'none';
                this.countEl.innerText = '';
            } else if (state === 'SCROLLING') {
                this.titleEl.innerText = t('title_scrolling');
                this.statusEl.innerHTML = t('status_scrolling');
                this.countEl.style.display = 'block';
                const { turns, paragraphs } = ExporterCore.getCounts();
                this.countEl.innerText = `${t('ui_turns')}: ${turns}\n${t('ui_paragraphs')}: ${paragraphs}`;
            } else if (state === 'PACKAGING') {
                this.titleEl.innerText = t('title_scrolling');
                this.statusEl.innerHTML = msg + '<br>' + t('status_esc_hint');
                this.countEl.style.display = 'none';
            } else if (state === 'FINISHED') {
                this.titleEl.innerText = t('title_finished');
                this.statusEl.innerHTML = t('status_finished');
                const { turns, paragraphs } = ExporterCore.getCounts();
                this.countEl.innerText = `${t('ui_turns')}: ${turns}\n${t('ui_paragraphs')}: ${paragraphs}`;
                btnContainer.style.display = 'flex';
                this.saveBtn.style.display = 'inline-block';
                this.closeBtn.style.display = 'inline-block';
            } else if (state === 'ERROR') {
                this.titleEl.innerText = t('title_error');
                this.statusEl.innerHTML = `<span class="ai-red">${msg}</span>`;
                btnContainer.style.display = 'flex';
                this.closeBtn.style.display = 'inline-block';
            }
        },

        showModeSelection() {
            return new Promise((resolve, reject) => {
                this.init();
                this.titleEl.innerText = t('title_mode_select');
                this.statusEl.innerHTML = t('status_mode_select');
                this.countEl.innerText = '';

                const btnContainer = this.overlay.querySelector('.ai-btn-container');
                if (this.saveBtn) this.saveBtn.style.display = 'none';
                if (this.closeBtn) this.closeBtn.style.display = 'none';

                btnContainer.style.display = 'flex';
                btnContainer.querySelectorAll('.ai-mode-btn').forEach(btn => btn.remove());
                btnContainer.querySelectorAll('.ai-hint').forEach(el => el.remove());

                const createModeButton = (id, text, isPrimary, onClick) => {
                    const btn = document.createElement('button');
                    btn.id = id;
                    btn.className = (isPrimary ? 'ai-btn' : 'ai-btn ai-btn-secondary') + ' ai-mode-btn';
                    btn.textContent = text;
                    btn.onclick = onClick;
                    btnContainer.appendChild(btn);
                    return btn;
                };

                // Full Export (Markdown + Zip) / 完整导出 (Markdown + Zip)
                const fullBtn = createModeButton('ai-mode-full', t('btn_mode_full'), true, () => {
                    ExporterCore.exportMode = 'full';
                    resolve('full');
                });
                // fullBtn.disabled = true; // Re-enable if previously disabled / 如果之前禁用了，重新启用
                const fullHint = document.createElement('span');
                fullHint.className = 'ai-hint';
                fullHint.textContent = t('hint_full');
                fullHint.style.fontSize = '12px';
                fullHint.style.color = '#888';
                fullHint.style.marginLeft = '5px';
                fullHint.style.marginRight = '15px';
                btnContainer.appendChild(fullHint);

                // HTML Export / HTML 导出
                createModeButton('ai-mode-html', t('btn_mode_html'), false, () => {
                    ExporterCore.exportMode = 'html';
                    resolve('html');
                });

                // Text Export (Markdown) / 文本导出 (Markdown)
                createModeButton('ai-mode-text', t('btn_mode_text'), false, () => {
                    ExporterCore.exportMode = 'text';
                    resolve('text');
                });

                createModeButton('ai-mode-close', t('btn_close'), false, () => {
                    this.overlay.style.display = 'none';
                    reject(new Error('Export cancelled by user.'));
                });
            });
        },

        showSettingsPanel() {
            this.init();
            this.titleEl.innerText = t('title_settings');
            this.statusEl.innerHTML = '';
            this.countEl.innerText = '';

            const btnContainer = this.overlay.querySelector('.ai-btn-container');
            btnContainer.style.display = 'flex';
            if (this.saveBtn) this.saveBtn.style.display = 'none';
            if (this.settingsBtn) this.settingsBtn.style.display = 'none';
            if (this.closeBtn) this.closeBtn.style.display = 'none';

            let settingsContainer = this.overlay.querySelector('.ai-settings-container');
            if (settingsContainer) settingsContainer.remove();

            settingsContainer = document.createElement('div');
            settingsContainer.className = 'ai-settings-container';
            settingsContainer.style.textAlign = 'left';
            settingsContainer.style.marginBottom = '20px';
            settingsContainer.style.color = '#5f6368';

            const createCheckbox = (id, label, checked, onChange) => {
                const wrapper = document.createElement('div');
                wrapper.style.marginBottom = '10px';
                wrapper.style.display = 'flex';
                wrapper.style.alignItems = 'center';

                const input = document.createElement('input');
                input.type = 'checkbox';
                input.id = id;
                input.checked = checked;
                input.style.marginRight = '10px';
                input.style.transform = 'scale(1.2)';
                input.onchange = (e) => onChange(e.target.checked);

                const lbl = document.createElement('label');
                lbl.htmlFor = id;
                lbl.textContent = label;
                lbl.style.fontSize = '15px';
                lbl.style.cursor = 'pointer';

                wrapper.appendChild(input);
                wrapper.appendChild(lbl);
                return wrapper;
            };

            // Extraction Mode / 提取模式
            const modeLabel = document.createElement('div');
            modeLabel.textContent = t('label_extraction_mode');
            modeLabel.style.fontWeight = 'bold';
            modeLabel.style.marginBottom = '8px';
            settingsContainer.appendChild(modeLabel);

            const modeSelect = document.createElement('select');
            modeSelect.style.width = '100%';
            modeSelect.style.padding = '8px';
            modeSelect.style.marginBottom = '16px';
            modeSelect.style.borderRadius = '8px';
            modeSelect.style.border = '1px solid #ccc';
            modeSelect.style.fontSize = '14px';

            const optXhr = document.createElement('option');
            optXhr.value = 'xhr';
            optXhr.textContent = t('mode_xhr');
            const optDom = document.createElement('option');
            optDom.value = 'dom';
            optDom.textContent = t('mode_dom');

            modeSelect.appendChild(optXhr);
            modeSelect.appendChild(optDom);
            modeSelect.value = AppSettings.mode;

            modeSelect.onchange = (e) => {
                AppSettings.mode = e.target.value;
            };
            settingsContainer.appendChild(modeSelect);

            // Thinking Options / 思考选项
            const thinkingLabel = document.createElement('div');
            thinkingLabel.textContent = t('label_thinking');
            thinkingLabel.style.fontWeight = 'bold';
            thinkingLabel.style.marginBottom = '8px';
            settingsContainer.appendChild(thinkingLabel);

            settingsContainer.appendChild(createCheckbox(
                'ai-opt-thinking',
                t('option_include_thinking'),
                AppSettings.includeThinking,
                (val) => AppSettings.includeThinking = val
            ));

            settingsContainer.appendChild(createCheckbox(
                'ai-opt-collapsible',
                t('option_collapsible_thinking'),
                AppSettings.collapsibleThinking,
                (val) => AppSettings.collapsibleThinking = val
            ));

            this.statusEl.appendChild(settingsContainer);

            // Back Button / 返回按钮
            const backBtn = document.createElement('button');
            backBtn.className = 'ai-btn ai-btn-secondary';
            backBtn.textContent = t('btn_close');
            backBtn.onclick = () => {
                settingsContainer.remove();
                backBtn.remove();
                this.update('READY');
            };
            btnContainer.appendChild(backBtn);
            btnContainer.appendChild(backBtn);
        },

        showToast(message, duration = 3000) {
            const toast = document.createElement('div');
            toast.textContent = message;
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            toast.style.color = '#fff';
            toast.style.padding = '10px 20px';
            toast.style.borderRadius = '5px';
            toast.style.zIndex = '10001';
            toast.style.fontSize = '14px';
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';

            document.body.appendChild(toast);
            requestAnimationFrame(() => toast.style.opacity = '1');

            setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 300);
            }, duration);
        },

        createEntryButton() {
            if (document.getElementById('ai-exporter-btn')) {
                this.updateBadge();
                return;
            }
            const btn = document.createElement('button');
            btn.id = 'ai-exporter-btn';
            btn.innerHTML = t('btn_export');
            btn.style.position = 'fixed';
            btn.style.bottom = '20px';
            btn.style.right = '20px';
            btn.style.zIndex = '9999';
            btn.style.padding = '10px 20px';
            btn.style.borderRadius = '25px';
            btn.style.border = 'none';
            btn.style.backgroundColor = '#0b57d0';
            btn.style.color = 'white';
            btn.style.cursor = 'pointer';
            btn.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
            btn.style.fontSize = '14px';
            btn.style.fontWeight = '500';
            btn.style.transition = 'transform 0.2s, background-color 0.2s';

            btn.onmouseover = () => { btn.style.backgroundColor = '#0842a0'; btn.style.transform = 'scale(1.05)'; };
            btn.onmouseout = () => { btn.style.backgroundColor = '#0b57d0'; btn.style.transform = 'scale(1)'; };
            btn.onclick = () => ExporterCore.start();

            const badge = document.createElement('div');
            badge.id = 'ai-exporter-badge';
            badge.style.position = 'absolute';
            badge.style.top = '-5px';
            badge.style.right = '-5px';
            badge.style.backgroundColor = '#ea4335';
            badge.style.color = 'white';
            badge.style.borderRadius = '50%';
            badge.style.width = '20px';
            badge.style.height = '20px';
            badge.style.fontSize = '11px';
            badge.style.display = 'none';
            badge.style.alignItems = 'center';
            badge.style.justifyContent = 'center';
            badge.style.fontWeight = 'bold';
            badge.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
            btn.appendChild(badge);

            document.body.appendChild(btn);
            this.updateBadge();

            // Subscribe to data updates / 订阅数据更新
            ChatDataStore.subscribe((count) => this.updateBadge(count));
        },

        updateBadge(count) {
            const badge = document.getElementById('ai-exporter-badge');
            if (!badge) return;
            const currentCount = count !== undefined ? count : ChatDataStore.order.length;
            if (currentCount > 0) {
                badge.textContent = currentCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    };

    // ==========================================
    // 5. ExporterCore
    // ==========================================
    const ExporterCore = {
        isRunning: false,
        hasFinished: false,
        collectedData: new Map(),
        turnOrder: [],
        processedTurnIds: new Set(),
        scannedAttachmentTurns: new Set(),
        exportMode: null,
        cachedBlob: null,
        cancelRequested: false,

        reset() {
            this.collectedData.clear();
            this.turnOrder = [];
            this.processedTurnIds.clear();
            this.scannedAttachmentTurns.clear();
            this.cachedBlob = null;
            this.cancelRequested = false;
            this.hasFinished = false;
            this.isRunning = false;
        },

        updateTurnOrder(newIds) {
            // Merge new IDs into turnOrder, maintaining relative order / 将新 ID 合并到 turnOrder，保持相对顺序
            // This is simple append for now, but ideally should respect DOM order / 目前只是简单追加，但理想情况下应遵循 DOM 顺序
            // Since we scroll down, appending is usually correct. / 因为我们向下滚动，追加通常是正确的。
            // But if we jump, we might need to be smarter. / 但如果我们跳转，可能需要更聪明些。
            // For now, we just append new ones. / 目前我们只追加新的。
            for (const id of newIds) {
                if (!this.turnOrder.includes(id)) {
                    this.turnOrder.push(id);
                }
            }
        },

        getCounts() {
            const turns = this.turnOrder.length;
            let paragraphs = 0;
            for (const id of this.turnOrder) {
                const item = this.collectedData.get(id);
                if (!item) continue;
                if (item.role === Constants.ROLE_GEMINI && item.thoughts) paragraphs++;
                const textOut = (item.text || '').trim();
                if (textOut.length > 0) {
                    if (item.role !== Constants.ROLE_USER) {
                        paragraphs++;
                    }
                }
            }
            return { turns, paragraphs };
        },

        async start() {
            await startProcess();
        },

        async save() {
            if (this.cachedBlob) {
                this.downloadBlob(this.cachedBlob, `Gemini_Chat_v14_${Date.now()}.${this.exportMode === 'full' ? 'zip' : 'md'}`);
                return;
            }
            try {
                const result = await downloadCollectedData();
                if (!result) {
                    UIManager.update('ERROR', t('err_no_data'));
                }
            } catch (err) {
                console.error("Failed to re-download file:", err);
                UIManager.update('ERROR', t('err_runtime') + err.message);
            }
        },

        downloadBlob(blob, filename) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },

        initSessionMonitor() {
            let lastUrl = window.location.href;
            setInterval(() => {
                const currentUrl = window.location.href;
                if (currentUrl !== lastUrl) {
                    lastUrl = currentUrl;
                    this.handleSessionChange();
                }
            }, 1000);
        },

        handleSessionChange() {
            dlog('[ExporterCore] Session changed, resetting state.');
            this.reset();
            ChatDataStore.clear();
            UIManager.showToast(t('status_init')); // Re-using init message / 复用初始化消息
            // Ideally we should update the UI to reflect 0 items / 理想情况下我们应该更新 UI 以反映 0 个项目
            UIManager.update('READY');
        }
    };

    // ==========================================
    // 6. DOMScraper
    // ==========================================
    const DOMScraper = {
        findScroller() {
            const bubble = document.querySelector('main ms-chat-turn') || document.querySelector('ms-chat-turn');
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
        },

        async toggleRawMode() {
            // Placeholder for now, will be implemented fully later / 占位符，稍后完整实现
            return false;
        }
    };

    // ==========================================
    // 7. 核心流程
    // ==========================================
    async function startProcess() {
        if (ExporterCore.isRunning) return;
        ExporterCore.reset();

        autoFixFormFieldAttributes();

        // Check Extraction Mode / 检查提取模式
        if (AppSettings.mode === 'xhr') {
            if (ChatDataStore.hasData) {
                // Transfer data / 转移数据
                ExporterCore.collectedData = new Map(ChatDataStore.data);
                ExporterCore.turnOrder = [...ChatDataStore.order];
                ExporterCore.processedTurnIds = new Set(ExporterCore.turnOrder);

                // Show mode selection for export format (Full vs Text) / 显示导出格式的模式选择（完整 vs 文本）
                try {
                    await UIManager.showModeSelection();
                } catch (e) {
                    dlog('Export cancelled.');
                    return;
                }

                ExporterCore.isRunning = true;
                endProcess("FINISHED");
                return;
            } else {
                UIManager.update('ERROR', t('warn_xhr_no_data'));
                return;
            }
        }

        // DOM Mode (Fallback) / DOM 模式（备用）
        try {
            await UIManager.showModeSelection();
        } catch (e) {
            dlog('Export cancelled.');
            return;
        }

        ExporterCore.isRunning = true;

        for (let i = 3; i > 0; i--) {
            UIManager.update('COUNTDOWN', i);
            await sleep(1000);
        }

        let scroller = DOMScraper.findScroller();

        // Mobile enhancement / 移动端增强
        if (!scroller || scroller.scrollHeight <= scroller.clientHeight) {
            dlog("尝试主动激活滚动容器...");
            window.scrollBy(0, 1);
            await sleep(100);
            scroller = DOMScraper.findScroller();
        }

        if (!scroller || scroller.scrollHeight <= scroller.clientHeight) {
            dlog("尝试触摸激活...");
            const bubble = document.querySelector('ms-chat-turn');
            if (bubble) {
                bubble.scrollIntoView({ behavior: 'instant' });
                await sleep(200);
                scroller = DOMScraper.findScroller();
            }
        }

        if (!scroller) {
            endProcess("ERROR", t('err_no_scroller'));
            return;
        }

        UIManager.update('SCROLLING', 0);

        // Toggle Raw Mode / 切换 Raw Mode
        let rawModeToggled = false;
        if (AppSettings.mode === 'dom') {
            rawModeToggled = await DOMScraper.toggleRawMode();
            if (!rawModeToggled) {
                dlog("Raw Mode toggle failed, continuing with Rendered Mode...");
            } else {
                await sleep(500);
                scroller = DOMScraper.findScroller();
            }
        }

        // Smart Jump / 智能跳转
        dlog("尝试使用滚动条按钮跳转到第一个对话...");
        const scrollbarButtons = document.querySelectorAll('button[id^="scrollbar-item-"]');
        if (scrollbarButtons.length > 0) {
            const firstButton = scrollbarButtons[0];
            firstButton.click();
            await sleep(1500);
        } else {
            dlog("未找到滚动条按钮，使用备用方案...");
        }

        // Fallback Scroll Up / 备用向上滚动
        const initialScrollTop = scroller.scrollTop;
        if (initialScrollTop > 500) {
            let currentPos = initialScrollTop;
            let upwardAttempts = 0;
            const maxUpwardAttempts = 15;

            while (currentPos > 100 && upwardAttempts < maxUpwardAttempts) {
                upwardAttempts++;
                const scrollAmount = Math.min(window.innerHeight, currentPos);
                scroller.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
                await sleep(500);
                const newPos = scroller.scrollTop;
                if (Math.abs(newPos - currentPos) < 10) {
                    scroller.scrollTop = Math.max(0, currentPos - scrollAmount);
                    await sleep(300);
                }
                currentPos = scroller.scrollTop;
                if (currentPos < 100) break;
            }
        }

        scroller.scrollTop = 0;
        await sleep(500);
        if (scroller.scrollTop > 10) {
            scroller.scrollTo({ top: 0, behavior: 'instant' });
            await sleep(500);
        }

        await sleep(800);

        let lastScrollTop = -9999;
        let stuckCount = 0;

        try {
            while (ExporterCore.isRunning) {
                await captureData(scroller);
                UIManager.update('SCROLLING', ExporterCore.collectedData.size);

                scroller.scrollBy({ top: window.innerHeight * 0.7, behavior: 'smooth' });

                await sleep(900);

                const currentScroll = scroller.scrollTop;

                if (Math.abs(currentScroll - lastScrollTop) <= 2) {
                    stuckCount++;
                    if (stuckCount >= 3) {
                        dlog("判定到底", currentScroll);
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
            if (rawModeToggled) await DOMScraper.toggleRawMode();
            return;
        }

        if (rawModeToggled) {
            await DOMScraper.toggleRawMode();
        }

        endProcess("FINISHED");
    }

    function autoFixFormFieldAttributes() {
        try {
            const fields = document.querySelectorAll(
                'input[autocomplete]:not([name]), textarea[autocomplete]:not([name]), select[autocomplete]:not([name])'
            );
            let i = 0;
            fields.forEach(el => {
                const nm = 'ai_exporter_field_' + (i++);
                el.setAttribute('name', nm);
            });
            if (fields.length > 0) dlog('Auto-assigned name for ' + fields.length + ' form fields');
        } catch (_) { }
    }

    // ==========================================
    // 5. 辅助功能
    // ==========================================





    function normalizeHref(href) {
        try {
            const raw = String(href || '').trim();
            if (!raw || raw === '#') return '';
            const u = new URL(raw, window.location.href);
            return u.href;
        } catch (_) {
            return '';
        }
    }

    function filterHref(href) {
        if (!href) return false;
        const lower = href.toLowerCase();
        if (lower.startsWith('http:') || lower.startsWith('https:')) return true;
        if (Constants.ATTACHMENT_COMBINED_FALLBACK && lower.startsWith('blob:')) return true;
        return false;
    }

    function extractDownloadLinksFromTurn(el) {
        const links = [];
        const isDownloadish = (href, a) => {
            if (!href) return false;
            const h = href.toLowerCase();
            const hasDownloadAttr = !!(a && a.getAttribute('download'));
            const tokenMatch = h.includes('/download') || h.includes('download=true') || h.includes('/dl/');
            const extMatch = /(\.zip|\.pdf|\.png|\.jpe?g|\.gif|\.webp|\.mp4|\.mov|\.tgz|\.tar\.gz|\.exe|\.rar|\.7z|\.csv|\.txt|\.json|\.md|\.xlsx|\.docx)(?:$|[?#])/i.test(h);
            let hostMatch = false;
            try {
                const u = new URL(href, window.location.href);
                const host = u.hostname.toLowerCase();
                hostMatch = [
                    's3.amazonaws.com',
                    'googleapis.com',
                    'storage.googleapis.com',
                    'drive.google.com',
                    'blob.core.windows.net',
                    'googleusercontent.com'
                ].some(domain => host === domain || host.endsWith('.' + domain));
            } catch (_) { }
            const schemeMatch = h.startsWith('blob:') || h.startsWith('data:');
            return hasDownloadAttr || tokenMatch || extMatch || hostMatch || schemeMatch;
        };
        const icons = el.querySelectorAll('span.material-symbols-outlined, span.ms-button-icon-symbol');
        icons.forEach(sp => {
            const txt = (sp.textContent || '').trim().toLowerCase();
            if (txt === 'download' || txt === '下载') {
                const a = sp.closest('a') || sp.parentElement?.querySelector('a[href]');
                const href = normalizeHref(a?.getAttribute('href') || '');
                if (filterHref(href)) links.push(href);
            }
        });
        const anchors = el.querySelectorAll('a[href]');
        anchors.forEach(a => {
            const href = normalizeHref(a.getAttribute('href') || '');
            if (isDownloadish(href, a) && filterHref(href)) links.push(href);
        });
        return Array.from(new Set(links));
    }

    async function captureData(scroller = document) {
        // Scope the query to the scroller container / 将查询范围限定在滚动容器内
        const turns = scroller.querySelectorAll('ms-chat-turn');

        // Helper to derive a stable turn id / 派生稳定回合 ID 的辅助函数
        const getTurnId = (el) => {
            if (el.id) return el.id;
            const chunk = el.querySelector('ms-prompt-chunk[id], ms-response-chunk[id], ms-thought-chunk[id]');
            return chunk ? chunk.id : null;
        };

        // Update turn order based on visible turns / 基于可见回合更新回合顺序
        const visibleTurnIds = Array.from(turns)
            .filter(t => t.offsetParent !== null && window.getComputedStyle(t).visibility !== 'hidden')
            .map(t => getTurnId(t))
            .filter(id => !!id);

        // Remove duplicates while preserving order / 在保留顺序的同时移除重复项
        const uniqueVisibleIds = [...new Set(visibleTurnIds)];
        ExporterCore.updateTurnOrder(uniqueVisibleIds);

        for (const turn of turns) {
            if (turn.offsetParent === null || window.getComputedStyle(turn).visibility === 'hidden') continue;

            const turnId = getTurnId(turn);
            if (!turnId) continue;

            // Skip if already fully processed (text + attachments) / 如果已完全处理（文本 + 附件），则跳过
            if (ExporterCore.processedTurnIds.has(turnId) && ExporterCore.collectedData.get(turnId)?.text) {
                // If we haven't scanned attachments yet, we might want to do that. / 如果尚未扫描附件，我们可能需要这样做。
                // But let's assume if processedTurnIds has it, we are good for text. / 但假设 processedTurnIds 包含它，文本就没问题。
            }

            const isUser = turn.classList.contains('user-turn') || turn.querySelector('.user-label');
            const role = isUser ? Constants.ROLE_USER : Constants.ROLE_GEMINI;

            // Extract Text / 提取文本
            let text = '';
            let thoughts = '';

            if (isUser) {
                const textContainer = turn.querySelector('.text-container, .content-container') || turn;
                text = htmlToMarkdown(textContainer).trim();
            } else {
                // Gemini Turn / Gemini 回合
                // Check for thoughts / 检查思考过程
                const thoughtContainer = turn.querySelector('ms-thought-chunk');
                if (thoughtContainer) {
                    thoughts = htmlToMarkdown(thoughtContainer).trim();
                }

                // Check for response / 检查响应内容
                const responseContainer = turn.querySelector('ms-response-chunk');
                if (responseContainer) {
                    text = htmlToMarkdown(responseContainer).trim();
                } else {
                    // Fallback if no chunks / 如果没有分块则回退
                    const content = turn.querySelector('.model-turn-content') || turn;
                    text = htmlToMarkdown(content).trim();
                }
            }

            // Extract Attachments (Images & Files) / 提取附件（图片和文件）
            let attachments = [];
            if (!ExporterCore.scannedAttachmentTurns.has(turnId)) {
                // Files (Download links) / 文件（下载链接）
                const downloadLinks = extractDownloadLinksFromTurn(turn);
                if (downloadLinks.length > 0) {
                    attachments = downloadLinks;
                }
                ExporterCore.scannedAttachmentTurns.add(turnId);
            } else {
                // Preserve existing attachments if we are updating / 如果正在更新，保留现有附件
                const existing = ExporterCore.collectedData.get(turnId);
                if (existing && existing.attachments) {
                    attachments = existing.attachments;
                }
            }

            // Store data / 存储数据
            const existingData = ExporterCore.collectedData.get(turnId) || {};

            const newText = text || existingData.text || '';
            const newThoughts = thoughts || existingData.thoughts || '';
            const newAttachments = attachments.length > 0 ? attachments : (existingData.attachments || []);

            if (newText || newThoughts || newAttachments.length > 0) {
                ExporterCore.collectedData.set(turnId, {
                    id: turnId,
                    role: role,
                    text: newText,
                    thoughts: newThoughts,
                    attachments: newAttachments,
                    attachmentScanAttempted: true
                });
                ExporterCore.processedTurnIds.add(turnId);
            }
        }
    }

    function htmlToMarkdown(node, listContext = null, indent = 0) {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return '';

        const tag = node.tagName.toLowerCase();

        // Images / 图片
        if (tag === 'img') {
            const alt = node.getAttribute('alt') || '';
            const src = node.getAttribute('src') || '';
            return `![${alt}](${src})`;
        }

        // Code blocks / 代码块
        if (tag === 'pre') {
            const codeEl = node.querySelector('code');
            if (codeEl) {
                const language = Array.from(codeEl.classList).find(c => c.startsWith('language-'))?.replace('language-', '') || '';
                const code = codeEl.textContent;
                return `\n\`\`\`${language}\n${code}\n\`\`\`\n`;
            }
        }

        // Inline code / 行内代码
        if (tag === 'code') {
            const text = node.textContent;
            // Handle backticks inside inline code for correct Markdown rendering. / 处理行内代码中的反引号以确保正确的 Markdown 渲染。
            if (text.includes('`')) {
                return `\`\` ${text} \`\``;
            }
            return `\`${text}\``;
        }

        // Headings / 标题
        if (/^h[1-6]$/.test(tag)) {
            const level = parseInt(tag[1]);
            return '\n' + '#'.repeat(level) + ' ' + getChildrenText(node, listContext, indent) + '\n';
        }

        // Bold / 加粗
        if (tag === 'strong' || tag === 'b') {
            return `**${getChildrenText(node, listContext, indent)}**`;
        }

        // Italic / 斜体
        if (tag === 'em' || tag === 'i') {
            return `*${getChildrenText(node, listContext, indent)}*`;
        }

        // Links / 链接
        if (tag === 'a') {
            const href = node.getAttribute('href') || '';
            const text = getChildrenText(node, listContext, indent);
            return `[${text}](${href})`;
        }

        // Lists - pass context to children / 列表 - 将上下文传递给子元素
        if (tag === 'ul' || tag === 'ol') {
            const listType = tag; // 'ul' or 'ol'
            let index = 0;
            let result = '\n';

            for (const child of node.childNodes) {
                if (child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() === 'li') {
                    index++;
                    // Pass indent + 1 to children / 将缩进 + 1 传递给子元素
                    result += htmlToMarkdown(child, { type: listType, index: index }, indent + 1);
                } else {
                    // Pass indent + 1 to children even if not li (e.g. nested ul) / 即使不是 li 也传递缩进 + 1（例如嵌套的 ul）
                    result += htmlToMarkdown(child, listContext, indent + 1);
                }
            }

            return result + '\n';
        }

        // List items - use context to determine format / 列表项 - 使用上下文确定格式
        if (tag === 'li') {
            // Children of li are at the same indent level as the li itself (which is already indented by parent) / li 的子元素与 li 本身处于相同的缩进级别（父元素已缩进）
            const content = getChildrenText(node, listContext, indent);
            // Render bullet at indent - 1 / 在缩进 - 1 处渲染符号
            const indentStr = '  '.repeat(Math.max(0, indent - 1));
            if (listContext && listContext.type === 'ol') {
                return `${indentStr}${listContext.index}. ${content}\n`;
            } else {
                return `${indentStr}- ${content}\n`;
            }
        }

        // Line breaks / 换行符
        if (tag === 'br') {
            return '  \n';
        }

        // Blockquotes - prefix each line with > / 引用块 - 每行前缀 >
        if (tag === 'blockquote') {
            const content = getChildrenText(node, listContext, indent);
            // Split by lines and prefix each with "> " / 按行拆分并为每行添加 "> " 前缀
            return '\n' + content.split('\n')
                .map(line => `> ${line}`)
                .join('\n') + '\n';
        }

        // Block elements / 块级元素
        if (['div', 'p'].includes(tag)) {
            return '\n' + getChildrenText(node, listContext, indent) + '\n';
        }

        return getChildrenText(node, listContext, indent);
    }

    function getChildrenText(node, listContext = null, indent = 0) {
        return Array.from(node.childNodes).map(child => htmlToMarkdown(child, listContext, indent)).join('');
    }

    function normalizeConversation() {
        if (ExporterCore.turnOrder.length === 0 || ExporterCore.collectedData.size === 0) return;
        const newOrder = [];
        const newMap = new Map();

        for (let i = 0; i < ExporterCore.turnOrder.length; i++) {
            const id = ExporterCore.turnOrder[i];
            const item = ExporterCore.collectedData.get(id);
            if (!item) continue;

            if (item.role === Constants.ROLE_GEMINI && item.thoughts && !item.text) {
                let merged = false;
                for (let j = i + 1; j < ExporterCore.turnOrder.length; j++) {
                    const nextId = ExporterCore.turnOrder[j];
                    const nextItem = ExporterCore.collectedData.get(nextId);
                    if (!nextItem) continue;
                    if (nextItem.role === Constants.ROLE_USER) break;
                    if (nextItem.role === Constants.ROLE_GEMINI && nextItem.text) {
                        nextItem.thoughts = nextItem.thoughts
                            ? (item.thoughts + '\n\n' + nextItem.thoughts)
                            : item.thoughts;
                        ExporterCore.collectedData.set(nextId, nextItem);
                        merged = true;
                        break;
                    }
                }
                if (merged) continue;
            }
            newOrder.push(id);
            newMap.set(id, item);
        }
        ExporterCore.turnOrder = newOrder;
        ExporterCore.collectedData = newMap;
    }

    function countParagraphs() {
        return ExporterCore.getCounts().paragraphs;
    }

    async function downloadTextOnly() {
        let content = `# ${t('file_header')}` + "\n\n";
        content += `**${t('file_time')}:** ${new Date().toLocaleString()}` + "\n\n";
        content += `**${t('file_turns')}:** ${ExporterCore.turnOrder.length}` + "\n\n";
        content += `**${t('file_paragraphs')}:** ${countParagraphs()}` + "\n\n";
        content += "---\n\n";

        for (const id of ExporterCore.turnOrder) {
            const item = ExporterCore.collectedData.get(id);
            if (!item) continue;
            if (item.role === Constants.ROLE_GEMINI && item.thoughts && AppSettings.includeThinking) {
                const processedThoughts = convertResourcesToLinks(item.thoughts || '');
                if (AppSettings.collapsibleThinking) {
                    content += `<details>\n<summary>${t('role_thoughts')}</summary>\n\n${processedThoughts}\n\n</details>\n\n`;
                } else {
                    content += `> **${t('role_thoughts')}**\n>\n` + processedThoughts.split('\n').map(l => `> ${l}`).join('\n') + `\n\n`;
                }
            }
            const roleName = item.role;
            const textOut = (item.text || '').trim();
            const attachmentsMd = generateAttachmentsMarkdown(item);
            if (textOut.length > 0) {
                const processedText = convertResourcesToLinks(textOut);
                content += `## ${roleName}\n\n${processedText}\n\n`;
                if (attachmentsMd) content += attachmentsMd;
                content += `---\n\n`;
            } else if (attachmentsMd) {
                content += attachmentsMd + `---\n\n`;
            }
        }

        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        ExporterCore.cachedBlob = blob;
        downloadBlob(blob, `Gemini_Chat_v14_${Date.now()}.md`);
    }

    async function processResources(uniqueUrls, zipFolder, config) {
        const resourceMap = new Map();
        if (uniqueUrls.size > 0) {
            UIManager.update('PACKAGING', t(config.statusStart, { n: uniqueUrls.size }));
            let completedCount = 0;
            const promises = Array.from(uniqueUrls).map(async (url, index) => {
                if (ExporterCore.cancelRequested) return;
                try {
                    const blob = await fetchResource(url);
                    if (blob) {
                        const filename = config.filenameGenerator(url, index, blob);
                        zipFolder.file(filename, blob);
                        resourceMap.set(url, `${config.subDir}/${filename}`);
                    }
                } catch (e) {
                    console.error(`${config.subDir} download failed:`, url, e);
                }
                completedCount++;
                if (completedCount % 5 === 0 || completedCount === uniqueUrls.size) {
                    UIManager.update('PACKAGING', t(config.statusProgress, { c: completedCount, t: uniqueUrls.size }));
                }
            });
            let cancelIntervalId = null;
            const cancelWatcher = new Promise(resolve => {
                cancelIntervalId = setInterval(() => {
                    if (ExporterCore.cancelRequested) { clearInterval(cancelIntervalId); resolve(); }
                }, 200);
            });
            try { await Promise.race([Promise.all(promises), cancelWatcher]); } finally { if (cancelIntervalId) clearInterval(cancelIntervalId); }
        }
        return resourceMap;
    }

    function collectImageUrls() {
        const uniqueUrls = new Set();
        for (const item of ExporterCore.collectedData.values()) {
            const text = item.text || '';
            const thoughts = item.thoughts || '';
            for (const match of text.matchAll(Constants.IMG_REGEX)) uniqueUrls.add(match[2]);
            for (const match of thoughts.matchAll(Constants.IMG_REGEX)) uniqueUrls.add(match[2]);
        }
        return uniqueUrls;
    }

    async function processImages(imgFolder) {
        const uniqueUrls = collectImageUrls();
        return processResources(uniqueUrls, imgFolder, {
            subDir: 'images',
            statusStart: 'status_packaging_images',
            statusProgress: 'status_packaging_images_progress',
            filenameGenerator: (url, index, blob) => {
                const extension = (blob.type.split('/')[1] || 'png').split('+')[0];
                return `image_${index}.${extension}`;
            }
        });
    }

    function collectFileUrls() {
        const downloadableExtensions = ['.pdf', '.csv', '.txt', '.json', '.py', '.js', '.html', '.css', '.md', '.zip', '.tar', '.gz'];
        const uniqueUrls = new Set();
        const fileFilter = (match) => {
            const url = match[2];
            const lowerUrl = url.toLowerCase();
            const isBlob = lowerUrl.startsWith('blob:');
            const isGoogleStorage = lowerUrl.includes('googlestorage') || lowerUrl.includes('googleusercontent');
            const hasExt = downloadableExtensions.some(ext => lowerUrl.split('?')[0].endsWith(ext));
            return isBlob || isGoogleStorage || hasExt;
        };
        for (const item of ExporterCore.collectedData.values()) {
            const text = item.text || '';
            const thoughts = item.thoughts || '';
            for (const match of text.matchAll(Constants.LINK_REGEX)) {
                if (match.index > 0 && text[match.index - 1] === '!') continue;
                if (fileFilter(match)) uniqueUrls.add(match[2]);
            }
            for (const match of thoughts.matchAll(Constants.LINK_REGEX)) {
                if (match.index > 0 && thoughts[match.index - 1] === '!') continue;
                if (fileFilter(match)) uniqueUrls.add(match[2]);
            }
        }
        return uniqueUrls;
    }

    async function processFiles(fileFolder) {
        const uniqueUrls = collectFileUrls();
        return processResources(uniqueUrls, fileFolder, {
            subDir: 'files',
            statusStart: 'status_packaging_files',
            statusProgress: 'status_packaging_files_progress',
            filenameGenerator: (url, index, blob) => {
                let filename = "file";
                try {
                    const urlObj = new URL(url);
                    filename = urlObj.pathname.substring(urlObj.pathname.lastIndexOf('/') + 1);
                } catch (e) { filename = url.split('/').pop().split('?')[0]; }
                let decodedFilename = filename;
                try { decodedFilename = decodeURIComponent(filename); } catch (e) { }
                if (!decodedFilename || decodedFilename.length > 100) {
                    const extMatch = filename.match(/\.[^./?]+$/);
                    const ext = extMatch ? extMatch[0] : '';
                    decodedFilename = `file_${index}${ext}`;
                }
                return `${index}_${decodedFilename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            }
        });
    }

    function generateMarkdownContent(imgMap, fileMap) {
        let content = `# ${t('file_header')}` + "\n\n";
        content += `**${t('file_time')}:** ${new Date().toLocaleString()}` + "\n\n";
        content += `**${t('file_turns')}:** ${ExporterCore.turnOrder.length}` + "\n\n";
        content += `**${t('file_paragraphs')}:** ${countParagraphs()}` + "\n\n";
        content += "---\n\n";

        for (const id of ExporterCore.turnOrder) {
            const item = ExporterCore.collectedData.get(id);
            if (!item) continue;
            if (item.role === Constants.ROLE_GEMINI && item.thoughts && AppSettings.includeThinking) {
                let processedThoughts = item.thoughts;
                processedThoughts = processedThoughts.replace(Constants.IMG_REGEX, (match, alt, url, title) => {
                    if (imgMap.has(url)) return `![${alt}](${imgMap.get(url)}${title || ''})`;
                    return match;
                });
                processedThoughts = processedThoughts.replace(Constants.LINK_REGEX, (match, text, url, title) => {
                    if (fileMap.has(url)) return `[${text}](${fileMap.get(url)}${title || ''})`;
                    return match;
                });
                if (AppSettings.collapsibleThinking) {
                    content += `<details>\n<summary>${t('role_thoughts')}</summary>\n\n${processedThoughts}\n\n</details>\n\n`;
                } else {
                    content += `> **${t('role_thoughts')}**\n>\n` + processedThoughts.split('\n').map(l => `> ${l}`).join('\n') + `\n\n`;
                }
            }
            const roleName = item.role;
            let processedText = (item.text || '').trim();
            const attachmentsMd = generateAttachmentsMarkdown(item);
            processedText = processedText.replace(Constants.IMG_REGEX, (match, alt, url, title) => {
                if (imgMap.has(url)) return `![${alt}](${imgMap.get(url)}${title || ''})`;
                return match;
            });
            processedText = processedText.replace(Constants.LINK_REGEX, (match, text, url, title) => {
                if (fileMap.has(url)) return `[${text}](${fileMap.get(url)}${title || ''})`;
                return match;
            });
            if (processedText.length > 0) {
                content += `## ${roleName}\n\n${processedText}\n\n`;
                if (attachmentsMd) content += attachmentsMd;
                content += `---\n\n`;
            } else if (attachmentsMd) {
                content += attachmentsMd + `---\n\n`;
            }
        }
        return content;
    }

    function toFileName(url) {
        let base = 'file';
        try {
            const u = new URL(url);
            base = u.pathname.substring(u.pathname.lastIndexOf('/') + 1) || 'file';
            if (!base || base === 'file') {
                const qp = new URLSearchParams(u.search);
                const cand = qp.get('filename') || qp.get('file') || qp.get('name');
                if (cand) base = cand;
            }
        } catch (_) {
            base = url.split('/').pop().split('?')[0] || 'file';
            if (!base || base === 'file') {
                const m = String(url).match(/[?&](?:filename|file|name)=([^&]+)/i);
                if (m) base = m[1];
            }
        }
        base = String(base).replace(/^['"]+|['"]+$/g, '');
        try { return decodeURIComponent(base); } catch (_) { return base; }
    }

    function escapeMdLabel(s) {
        return String(s || '').replace(/]/g, '\\]').replace(/\n/g, ' ');
    }

    function generateAttachmentsMarkdown(item) {
        const links = Array.isArray(item.attachments) ? item.attachments : [];
        if (links.length === 0 && !(ATTACHMENT_COMBINED_FALLBACK && item.attachmentScanAttempted)) return '';
        let listContent;
        if (links.length > 0) {
            listContent = links.map(u => {
                const label = escapeMdLabel(toFileName(u));
                return `- [${label}](<${u}>)`;
            }).join('\n');
        } else {
            listContent = `- ${t('attachments_link_unavailable')}`;
        }
        return `### ${t('attachments_section')}\n\n${listContent}\n\n`;
    }

    function convertResourcesToLinks(text) {
        const replacedImages = text.replace(Constants.IMG_REGEX, (match, alt, url) => {
            const name = (alt && alt.trim().length > 0) ? alt.trim() : toFileName(url);
            return `[${name}](${url})`;
        });
        return replacedImages.replace(Constants.LINK_REGEX, (match, textLabel, url) => {
            const name = (textLabel && textLabel.trim().length > 0) ? textLabel.trim() : toFileName(url);
            return `[${name}](${url})`;
        });
    }

    function generateHTMLContent(imgMap, fileMap) {
        const title = t('file_header');
        const time = new Date().toLocaleString();
        const turns = ExporterCore.turnOrder.length;
        const paragraphs = countParagraphs();

        let html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: 'Google Sans', Roboto, sans-serif; line-height: 1.6; color: #1f1f1f; max-width: 800px; margin: 0 auto; padding: 20px; background: #f0f4f9; }
        .container { background: #fff; padding: 40px; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        h1 { font-size: 24px; margin-bottom: 20px; color: #1f1f1f; }
        .meta { font-size: 14px; color: #5f6368; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #e0e0e0; }
        .turn { margin-bottom: 30px; }
        .role { font-weight: bold; margin-bottom: 8px; font-size: 16px; }
        .role.user { color: #0b57d0; }
        .role.model { color: #1f1f1f; }
        .content { white-space: pre-wrap; }
        .thinking { margin-bottom: 10px; }
        details { background: #f8f9fa; border-radius: 8px; padding: 8px 12px; border: 1px solid #e0e0e0; }
        summary { cursor: pointer; font-weight: 500; color: #444746; outline: none; }
        details[open] summary { margin-bottom: 8px; }
        blockquote { border-left: 4px solid #0b57d0; margin: 0; padding-left: 16px; color: #444746; }
        img { max-width: 100%; border-radius: 8px; margin-top: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        a { color: #0b57d0; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .attachments { margin-top: 10px; font-size: 14px; }
        .attachment-item { display: inline-block; margin-right: 10px; background: #e8f0fe; color: #0b57d0; padding: 4px 12px; border-radius: 16px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${title}</h1>
        <div class="meta">
            <div><strong>${t('file_time')}:</strong> ${time}</div>
            <div><strong>${t('file_turns')}:</strong> ${turns}</div>
            <div><strong>${t('file_paragraphs')}:</strong> ${paragraphs}</div>
        </div>
`;

        for (const id of ExporterCore.turnOrder) {
            const item = ExporterCore.collectedData.get(id);
            if (!item) continue;

            const roleClass = item.role === Constants.ROLE_USER ? 'user' : 'model';
            const roleName = item.role === Constants.ROLE_USER ? t('role_user') : t('role_gemini');

            html += `<div class="turn">
                    <div class="role ${roleClass}">${roleName}</div>
                    <div class="content">`;

            // Thinking / 思考过程
            if (item.role === Constants.ROLE_GEMINI && item.thoughts && AppSettings.includeThinking) {
                let thoughtsHtml = processTextForHTML(item.thoughts, imgMap, fileMap);
                if (AppSettings.collapsibleThinking) {
                    html += `<div class="thinking">
                            <details>
                                <summary>${t('role_thoughts')}</summary>
                                <div class="thinking-content">${thoughtsHtml}</div>
                            </details>
                        </div>`;
                } else {
                    html += `<div class="thinking">
                            <blockquote><strong>${t('role_thoughts')}</strong><br>${thoughtsHtml}</blockquote>
                        </div>`;
                }
            }

            // Text / 文本内容
            let textHtml = processTextForHTML(item.text || '', imgMap, fileMap);
            html += `<div>${textHtml}</div>`;

            // Attachments / 附件
            const attachmentsHtml = generateAttachmentsHTML(item);
            if (attachmentsHtml) {
                html += `<div class="attachments">${attachmentsHtml}</div>`;
            }

            html += `</div></div>`; // Close content and turn
        }

        html += `</div></body></html>`;
        return html;
    }

    function processTextForHTML(text, imgMap, fileMap) {
        if (!text) return '';
        let processed = text;

        // Replace Images / 替换图片
        processed = processed.replace(Constants.IMG_REGEX, (match, alt, url, title) => {
            const src = imgMap.has(url) ? imgMap.get(url) : url;
            return `<img src="${src}" alt="${alt}" title="${title || ''}">`;
        });

        // Replace Links / 替换链接
        processed = processed.replace(Constants.LINK_REGEX, (match, text, url, title) => {
            const href = fileMap.has(url) ? fileMap.get(url) : url;
            return `<a href="${href}" title="${title || ''}" target="_blank">${text}</a>`;
        });

        return processed;
    }

    function generateAttachmentsHTML(item) {
        const links = Array.isArray(item.attachments) ? item.attachments : [];
        if (links.length === 0) return '';
        return links.map(u => {
            const label = toFileName(u);
            return `<a href="${u}" class="attachment-item" target="_blank">📎 ${label}</a>`;
        }).join('');
    }

    function getJSZip() {
        if (_JSZipRef) return _JSZipRef;
        if (typeof JSZip !== 'undefined') return JSZip;
        if (typeof unsafeWindow !== 'undefined' && typeof unsafeWindow.JSZip !== 'undefined') return unsafeWindow.JSZip;
        if (typeof window !== 'undefined' && typeof window.JSZip !== 'undefined') return window.JSZip;
        return null;
    }

    async function ensureJSZip() {
        const existing = getJSZip();
        if (existing) return existing;
        if (Constants.DISABLE_SCRIPT_INJECTION) {
            dlog('Script injection disabled due to CSP.', 'error');
            return null;
        }
        if (typeof GM_xmlhttpRequest !== 'undefined') {
            for (const url of Constants.JSZIP_URLS) {
                try {
                    const lib = await new Promise((resolve, reject) => {
                        GM_xmlhttpRequest({
                            method: 'GET', url, responseType: 'blob',
                            onload: (response) => {
                                try {
                                    const blobUrl = URL.createObjectURL(response.response);
                                    const script = document.createElement('script');
                                    script.src = blobUrl;
                                    script.onload = () => {
                                        URL.revokeObjectURL(blobUrl);
                                        const loaded = getJSZip();
                                        loaded ? resolve(loaded) : reject(new Error('JSZip not defined'));
                                    };
                                    script.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error('JSZip script load failed')); };
                                    document.head.appendChild(script);
                                } catch (e) { reject(e); }
                            },
                            onerror: () => reject(new Error('JSZip download failed'))
                        });
                    });
                    if (lib) return lib;
                } catch (e) { }
            }
        }
        for (const url of Constants.JSZIP_URLS) {
            try {
                const lib = await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = url;
                    script.onload = () => {
                        const loaded = getJSZip();
                        loaded ? resolve(loaded) : reject(new Error('JSZip not defined'));
                    };
                    script.onerror = () => reject(new Error('JSZip load failed'));
                    document.head.appendChild(script);
                });
                if (lib) return lib;
            } catch (e) { }
        }
        throw new Error('All JSZip CDN attempts failed');
    }

    async function downloadCollectedData() {
        if (ExporterCore.collectedData.size === 0) return false;
        normalizeConversation();

        if (ExporterCore.exportMode === 'text') {
            downloadTextOnly();
            return true;
        }

        let JSZipLib = getJSZip();
        if (!JSZipLib) {
            try { JSZipLib = await ensureJSZip(); } catch (e) { console.error('ensureJSZip failed:', e); }
        }
        while (!JSZipLib) {
            const action = await UIManager.showZipFallbackPrompt();
            if (action === 'text') {
                downloadTextOnly();
                return true;
            }
            if (action === 'retry') {
                try { JSZipLib = await ensureJSZip(); } catch (e) { }
                continue;
            }
            return false;
        }
        const zip = new JSZipLib();
        const imgFolder = zip.folder("images");
        const fileFolder = zip.folder("files");

        const [imgMap, fileMap] = await Promise.all([
            processImages(imgFolder),
            processFiles(fileFolder)
        ]);

        if (ExporterCore.exportMode === 'html') {
            const content = generateHTMLContent(imgMap, fileMap);
            zip.file("chat_history.html", content);
        } else {
            const content = generateMarkdownContent(imgMap, fileMap);
            zip.file("chat_history.md", content);
        }

        let zipBlob;
        try {
            zipBlob = await Promise.race([
                zip.generateAsync({ type: "blob" }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('ZIP timeout')), 15000))
            ]);
        } catch (e) {
            const action = await UIManager.showZipFallbackPrompt();
            if (action === 'text') {
                downloadTextOnly();
                return true;
            }
            if (action === 'retry') {
                try {
                    zipBlob = await zip.generateAsync({ type: "blob" });
                } catch (_) {
                    downloadTextOnly();
                    return true;
                }
            } else {
                return false;
            }
        }
        ExporterCore.cachedBlob = zipBlob;
        downloadBlob(zipBlob, `Gemini_Chat_v14_${Date.now()}.zip`);
        return true;
    }



    // Resource fetcher: supports GM_xmlhttpRequest and fetch, with timeout / 资源下载：支持 GM_xmlhttpRequest 与 fetch，并内置超时
    function fetchResource(url) {
        const timeoutMs = 10000;
        return new Promise((resolve) => {
            let settled = false;
            const timeout = setTimeout(() => { if (!settled) { settled = true; debugLog(`Resource fetch timed out: ${url}`, 'error'); resolve(null); } }, timeoutMs);
            const finish = (val) => { if (!settled) { settled = true; clearTimeout(timeout); resolve(val); } };

            if (typeof GM_xmlhttpRequest !== 'undefined') {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: url,
                    responseType: "blob",
                    onload: (response) => {
                        if (response.status >= 200 && response.status < 300) {
                            finish(response.response);
                        } else {
                            console.warn(`Resource fetch failed with status ${response.status}:`, url);
                            debugLog(`Resource fetch failed (${response.status}): ${url}`, 'error');
                            finish(null);
                        }
                    },
                    onerror: () => { debugLog(`Resource fetch network error: ${url}`, 'error'); finish(null); }
                });
            } else {
                fetch(url, { credentials: 'include' })
                    .then(r => {
                        if (r.ok) return r.blob();
                        debugLog(`Fetch failed (${r.status}): ${url}`, 'error');
                        return null;
                    })
                    .then(finish)
                    .catch(() => { debugLog(`Fetch error: ${url}`, 'error'); finish(null); });
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
        URL.revokeObjectURL(url);
    }

    function endProcess(status, msg) {
        if (ExporterCore.hasFinished) return;
        ExporterCore.hasFinished = true;
        ExporterCore.isRunning = false;

        if (status === "FINISHED") {
            if (ExporterCore.collectedData.size > 0) {
                downloadCollectedData().then(() => {
                    UIManager.update('FINISHED', ExporterCore.collectedData.size);
                }).catch(err => {
                    console.error("Failed to generate and download file:", err);
                    UIManager.update('ERROR', t('err_runtime') + err.message);
                });
            } else {
                UIManager.update('ERROR', t('err_no_data'));
            }
        } else {
            UIManager.update('ERROR', msg);
        }
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    // Global ESC handler: show cancel prompt and proceed based on choice / 全局 ESC 处理：弹出取消提示并根据选择继续或回退
    document.addEventListener('keydown', async e => {
        if (e.key !== 'Escape') return;
        if (!ExporterCore.isRunning || UIManager.isHandlingEscape) return;
        UIManager.isHandlingEscape = true;
        try {
            ExporterCore.cancelRequested = true;
            const choice = await UIManager.showCancelPrompt();
            if (choice === 'text') {
                normalizeConversation();
                ExporterCore.exportMode = 'text';
                try { await downloadTextOnly(); } catch (err) { dlog('Text export failed: ' + (err && err.message ? err.message : 'error'), 'error'); }
                UIManager.update('FINISHED', ExporterCore.collectedData.size);
                ExporterCore.isRunning = false;
            } else if (choice === 'retry') {
                ExporterCore.cancelRequested = false;
                ExporterCore.exportMode = 'full';
                ExporterCore.isRunning = true;
                try { await downloadCollectedData(); } catch (err) { dlog('Retry export failed: ' + (err && err.message ? err.message : 'error'), 'error'); }
            } else {
                ExporterCore.isRunning = false;
                if (UIManager.overlay) UIManager.overlay.style.display = 'none';
            }
        } finally {
            UIManager.isHandlingEscape = false;
        }
    });

    NetworkInterceptor.init();
    ExporterCore.initSessionMonitor();
    setInterval(() => UIManager.createEntryButton(), 2000);
})();

