// ==UserScript==
// @name         Google AI Studio Exporter
// @name:zh-CN   Google AI Studio 对话导出器
// @namespace    https://github.com/GhostXia/Google-AI-Studio-Exporter
// @version      1.6.0
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
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_listValues
// @grant        GM_deleteValue
// @grant        unsafeWindow
// @run-at       document-start
// @connect      cdnjs.cloudflare.com
// @connect      cdn.jsdelivr.net
// @connect      unpkg.com
// @connect      lh3.googleusercontent.com
// @connect      googleusercontent.com
// @connect      storage.googleapis.com
// @connect      gstatic.com
// ==/UserScript==

// 在 IIFE 外部捕获 @require 加载的 JSZip（避免沙盒作用域问题）
/* global JSZip */
const _JSZipRef = (typeof JSZip !== 'undefined') ? JSZip : null;

    (function () {
        'use strict';

    // ==========================================
    // 2. 配置常量 (集中管理)
    // ==========================================
    const CONFIG_CONSTANTS = {
        // 脚本行为配置
        DEBUG: false,
        DISABLE_SCRIPT_INJECTION: true,
        ATTACHMENT_COMBINED_FALLBACK: true,
        ATTACHMENT_MAX_DIST: 160,

        // JSZip CDN URLs
        JSZIP_URLS: [
            'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.js',
            'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
            'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js'
        ],

        // DOM 提取延迟常量
        SCROLL_DELAY_MS: 50,
        RAW_MODE_MENU_DELAY_MS: 200,
        RAW_MODE_RENDER_DELAY_MS: 300,
        THOUGHT_EXPAND_DELAY_MS: 500,
        MAX_SCROLL_ATTEMPTS: 10000,
        BOTTOM_DETECTION_TOLERANCE: 10,
        MIN_SCROLL_DISTANCE_THRESHOLD: 5,
        SCROLL_PARENT_SEARCH_DEPTH: 5,
        FINAL_COLLECTION_DELAY_MS: 300,
        UPWARD_SCROLL_DELAY_MS: 1000,
        SCROLL_INCREMENT_INITIAL: 150,

        // 缓存配置
        CACHE_MAX_SIZE: 5 * 1024 * 1024, // 5MB
        CACHE_MAX_AGE: 3600000, // 1小时
        CACHE_CLEANUP_INTERVAL: 86400000, // 24小时

        // 错误处理配置
        MAX_ERRORS: 10,

        // DOM缓存配置
        DOM_CACHE_MAX_SIZE: 1000,

        // 安全配置
        MAX_STRING_LENGTH: 10000,
        MAX_URL_LENGTH: 2048,
        MAX_ID_LENGTH: 1000
    };

    const dlog = (...args) => {
        if (CONFIG_CONSTANTS.DEBUG) {
            console.log('[AI Studio Exporter]', ...args);
        }
    };
        dlog('[AI Studio Exporter] Script started');
        dlog('[AI Studio Exporter] _JSZipRef:', _JSZipRef);
        dlog('[AI Studio Exporter] typeof JSZip:', typeof JSZip);
        dlog('[AI Studio Exporter] unsafeWindow.JSZip:', typeof unsafeWindow !== 'undefined' ? unsafeWindow.JSZip : 'unsafeWindow not available');

    // ===================================
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
            'file_turns': '回合数',
            'file_paragraphs': '输出段落数',
            'role_user': 'User',
            'role_gemini': 'Gemini',
            'role_thoughts': '思考',
            'err_no_scroller': '未找到滚动容器。请尝试刷新页面或手动滚动一下再试。',
            'err_no_data': '未采集到任何对话数据。请检查页面是否有对话内容。',
            'err_runtime': '运行错误: ',
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
            'settings_title': '导出选项',
            'settings_include_user': '包含用户消息',
            'settings_include_model': '包含模型回复',
            'settings_include_thinking': '包含思考过程',
            'settings_collapsible_thinking': '可折叠思考过程',
            'settings_extraction_method': '提取方式',
            'settings_xhr': 'XHR',
            'settings_dom': 'DOM',
            'settings_tooltip': 'XHR: 通过网络即时捕获（推荐）\nDOM: 滚动界面提取（备用）'
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
            'settings_title': 'Export Options',
            'settings_include_user': 'Include User Messages',
            'settings_include_model': 'Include Model Responses',
            'settings_include_thinking': 'Include Thinking',
            'settings_collapsible_thinking': 'Collapsible Thinking',
            'settings_extraction_method': 'Extraction Method',
            'settings_xhr': 'XHR',
            'settings_dom': 'DOM',
            'settings_tooltip': 'XHR: Instant capture via network (recommended)\nDOM: Scrolls through UI to extract (fallback)'
            }
        };

    function t(key, params = {}) {
        let str = translations[lang][key] || key;
        // Legacy support for single parameter
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
            width: 92%; 
            max-width: 560px;
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
        .ai-banner {
            background: #fff7cd;
            color: #5f6368;
            padding: 10px 12px;
            border-radius: 10px;
            margin-bottom: 14px;
            font-size: 13px;
        }
        
        .ai-status { 
            font-size: 15px; 
            margin-bottom: 24px; 
            line-height: 1.7; 
            color: #5f6368; 
            word-break: break-word; 
            white-space: pre-wrap;
        }
        
        .ai-count { 
            font-size: 14px; 
            font-weight: 600; 
            color: #5f6368; 
            margin-top: 8px;
            line-height: 1.6;
            white-space: pre-line;
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
            display: inline-block;
            box-shadow: 0 4px 12px rgba(26, 115, 232, 0.3);
            transition: all 0.2s ease;
            flex: 1;
            max-width: 150px;
        }
        .ai-btn[disabled] {
            opacity: 0.6;
            cursor: not-allowed;
            pointer-events: none;
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
        .ai-hint {
            color: #5f6368;
            font-size: 13px;
            align-self: center;
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
            .ai-count { font-size: 14px; }
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
                font-size: 14px;
                margin-top: 8px;
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
            .ai-count { font-size: 13px; }
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
            .ai-count { color: #9aa0a6; }
        }

        /* 设置面板样式 */
        .settings-panel {
            position: fixed;
            background: white;
            border: 1px solid #dadce0;
            border-radius: 12px;
            padding: 20px 24px;
            padding-top: 40px;
            font-family: 'Google Sans', Roboto, -apple-system, sans-serif;
            font-size: 14px;
            color: #202124;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
            min-width: 280px;
            user-select: none;
            pointer-events: auto;
            z-index: 2147483647;
        }

        .settings-panel .close-button {
            position: absolute;
            top: 12px;
            right: 12px;
            width: 28px;
            height: 28px;
            border: none;
            background: transparent;
            color: #5f6368;
            font-size: 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            padding: 0;
            line-height: 1;
            transition: all 0.2s;
        }

        .settings-panel .close-button:hover {
            background: #f1f3f4;
            color: #202124;
        }

        .settings-panel label {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 8px 0;
            cursor: pointer;
            user-select: none;
            color: #202124;
        }

        .settings-panel label:hover {
            color: #1a73e8;
        }

        .settings-panel input[type="checkbox"] {
            width: 18px;
            height: 18px;
            cursor: pointer;
            accent-color: #1a73e8;
        }

        .settings-panel .section-title {
            font-size: 13px;
            color: #5f6368;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid #dadce0;
        }

        .settings-panel .sub-option {
            padding-left: 30px;
            font-size: 13px;
            color: #5f6368;
        }

        .settings-panel .separator {
            height: 1px;
            background: #dadce0;
            margin: 16px 0;
        }

        .settings-panel .toggle-container {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 16px;
            padding: 12px 0 8px 0;
        }

        .settings-panel .toggle-label {
            cursor: pointer;
            font-size: 13px;
            color: #5f6368;
            transition: color 0.2s;
            font-weight: 500;
        }

        .settings-panel .toggle-label:hover {
            color: #1a73e8;
        }

        .settings-panel .toggle-label.active {
            color: #1a73e8;
            font-weight: 600;
        }

        .settings-panel .toggle-switch {
            width: 48px;
            height: 26px;
            background: #dadce0;
            border-radius: 13px;
            cursor: pointer;
            position: relative;
            transition: background 0.3s;
        }

        .settings-panel .toggle-switch::before {
            content: '';
            position: absolute;
            width: 22px;
            height: 22px;
            background: white;
            border-radius: 50%;
            top: 2px;
            left: 2px;
            transition: transform 0.3s;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .settings-panel .toggle-switch:hover {
            background: #e0e0e0;
        }

        .settings-panel .toggle-switch.dom::before {
            transform: translateX(22px);
        }

    `;
    document.head.appendChild(style);

    // ==========================================
    // 2. 状态管理
    // ==========================================
    let isRunning = false;
    let hasFinished = false;
    let collectedData = new Map();
    let turnOrder = []; // Array to store turn IDs in the correct order
    let processedTurnIds = new Set();
    let overlay, titleEl, statusEl, countEl, closeBtn, entryButton;
    let exportMode = null; // 'full' or 'text'
    let cachedExportBlob = null;
    let cancelRequested = false;
    let isHandlingEscape = false;
    let scannedAttachmentTurns = new Set();

    // XHR 状态
    let capturedChatData = null;
    let capturedTimestamp = 0;
    let currentConversationId = null;

    const DEFAULT_CONFIG = {
        EXTRACTION_MODE: 'xhr',  // 'xhr' or 'dom'
        INCLUDE_USER: true,
        INCLUDE_MODEL: true,
        INCLUDE_THINKING: true,
        COLLAPSIBLE_THINKING: true
    };

    let CONFIG = { ...DEFAULT_CONFIG };

    // ==========================================
    // 3. 设置存储
    // ==========================================
    function loadSettings() {
        try {
            const saved = GM_getValue('aistudio_export_config', null);
            if (saved) {
                CONFIG = { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
                dlog('Settings loaded from storage.');
            }
        } catch (e) {
            dlog(`Failed to load settings: ${e.message}`);
        }
    }

    function saveSettings() {
        try {
            GM_setValue('aistudio_export_config', JSON.stringify(CONFIG));
            dlog('Settings saved.');
        } catch (e) {
            dlog(`Failed to save settings: ${e.message}`);
        }
    }

    loadSettings();

    // ==========================================
    // 4. 安全工具函数
    // ==========================================
    const SecurityUtils = {
        isValidString(str, maxLength = 10000) {
            if (typeof str !== 'string') return false;
            if (str.length > maxLength) return false;
            // 检查是否包含潜在危险的字符序列
            const dangerousPatterns = [
                /<script[^>]*>/i,
                /javascript:/i,
                /on\w+\s*=/i
            ];
            return !dangerousPatterns.some(pattern => pattern.test(str));
        },

        /**
         * 验证URL是否安全
         * @param {string} url - 待验证的URL
         * @returns {boolean} - 是否安全
         */
        isValidUrl(url) {
            if (!this.isValidString(url, 2048)) return false;
            try {
                const parsed = new URL(url);
                // 只允许特定的协议
                const allowedProtocols = ['http:', 'https:', 'blob:', 'data:'];
                if (!allowedProtocols.includes(parsed.protocol)) return false;
                // 防止SSRF攻击
                const hostname = parsed.hostname.toLowerCase();
                const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
                if (blockedHosts.includes(hostname)) return false;
                return true;
            } catch (e) {
                return false;
            }
        },

        /**
         * 简单的数据混淆（非加密，仅用于防止明文存储）
         * @param {string} data - 待混淆的数据
         * @returns {string} - 混淆后的数据
         */
        obfuscate(data) {
            try {
                const str = typeof data === 'string' ? data : JSON.stringify(data);
                return btoa(encodeURIComponent(str));
            } catch (e) {
                console.warn('Data obfuscation failed:', e);
                return data;
            }
        },

        /**
         * 反混淆数据
         * @param {string} data - 混淆的数据
         * @returns {string} - 原始数据
         */
        deobfuscate(data) {
            try {
                return decodeURIComponent(atob(data));
            } catch (e) {
                console.warn('Data deobfuscation failed:', e);
                return data;
            }
        },

        /**
         * 生成安全的哈希值
         * @param {string} str - 待哈希的字符串
         * @returns {string} - 哈希值
         */
        hashString(str) {
            let hash = 0;
            if (!str) return '0';
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return Math.abs(hash).toString(36);
        }
    };

    // ==========================================
    // 5. 错误处理工具
    // ==========================================
    const ErrorHandler = {
        errorCount: 0,
        maxErrors: 10,
        errorTypes: new Map(),

        handleError(error, context = 'Unknown', fatal = false) {
            this.errorCount++;
            const errorType = error.name || 'Error';
            this.errorTypes.set(errorType, (this.errorTypes.get(errorType) || 0) + 1);

            const errorMsg = error.message || String(error);
            console.error(`[AI Studio Exporter] Error in ${context}:`, error);

            // 记录到UI
            if (fatal || this.errorCount > this.maxErrors) {
                debugLog(`Fatal error: ${errorMsg}`, 'error');
                endProcess("ERROR", t('err_runtime') + errorMsg);
            } else {
                dlog(`Non-fatal error in ${context}: ${errorMsg}`);
            }

            // 如果错误过多，停止执行
            if (this.errorCount > this.maxErrors) {
                console.error('[AI Studio Exporter] Too many errors, stopping execution');
                endProcess("ERROR", 'Too many errors occurred');
            }
        },

        /**
         * 包装异步函数，添加错误处理
         * @param {Function} fn - 异步函数
         * @param {string} context - 错误上下文
         * @returns {Function} - 包装后的函数
         */
        wrapAsync(fn, context = 'Async operation') {
            return async (...args) => {
                try {
                    return await fn(...args);
                } catch (error) {
                    this.handleError(error, context);
                    throw error;
                }
            };
        },

        /**
         * 包装同步函数，添加错误处理
         * @param {Function} fn - 同步函数
         * @param {string} context - 错误上下文
         * @returns {Function} - 包装后的函数
         */
        wrapSync(fn, context = 'Sync operation') {
            return (...args) => {
                try {
                    return fn(...args);
                } catch (error) {
                    this.handleError(error, context);
                    throw error;
                }
            };
        },

        /**
         * 重置错误计数器
         */
        reset() {
            this.errorCount = 0;
            this.errorTypes.clear();
        },

        /**
         * 获取错误统计
         * @returns {Object} - 错误统计信息
         */
        getStats() {
            return {
                totalCount: this.errorCount,
                types: Object.fromEntries(this.errorTypes)
            };
        }
    };

    // ==========================================
    // 6. 性能监控
    // ==========================================

    const PerformanceMonitor = {
        metrics: new Map(),
        timers: new Map(),
        enabled: CONFIG_CONSTANTS.DEBUG,

        startTimer(label) {
            if (!this.enabled) return;
            this.timers.set(label, performance.now());
        },

        endTimer(label) {
            if (!this.enabled || !this.timers.has(label)) return;
            const duration = performance.now() - this.timers.get(label);
            this.timers.delete(label);
            this.recordMetric(label, duration);
            dlog(`Performance [${label}]: ${duration.toFixed(2)}ms`);
        },

        recordMetric(label, value) {
            if (!this.enabled) return;
            if (!this.metrics.has(label)) {
                this.metrics.set(label, []);
            }
            this.metrics.get(label).push(value);
        },

        getStats() {
            const stats = {};
            for (const [label, values] of this.metrics) {
                const sum = values.reduce((a, b) => a + b, 0);
                const avg = sum / values.length;
                const min = Math.min(...values);
                const max = Math.max(...values);
                stats[label] = {
                    count: values.length,
                    avg: avg.toFixed(2),
                    min: min.toFixed(2),
                    max: max.toFixed(2)
                };
            }
            return stats;
        },

        reset() {
            this.metrics.clear();
            this.timers.clear();
        }
    };

    // ==========================================
    // 7. 缓存管理
    // ==========================================
    
    /**
     * 解析当前对话的 ID
     * 从 URL 或页面元素中提取唯一标识符
     * @returns {string} - 对话ID
     */
    function getCurrentConversationId() {
        const url = window.location.href;

        // 验证URL安全性
        if (!SecurityUtils.isValidUrl(url)) {
            console.warn('[AI Studio Exporter] URL validation failed, using fallback ID');
            return `fallback_${SecurityUtils.hashString(Date.now().toString())}`;
        }

        // 检查是否有 conversation ID 在 URL 中
        const urlMatch = url.match(/conversation\/([^/?]+)/i) || url.match(/prompt\/([^/?]+)/i);
        if (urlMatch && urlMatch[1]) {
            const id = urlMatch[1];
            // 验证ID长度和安全性
            if (id.length > 0 && id.length < 1000 && SecurityUtils.isValidString(id, 1000)) {
                return id;
            }
        }

        // 作为后备，使用页面标题或其他唯一标识
        const title = document.title;
        const domain = window.location.hostname;
        const path = window.location.pathname;

        // 使用安全的哈希算法
        const hashString = `${title}${domain}${path}`;
        const hash = SecurityUtils.hashString(hashString);

        return `fallback_${hash}`;
    }

    /**
     * 从缓存加载对话数据
     */
    function loadCachedConversationData() {
        const conversationId = getCurrentConversationId();
        if (!conversationId) return null;

        try {
            const cached = GM_getValue(`aistudio_cache_${conversationId}`, null);
            if (cached) {
                // 反混淆数据
                const deobfuscated = SecurityUtils.deobfuscate(cached);
                const parsed = JSON.parse(deobfuscated);
                dlog(`从缓存加载对话数据: ${conversationId}`);
                return parsed;
            }
        } catch (err) {
            dlog(`加载缓存失败: ${err.message}`);
        }
        return null;
    }

    /**
     * 保存对话数据到缓存
     */
    function saveConversationDataToCache(data) {
        const conversationId = getCurrentConversationId();
        if (!conversationId || !data) return false;

        try {
            // 验证数据大小
            const dataStr = JSON.stringify(data);
            if (dataStr.length > 5 * 1024 * 1024) { // 5MB 限制
                console.warn('[AI Studio Exporter] 数据过大，跳过缓存');
                return false;
            }

            // 混淆数据
            const obfuscated = SecurityUtils.obfuscate(dataStr);

            const cacheData = {
                data: obfuscated,
                timestamp: Date.now(),
                conversationId: conversationId
            };
            GM_setValue(`aistudio_cache_${conversationId}`, JSON.stringify(cacheData));
                dlog(`对话数据保存到缓存: ${conversationId}`);
                return true;
            } catch (err) {
                dlog(`保存缓存失败: ${err.message}`);
            return false;
        }
    }

    /**
     * 检查缓存是否有效
     */
    function isCacheValid(timestamp, maxAgeMs = 3600000) { // 默认1小时有效
        const age = Date.now() - timestamp;
        return age < maxAgeMs;
    }

    /**
     * 清除过期缓存
     */
    function cleanupExpiredCache() {
        try {
            // 注意：GM_listValues 可能不可用，需要检查支持
            if (typeof GM_listValues !== 'function') {
                dlog(`GM_listValues 不可用，跳过缓存清理`);
                return;
            }

            const keys = GM_listValues();
            const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000); // 24小时

            keys.forEach(key => {
                if (key.startsWith('aistudio_cache_')) {
                    try {
                        const cached = JSON.parse(GM_getValue(key, '{}'));
                        if (cached.timestamp && cached.timestamp < oneDayAgo) {
                            if (typeof GM_deleteValue === 'function') {
                                GM_deleteValue(key);
                                dlog(`清除过期缓存: ${key}`);
                            }
                        }
                    } catch (err) {
                        if (typeof GM_deleteValue === 'function') {
                            GM_deleteValue(key);
                        }
                    }
                }
            });
        } catch (err) {
            dlog(`缓存清理失败: ${err.message}`);
        }
    }

    /**
     * 清除除当前对话外的所有缓存
     * 用于切换对话时保持缓存清洁
     */
    function clearOldCaches() {
        try {
            // 注意：GM_listValues 可能不可用，需要检查支持
            if (typeof GM_listValues !== 'function') {
                dlog(`GM_listValues 不可用，跳过旧缓存清理`);
                return;
            }

            const currentConversationId = getCurrentConversationId();
            const keys = GM_listValues();

            keys.forEach(key => {
                if (key.startsWith('aistudio_cache_')) {
                    // 只保留当前对话的缓存
                    const cacheId = key.replace('aistudio_cache_', '');
                    if (cacheId !== currentConversationId) {
                        if (typeof GM_deleteValue === 'function') {
                            GM_deleteValue(key);
                            dlog(`切换对话，清除旧缓存: ${key}`);
                        }
                    }
                }
            });
        } catch (err) {
            dlog(`旧缓存清理失败: ${err.message}`);
        }
    }

    /**
     * 清除所有缓存
     * 提供给用户手动清理缓存的功能
     */
    function clearAllCaches() {
        try {
            if (typeof GM_listValues !== 'function') {
                dlog(`GM_listValues 不可用，无法清除缓存`);
                return false;
            }

            const keys = GM_listValues();
            let clearedCount = 0;

            keys.forEach(key => {
                if (key.startsWith('aistudio_cache_')) {
                    if (typeof GM_deleteValue === 'function') {
                        GM_deleteValue(key);
                        clearedCount++;
                    }
                }
            });

            dlog(`清除了 ${clearedCount} 个缓存`);
            return true;
        } catch (err) {
            dlog(`清除所有缓存失败: ${err.message}`);
            return false;
        }
    }
    
    // 初始化时清理过期缓存
    cleanupExpiredCache();

    // ==========================================
    // 4. XHR 拦截器 (新增 - 核心功能)
    // ==========================================

    console.log("[AI Studio Exporter] 正在设置 XHR 拦截器...");

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const originalOpenDescriptor = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'open');
    const originalSendDescriptor = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'send');

    XMLHttpRequest.prototype.open = function(method, url) {
        this._url = url;
        return originalOpen.apply(this, arguments);
    };

    /**
     * 拦截XMLHttpRequest请求，捕获对话数据
     *
     * @param {*} body - 请求体
     * @returns {*} - 原始send方法的返回值
     */
    XMLHttpRequest.prototype.send = function(body) {
        this.addEventListener('load', function() {
            if (this._url && (this._url.includes('ResolveDriveResource') || this._url.includes('CreatePrompt') || this._url.includes('UpdatePrompt'))) {
                try {
                    // 安全处理：检查响应类型和状态码
                    if (this.status !== 200 || !this.responseText) {
                        dlog(`[AI Studio Exporter] XHR interceptor: Invalid response status (${this.status}) for ${this._url}`);
                        return;
                    }

                    const rawText = this.responseText.replace(/^\)\]\}'/, '').trim();

                    // 安全处理：验证响应大小，防止过大的响应导致内存问题
                    if (rawText.length > 10 * 1024 * 1024) {
                        dlog(`[AI Studio Exporter] Response too large (${rawText.length} chars), skipping.`);
                        return;
                    }

                    let json;
                    try {
                        json = JSON.parse(rawText);
                    } catch (parseErr) {
                        dlog(`[AI Studio Exporter] XHR interceptor: Failed to parse JSON response: ${parseErr.message}`);
                        return;
                    }

                    // 安全处理：验证数据结构
                    if (!Array.isArray(json)) {
                        dlog(`[AI Studio Exporter] XHR interceptor: Invalid data structure, expected array`);
                        return;
                    }

                    let endpoint = 'ResolveDriveResource';
                    if (this._url.includes('CreatePrompt')) endpoint = 'CreatePrompt';
                    else if (this._url.includes('UpdatePrompt')) endpoint = 'UpdatePrompt';

                    if (typeof json[0] === 'string' && json[0].startsWith('prompts/')) {
                        json = [json];
                    }

                    // 优先级策略：
                    // 1. CreatePrompt/UpdatePrompt 优先于 ResolveDriveResource
                    // 2. 相同端点下，选择数据更大的响应
                    const currentPriority = endpoint === 'ResolveDriveResource' ? 1 : 2;
                    const existingPriority = capturedChatData ?
                        (capturedChatData._endpoint === 'ResolveDriveResource' ? 1 : 2) : 0;

                    const currentSize = JSON.stringify(json).length;
                    const existingSize = capturedChatData ?
                        JSON.stringify(capturedChatData).length : 0;

                    const shouldUpdate = !capturedChatData ||
                        currentPriority > existingPriority ||
                        (currentPriority === existingPriority && currentSize > existingSize);

                    if (shouldUpdate) {
                        dlog(`${endpoint} intercepted. Size: ${rawText.length} chars.`);
                        dlog(`Captured data structure:`, json);

                        // 标记数据来源，用于后续比较
                        json._endpoint = endpoint;
                        json._captureTime = Date.now();

                        capturedChatData = json;
                        capturedTimestamp = json._captureTime;

                        dlog(`Data captured at: ${new Date(capturedTimestamp).toLocaleTimeString()}`);

                        // 保存到缓存，添加错误处理
                        try {
                            saveConversationDataToCache(json);
                            dlog(`Data saved to cache`);
                        } catch (cacheErr) {
                            dlog(`Failed to save data to cache: ${cacheErr.message}`);
                        }
                    } else {
                        dlog(`跳过较小或低优先级的 ${endpoint} 响应 (${currentSize} vs ${existingSize} bytes)`);
                    }
                } catch (err) {
                    dlog(`[AI Studio Exporter] XHR interceptor error: ${err.message}`);
                    if (CONFIG_CONSTANTS.DEBUG) {
                        console.error('[AI Studio Exporter] XHR interceptor detailed error:', err);
                    }
                }
            }
        });
        return originalSend.apply(this, arguments);
    };

    console.log("[AI Studio Exporter] XHR 拦截器设置完成");

    /**
     * 清理XHR拦截器，恢复原始原型
     * 用于脚本卸载或需要禁用拦截器时
     */
    function cleanupXHRInterceptor() {
        try {
            if (originalOpenDescriptor) {
                Object.defineProperty(XMLHttpRequest.prototype, 'open', originalOpenDescriptor);
            } else {
                XMLHttpRequest.prototype.open = originalOpen;
            }
            if (originalSendDescriptor) {
                Object.defineProperty(XMLHttpRequest.prototype, 'send', originalSendDescriptor);
            } else {
                XMLHttpRequest.prototype.send = originalSend;
            }
            dlog("XHR 拦截器已清理");
        } catch (e) {
            console.error('[AI Studio Exporter] 清理XHR拦截器失败:', e);
        }
    }

    // XHR 解析逻辑 (新增)
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
            dlog(`Found history at depth ${depth}. Contains ${node.length} items.`);
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

        function scan(item, d=0) {
            if (d > 3) return;
            if (typeof item === 'string' && item.length > 1) {
                if (!['user', 'model', 'function'].includes(item)) candidates.push(item);
            } else if (Array.isArray(item)) {
                item.forEach(sub => scan(sub, d+1));
            }
        }

        scan(turn);
        return candidates.sort((a, b) => b.length - a.length)[0] || "";
    }

// 【动态索引检测 - 改进的回合类型识别机制】
// 为了减少对硬编码索引的依赖，我们实现了动态索引检测机制
// 该机制会分析回合数组的结构，寻找具有特定模式的位置来识别回合类型
// 如果动态检测失败，会回退到硬编码索引作为备用方案

// 默认硬编码索引（作为后备方案）
const DEFAULT_THINKING_TURN_INDEX = 19;
const DEFAULT_RESPONSE_TURN_INDEX = 16;

// 动态检测到的索引（初始值为默认值）
let detectedThinkingTurnIndex = DEFAULT_THINKING_TURN_INDEX;
let detectedResponseTurnIndex = DEFAULT_RESPONSE_TURN_INDEX;

/**
 * 动态检测回合类型指示器的索引位置
 * @param {Array} sampleTurns - 样本回合数组，用于分析结构
 */
function detectTurnIndicatorIndices(sampleTurns) {
    if (!Array.isArray(sampleTurns) || sampleTurns.length === 0) {
        dlog("[AI Studio Exporter] 动态索引检测：没有可用的样本回合数据");
        return;
    }

    // 寻找可能的思考回合和回复回合指示器位置
    // 基于观察：这些指示器通常是值为1的数字，位于数组的后半部分
    const candidatePositions = new Map();
    
    sampleTurns.forEach(turn => {
        if (!Array.isArray(turn)) return;
        
        // 只检查数组后半部分（基于原始观察）
        const latterHalf = turn.slice(Math.floor(turn.length / 2));
        
        latterHalf.forEach((value, index) => {
            if (value === 1) {
                const actualIndex = Math.floor(turn.length / 2) + index;
                candidatePositions.set(actualIndex, (candidatePositions.get(actualIndex) || 0) + 1);
            }
        });
    });
    
    // 找出出现频率最高的两个位置
    const sortedPositions = Array.from(candidatePositions.entries())
        .sort(([,a], [,b]) => b - a)
        .map(([position]) => position);
    
    if (sortedPositions.length >= 2) {
        // 假设较小的索引是回复回合，较大的是思考回合（基于原始观察）
        const [pos1, pos2] = sortedPositions;
        detectedResponseTurnIndex = Math.min(pos1, pos2);
        detectedThinkingTurnIndex = Math.max(pos1, pos2);
        
        dlog(`[AI Studio Exporter] 动态索引检测：找到回复回合索引 ${detectedResponseTurnIndex}，思考回合索引 ${detectedThinkingTurnIndex}`);
    } else {
        dlog("[AI Studio Exporter] 动态索引检测：无法确定可靠的索引位置，使用默认值");
        // 保持默认值
    }
}

/**
 * 检测思考回合
 * @param {Array} turn - 回合数据数组
 * @returns {boolean} - 是否为思考回合
 */
function isThinkingTurn(turn) {
    if (!Array.isArray(turn)) return false;
    
    // 首先尝试动态检测到的索引
    if (turn.length > detectedThinkingTurnIndex && turn[detectedThinkingTurnIndex] === 1) {
        return true;
    }
    
    // 如果动态索引失败，尝试默认索引
    if (turn.length > DEFAULT_THINKING_TURN_INDEX && turn[DEFAULT_THINKING_TURN_INDEX] === 1) {
        return true;
    }
    
    // 最后尝试基于内容的启发式检测
    // 思考回合通常包含"思考中"或类似的文本提示
    const text = extractTextFromTurn(turn).toLowerCase();
    return text.includes("thinking") || text.includes("思考中") || text.includes("正在思考");
}

/**
 * 检测回复回合
 * @param {Array} turn - 回合数据数组
 * @returns {boolean} - 是否为回复回合
 */
function isResponseTurn(turn) {
    if (!Array.isArray(turn)) return false;
    
    // 首先尝试动态检测到的索引
    if (turn.length > detectedResponseTurnIndex && turn[detectedResponseTurnIndex] === 1) {
        return true;
    }
    
    // 如果动态索引失败，尝试默认索引
    if (turn.length > DEFAULT_RESPONSE_TURN_INDEX && turn[DEFAULT_RESPONSE_TURN_INDEX] === 1) {
        return true;
    }
    
    // 最后尝试基于内容和结构的启发式检测
    // 回复回合通常是模型的回答，包含较长的文本，且不是用户回合或思考回合
    if (isThinkingTurn(turn)) return false;
    
    const text = extractTextFromTurn(turn);
    const isUserTurn = Array.isArray(turn) && turn.includes('user');
    
    return !isUserTurn && text.length > 10; // 非用户回合且文本较长，可能是回复
}

    // ==========================================
    // 5. DOM 查询缓存 (新增 - 性能优化)
    // ==========================================
    const DOMCache = {
        cache: new Map(),
        maxCacheSize: 1000,
        hitCount: 0,
        missCount: 0,

        /**
         * 生成缓存键
         * @param {HTMLElement} element - DOM元素
         * @param {string} selector - 选择器
         * @returns {string} - 缓存键
         */
        generateKey(element, selector) {
            if (!element || !element.id) return null;
            return `${element.id}::${selector}`;
        },

        /**
         * 从缓存获取查询结果
         * @param {HTMLElement} element - DOM元素
         * @param {string} selector - 选择器
         * @returns {Element|null} - 查询结果
         */
        get(element, selector) {
            const key = this.generateKey(element, selector);
            if (!key) return null;

            const cached = this.cache.get(key);
            if (cached) {
                // 验证元素是否仍在DOM中
                if (document.contains(cached)) {
                    this.hitCount++;
                    UsageStats.recordCacheHit();
                    return cached;
                } else {
                    this.cache.delete(key);
                }
            }
            this.missCount++;
            UsageStats.recordCacheMiss();
            return null;
        },

        /**
         * 将查询结果存入缓存
         * @param {HTMLElement} element - DOM元素
         * @param {string} selector - 选择器
         * @param {Element} result - 查询结果
         */
        set(element, selector, result) {
            const key = this.generateKey(element, selector);
            if (!key || !result) return;

            // 限制缓存大小
            if (this.cache.size >= this.maxCacheSize) {
                // 清除最旧的缓存项
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }

            this.cache.set(key, result);
        },

        /**
         * 清除所有缓存
         */
        clear() {
            this.cache.clear();
            this.hitCount = 0;
            this.missCount = 0;
        },

        /**
         * 获取缓存统计信息
         * @returns {Object} - 统计信息
         */
        getStats() {
            const total = this.hitCount + this.missCount;
            const hitRate = total > 0 ? (this.hitCount / total * 100).toFixed(2) : 0;
            return {
                size: this.cache.size,
                hitCount: this.hitCount,
                missCount: this.missCount,
                hitRate: `${hitRate}%`
            };
        }
    };

    /**
     * 带缓存的querySelector
     * @param {HTMLElement} element - DOM元素
     * @param {string} selector - 选择器
     * @returns {Element|null} - 查询结果
     */
    function cachedQuerySelector(element, selector) {
        // 先尝试从缓存获取
        const cached = DOMCache.get(element, selector);
        if (cached) return cached;

        // 缓存未命中，执行查询
        const result = element.querySelector(selector);
        if (result) {
            DOMCache.set(element, selector, result);
        }
        return result;
    }

    /**
     * 带缓存的querySelectorAll
     * @param {HTMLElement} element - DOM元素
     * @param {string} selector - 选择器
     * @returns {NodeList} - 查询结果
     */
    function cachedQuerySelectorAll(element, selector) {
        // querySelectorAll 不缓存，因为返回NodeList且可能变化
        // 只对单个元素查询进行缓存
        return element.querySelectorAll(selector);
    }

    // ==========================================
    // 8. 内存管理
    // ==========================================

    const MemoryManager = {
        cleanupInterval: null,
        lastCleanupTime: 0,
        cleanupThreshold: 10 * 1024 * 1024, // 10MB

        startAutoCleanup() {
            if (this.cleanupInterval) return;
            this.cleanupInterval = setInterval(() => {
                this.performCleanup();
            }, CONFIG_CONSTANTS.CACHE_CLEANUP_INTERVAL);
        },

        stopAutoCleanup() {
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
                this.cleanupInterval = null;
            }
        },

        performCleanup() {
            const now = Date.now();
            if (now - this.lastCleanupTime < CONFIG_CONSTANTS.CACHE_CLEANUP_INTERVAL) {
                return;
            }

            dlog('MemoryManager: Starting cleanup...');

            // 清理过期缓存
            clearExpiredCache();

            // 清理DOM缓存
            DOMCache.clear();

            // 清理性能监控数据
            PerformanceMonitor.reset();

            // 清理错误统计
            ErrorHandler.reset();

            this.lastCleanupTime = now;
            dlog('MemoryManager: Cleanup completed');
        },

        getMemoryUsage() {
            if (performance.memory) {
                return {
                    usedJSHeapSize: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
                    totalJSHeapSize: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
                    jsHeapSizeLimit: (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + ' MB'
                };
            }
            return null;
        },

        checkMemoryPressure() {
            const usage = this.getMemoryUsage();
            if (usage) {
                const used = parseFloat(usage.usedJSHeapSize);
                const total = parseFloat(usage.totalJSHeapSize);
                const ratio = used / total;

                if (ratio > 0.8) {
                    dlog(`MemoryManager: High memory usage detected (${(ratio * 100).toFixed(1)}%)`);
                    this.performCleanup();
                    return true;
                }
            }
            return false;
        }
    };

    // ==========================================
    // 9. 使用统计和分析
    // ==========================================

    const UsageStats = {
        stats: {
            totalExports: 0,
            totalCharacters: 0,
            totalTurns: 0,
            lastExportTime: null,
            exportModes: new Map(),
            errorCount: 0,
            averageExportTime: 0,
            cacheHits: 0,
            cacheMisses: 0
        },

        recordExport(mode, characterCount, turnCount, duration) {
            this.stats.totalExports++;
            this.stats.totalCharacters += characterCount;
            this.stats.totalTurns += turnCount;
            this.stats.lastExportTime = new Date().toISOString();

            const modeCount = this.stats.exportModes.get(mode) || 0;
            this.stats.exportModes.set(mode, modeCount + 1);

            if (duration) {
                const currentAvg = this.stats.averageExportTime;
                const totalExports = this.stats.totalExports;
                this.stats.averageExportTime = (currentAvg * (totalExports - 1) + duration) / totalExports;
            }

            this.saveStats();
        },

        recordError() {
            this.stats.errorCount++;
            this.saveStats();
        },

        recordCacheHit() {
            this.stats.cacheHits++;
        },

        recordCacheMiss() {
            this.stats.cacheMisses++;
        },

        getStats() {
            return {
                ...this.stats,
                exportModes: Object.fromEntries(this.stats.exportModes),
                cacheHitRate: this.stats.cacheHits + this.stats.cacheMisses > 0
                    ? ((this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100).toFixed(2) + '%'
                    : '0%'
            };
        },

        saveStats() {
            try {
                const statsToSave = {
                    ...this.stats,
                    exportModes: Object.fromEntries(this.stats.exportModes)
                };
                GM_setValue('aistudio_usage_stats', JSON.stringify(statsToSave));
            } catch (e) {
                dlog('Failed to save usage stats:', e);
            }
        },

        loadStats() {
            try {
                const saved = GM_getValue('aistudio_usage_stats', null);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    this.stats = {
                        ...this.stats,
                        ...parsed,
                        exportModes: new Map(Object.entries(parsed.exportModes || {}))
                    };
                }
            } catch (e) {
                dlog('Failed to load usage stats:', e);
            }
        },

        resetStats() {
            this.stats = {
                totalExports: 0,
                totalCharacters: 0,
                totalTurns: 0,
                lastExportTime: null,
                exportModes: new Map(),
                errorCount: 0,
                averageExportTime: 0,
                cacheHits: 0,
                cacheMisses: 0
            };
            this.saveStats();
        }
    };

    // 初始化时加载统计
    UsageStats.loadStats();

    // ==========================================
    // 10. 模式检测和切换
    // ==========================================

    function detectCurrentMode() {
        const firstUserTurn = document.querySelector('ms-chat-turn .chat-turn-container.user');
        if (firstUserTurn) {
            const hasRawContainer = firstUserTurn.querySelector('ms-text-chunk .very-large-text-container');
            const hasCmarkNode = firstUserTurn.querySelector('ms-text-chunk ms-cmark-node');

            if (hasRawContainer && !hasCmarkNode) {
                dlog("Detected mode: Raw Mode");
                return 'raw';
            }
            if (hasCmarkNode && !hasRawContainer) {
                dlog("Detected mode: Rendered Mode");
                return 'rendered';
            }
        }

        dlog("Could not detect mode, assuming Rendered Mode");
        return 'rendered';
    }

    async function toggleRawMode() {
        dlog("Attempting to toggle Raw Mode silently...");

        try {
            const moreButton = document.querySelector('button[aria-label="View more actions"]');
            if (!moreButton) {
                dlog("Error: 'More actions' button not found.");
                return false;
            }

            moreButton.click();

            const menuItems = document.querySelectorAll('.cdk-overlay-container .mat-mdc-menu-content button[role="menuitem"]');
            let rawModeClicked = false;

            for (const item of menuItems) {
                if (item.textContent.includes('Raw Mode')) {
                    item.click();
                    rawModeClicked = true;
                    dlog("Raw Mode toggled silently.");
                    break;
                }
            }

            if (!rawModeClicked) {
                document.body.click();
                dlog("Error: 'Raw Mode' button not found in menu.");
                return false;
            }

            await new Promise(resolve => setTimeout(resolve, CONFIG_CONSTANTS.RAW_MODE_RENDER_DELAY_MS));
            return true;

        } catch (error) {
            dlog(`Error toggling Raw Mode: ${error.message}`);
            return false;
        }
    }

    // ==========================================
    // 11. 设置面板
    // ==========================================
    const SettingsPanel = {
        shadowHost: null,
        shadowRoot: null,
        panel: null,
        isOpen: false,
        checkboxRefs: {},
        toggleSwitch: null,
        toggleLabelXHR: null,
        toggleLabelDOM: null,
        closeHandler: null,
        escapeHandler: null,

        init() {
            if (this.shadowHost) return;

            this.shadowHost = document.createElement('div');
            this.shadowHost.id = 'aistudio-export-settings-host';
            Object.assign(this.shadowHost.style, {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '0',
                height: '0',
                overflow: 'visible',
                zIndex: '2147483647',
                pointerEvents: 'none'
            });

            this.shadowRoot = this.shadowHost.attachShadow({ mode: 'open' });

            const style = document.createElement('style');
            style.textContent = `
                :host {
                    all: initial;
                }
                * {
                    box-sizing: border-box;
                }
            `;
            this.shadowRoot.appendChild(style);

            this.panel = document.createElement('div');
            this.panel.className = 'settings-panel';
            this.panel.style.display = 'none';

            const closeButton = document.createElement('button');
            closeButton.className = 'close-button';
            closeButton.textContent = '✕';
            closeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hide();
            });
            this.panel.appendChild(closeButton);

            const title = document.createElement('div');
            title.className = 'section-title';
            title.textContent = t('settings_title');
            this.panel.appendChild(title);

            const createCheckbox = (id, label, configKey, isSubOption = false) => {
                const wrapper = document.createElement('label');
                if (isSubOption) wrapper.classList.add('sub-option');

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = id;
                checkbox.checked = CONFIG[configKey];

                checkbox.addEventListener('change', (e) => {
                    e.stopPropagation();
                    CONFIG[configKey] = checkbox.checked;
                    saveSettings();
                    this.updateCheckboxStates();
                });

                const text = document.createTextNode(label);
                wrapper.appendChild(checkbox);
                wrapper.appendChild(text);

                return { wrapper, checkbox };
            };

            const userCheck = createCheckbox('exp-user', t('settings_include_user'), 'INCLUDE_USER');
            const modelCheck = createCheckbox('exp-model', t('settings_include_model'), 'INCLUDE_MODEL');
            const thinkingCheck = createCheckbox('exp-thinking', t('settings_include_thinking'), 'INCLUDE_THINKING', true);
            const collapsibleCheck = createCheckbox('exp-collapsible', t('settings_collapsible_thinking'), 'COLLAPSIBLE_THINKING', true);

            this.checkboxRefs = { userCheck, modelCheck, thinkingCheck, collapsibleCheck };

            this.panel.appendChild(userCheck.wrapper);
            this.panel.appendChild(modelCheck.wrapper);
            this.panel.appendChild(thinkingCheck.wrapper);
            this.panel.appendChild(collapsibleCheck.wrapper);

            const separator = document.createElement('div');
            separator.className = 'separator';
            this.panel.appendChild(separator);

            // 添加使用统计部分
            const statsTitle = document.createElement('div');
            statsTitle.className = 'section-title';
            statsTitle.textContent = '使用统计';
            this.panel.appendChild(statsTitle);

            const statsContainer = document.createElement('div');
            statsContainer.className = 'stats-container';
            statsContainer.style.cssText = `
                font-size: 12px;
                color: #666;
                padding: 8px 0;
                line-height: 1.6;
            `;

            const updateStatsDisplay = () => {
                const stats = UsageStats.getStats();
                const memoryUsage = MemoryManager.getMemoryUsage();
                const domCacheStats = DOMCache.getStats();

                let statsHTML = `
                    <div style="margin-bottom: 8px;">
                        <strong>导出统计:</strong><br>
                        总导出次数: ${stats.totalExports}<br>
                        总字符数: ${stats.totalCharacters.toLocaleString()}<br>
                        总回合数: ${stats.totalTurns}<br>
                        平均导出时间: ${stats.averageExportTime.toFixed(2)}ms<br>
                        错误次数: ${stats.errorCount}
                    </div>
                    <div style="margin-bottom: 8px;">
                        <strong>导出模式:</strong><br>
                        ${Object.entries(stats.exportModes).map(([mode, count]) => `${mode}: ${count}次`).join('<br>') || '无'}
                    </div>
                    <div style="margin-bottom: 8px;">
                        <strong>缓存统计:</strong><br>
                        缓存命中率: ${stats.cacheHitRate}<br>
                        DOM缓存: ${domCacheStats.hitRate} (${domCacheStats.size}项)
                    </div>
                `;

                if (memoryUsage) {
                    statsHTML += `
                        <div>
                            <strong>内存使用:</strong><br>
                            已用: ${memoryUsage.usedJSHeapSize}<br>
                            总计: ${memoryUsage.totalJSHeapSize}<br>
                            限制: ${memoryUsage.jsHeapSizeLimit}
                        </div>
                    `;
                }

                statsContainer.innerHTML = statsHTML;
            };

            const resetStatsButton = document.createElement('button');
            resetStatsButton.textContent = '重置统计';
            resetStatsButton.style.cssText = `
                margin-top: 8px;
                padding: 4px 12px;
                font-size: 11px;
                background: #f5f5f5;
                border: 1px solid #ddd;
                border-radius: 4px;
                cursor: pointer;
            `;
            resetStatsButton.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('确定要重置所有使用统计吗？')) {
                    UsageStats.resetStats();
                    updateStatsDisplay();
                }
            });

            this.panel.appendChild(statsContainer);
            this.panel.appendChild(resetStatsButton);

            // 保存更新统计的函数以便后续调用
            this.updateStatsDisplay = updateStatsDisplay;

            const methodTitle = document.createElement('div');
            methodTitle.className = 'section-title';
            methodTitle.textContent = t('settings_extraction_method');
            this.panel.appendChild(methodTitle);

            const toggleContainer = document.createElement('div');
            toggleContainer.className = 'toggle-container';

            this.toggleLabelXHR = document.createElement('span');
            this.toggleLabelXHR.className = 'toggle-label';
            this.toggleLabelXHR.textContent = t('settings_xhr');
            this.toggleLabelXHR.addEventListener('click', () => this.setExtractionMode('xhr'));

            this.toggleSwitch = document.createElement('div');
            this.toggleSwitch.className = 'toggle-switch';
            this.toggleSwitch.addEventListener('click', () => {
                const newMode = CONFIG.EXTRACTION_MODE === 'xhr' ? 'dom' : 'xhr';
                this.setExtractionMode(newMode);
            });

            this.toggleLabelDOM = document.createElement('span');
            this.toggleLabelDOM.className = 'toggle-label';
            this.toggleLabelDOM.textContent = t('settings_dom');
            this.toggleLabelDOM.addEventListener('click', () => this.setExtractionMode('dom'));

            toggleContainer.appendChild(this.toggleLabelXHR);
            toggleContainer.appendChild(this.toggleSwitch);
            toggleContainer.appendChild(this.toggleLabelDOM);

            this.panel.appendChild(toggleContainer);

            let toggleTooltipTimeout = null;
            let toggleTooltipElement = null;

            const showToggleTooltip = () => {
                toggleTooltipTimeout = setTimeout(() => {
                    toggleTooltipElement = document.createElement('div');
                    toggleTooltipElement.style.cssText = `
                        position: fixed;
                        background: #3c4043;
                        color: #e8eaed;
                        padding: 8px 12px;
                        border-radius: 4px;
                        font-family: 'Google Sans', Roboto, sans-serif;
                        font-size: 11px;
                        z-index: 2147483648;
                        pointer-events: none;
                        white-space: pre;
                        width: max-content;
                        max-width: calc(100vw - 24px);
                        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                        line-height: 1.4;
                    `;
                    toggleTooltipElement.textContent = t('settings_tooltip');

                    this.shadowRoot.appendChild(toggleTooltipElement);

                    const rect = toggleContainer.getBoundingClientRect();
                    const tooltipRect = toggleTooltipElement.getBoundingClientRect();

                    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                    if (left < 8) left = 8;
                    if (left + tooltipRect.width > window.innerWidth - 8) {
                        left = window.innerWidth - tooltipRect.width - 8;
                    }

                    let top;
                    const spaceAbove = rect.top - 8;
                    const spaceBelow = window.innerHeight - rect.bottom - 8;

                    if (spaceAbove >= tooltipRect.height + 8) {
                        top = rect.top - tooltipRect.height - 8;
                    } else if (spaceBelow >= tooltipRect.height + 16) {
                        top = rect.bottom + 16;
                    } else {
                        top = rect.top - tooltipRect.height - 8;
                    }

                    toggleTooltipElement.style.left = `${left}px`;
                    toggleTooltipElement.style.top = `${top}px`;
                }, 1000);
            };

            const hideToggleTooltip = () => {
                if (toggleTooltipTimeout) {
                    clearTimeout(toggleTooltipTimeout);
                    toggleTooltipTimeout = null;
                }
                if (toggleTooltipElement) {
                    toggleTooltipElement.remove();
                    toggleTooltipElement = null;
                }
            };

            toggleContainer.addEventListener('mouseenter', showToggleTooltip);
            toggleContainer.addEventListener('mouseleave', hideToggleTooltip);

            this.shadowRoot.appendChild(this.panel);
            document.body.appendChild(this.shadowHost);

            this.panel.addEventListener('mousedown', (e) => e.stopPropagation());
            this.panel.addEventListener('mouseup', (e) => e.stopPropagation());
            this.panel.addEventListener('click', (e) => e.stopPropagation());
            this.panel.addEventListener('pointerdown', (e) => e.stopPropagation());
            this.panel.addEventListener('pointerup', (e) => e.stopPropagation());

            this.updateCheckboxStates();
            this.updateToggleState();
        },

        setExtractionMode(mode) {
            CONFIG.EXTRACTION_MODE = mode;
            saveSettings();
            this.updateToggleState();
            dlog(`Extraction mode set to: ${mode.toUpperCase()}`);
        },

        updateToggleState() {
            if (!this.toggleSwitch || !this.toggleLabelXHR || !this.toggleLabelDOM) return;

            if (CONFIG.EXTRACTION_MODE === 'xhr') {
                this.toggleSwitch.classList.remove('dom');
                this.toggleLabelXHR.classList.add('active');
                this.toggleLabelDOM.classList.remove('active');
            } else {
                this.toggleSwitch.classList.add('dom');
                this.toggleLabelXHR.classList.remove('active');
                this.toggleLabelDOM.classList.add('active');
            }
        },

        updateCheckboxStates() {
            const { thinkingCheck, collapsibleCheck } = this.checkboxRefs;
            if (!thinkingCheck || !collapsibleCheck) return;

            thinkingCheck.checkbox.disabled = !CONFIG.INCLUDE_MODEL;
            thinkingCheck.wrapper.style.opacity = CONFIG.INCLUDE_MODEL ? '1' : '0.5';
            if (!CONFIG.INCLUDE_MODEL) {
                CONFIG.INCLUDE_THINKING = false;
                thinkingCheck.checkbox.checked = false;
                saveSettings();
            }

            collapsibleCheck.checkbox.disabled = !CONFIG.INCLUDE_THINKING;
            collapsibleCheck.wrapper.style.opacity = CONFIG.INCLUDE_THINKING ? '1' : '0.5';
        },

        show(anchorElement) {
            if (!this.shadowHost) this.init();

            if (!document.body.contains(this.shadowHost)) {
                document.body.appendChild(this.shadowHost);
            }

            this.checkboxRefs.userCheck.checkbox.checked = CONFIG.INCLUDE_USER;
            this.checkboxRefs.modelCheck.checkbox.checked = CONFIG.INCLUDE_MODEL;
            this.checkboxRefs.thinkingCheck.checkbox.checked = CONFIG.INCLUDE_THINKING;
            this.checkboxRefs.collapsibleCheck.checkbox.checked = CONFIG.COLLAPSIBLE_THINKING;
            this.updateCheckboxStates();
            this.updateToggleState();

            // 更新使用统计显示
            if (this.updateStatsDisplay) {
                this.updateStatsDisplay();
            }

            const rect = anchorElement.getBoundingClientRect();
            this.panel.style.top = `${rect.bottom + 4}px`;
            this.panel.style.right = `${window.innerWidth - rect.right}px`;
            this.panel.style.left = 'auto';

            this.panel.style.display = 'block';
            this.isOpen = true;

            if (this.closeHandler) {
                document.removeEventListener('mousedown', this.closeHandler, true);
            }

            this.closeHandler = (e) => {
                if (!this.isOpen) return;

                const path = e.composedPath();
                if (path.includes(this.shadowHost)) return;

                if (e.target === entryButton || entryButton.contains(e.target)) return;

                this.hide();
            };

            this.escapeHandler = (e) => {
                if (e.key === 'Escape' && this.isOpen) {
                    this.hide();
                }
            };

            setTimeout(() => {
                document.addEventListener('mousedown', this.closeHandler, true);
                document.addEventListener('keydown', this.escapeHandler, true);
            }, CONFIG_CONSTANTS.RAW_MODE_MENU_DELAY_MS / 2);
        },

        hide() {
            if (this.panel) {
                this.panel.style.display = 'none';
            }
            this.isOpen = false;

            if (this.closeHandler) {
                document.removeEventListener('mousedown', this.closeHandler, true);
                this.closeHandler = null;
            }

            if (this.escapeHandler) {
                document.removeEventListener('keydown', this.escapeHandler, true);
                this.escapeHandler = null;
            }
        },

        toggle(anchorElement) {
            if (this.isOpen) {
                this.hide();
            } else {
                this.show(anchorElement);
            }
        }
    };

    // ==========================================
    // 12. UI 逻辑
    // ==========================================

    /**
     * 创建模式选择按钮的通用函数
     * @param {string} id - 按钮ID
     * @param {string} text - 按钮文本
     * @param {boolean} isPrimary - 是否为主按钮
     * @param {Function} onClick - 点击事件处理函数
     * @param {HTMLElement} container - 按钮容器
     * @returns {HTMLButtonElement} - 创建的按钮元素
     */
    function createModeButton(id, text, isPrimary, onClick, container) {
        const btn = document.createElement('button');
        btn.id = id;
        btn.className = (isPrimary ? 'ai-btn' : 'ai-btn ai-btn-secondary') + ' ai-mode-btn';
        btn.textContent = text;
        btn.onclick = onClick;
        if (container) {
            container.appendChild(btn);
        }
        return btn;
    }

    /**
     * 清理并准备按钮容器
     * @param {HTMLElement} btnContainer - 按钮容器
     */
    function prepareButtonContainer(btnContainer) {
        const saveBtn = overlay.querySelector('#ai-save-btn');
        const closeBtnEl = overlay.querySelector('#ai-close-btn');
        if (saveBtn) saveBtn.style.display = 'none';
        if (closeBtnEl) closeBtnEl.style.display = 'none';
        btnContainer.style.display = 'flex';
        btnContainer.querySelectorAll('.ai-mode-btn').forEach(btn => btn.remove());
    }

    /**
     * 统一的提示框显示函数
     * @param {string} title - 提示框标题
     * @param {string} status - 提示框状态文本
     * @param {Array} buttons - 按钮配置数组，每个元素包含 {id, text, isPrimary, value}
     * @returns {Promise} - 用户选择的结果
     */
    function showPrompt(title, status, buttons) {
        return new Promise((resolve, reject) => {
            initUI();
            titleEl.innerText = title;
            statusEl.innerHTML = status;
            countEl.innerText = '';
            
            const btnContainer = overlay.querySelector('.ai-btn-container');
            prepareButtonContainer(btnContainer);
            
            buttons.forEach(({ id, text, isPrimary, value, onClick }) => {
                createModeButton(id, text, isPrimary, () => {
                    if (onClick) onClick();
                    resolve(value);
                }, btnContainer);
            });
        });
    }

    function createEntryButton() {
        const existingBtn = document.getElementById('ai-entry-btn-v14');
        if (existingBtn) {
            entryButton = existingBtn;
            return;
        }
        const btn = document.createElement('button');
        btn.id = 'ai-entry-btn-v14';
        btn.className = 'ai-entry';
        btn.innerHTML = t('btn_export');
        btn.onclick = startProcess;
        btn.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            SettingsPanel.toggle(btn);
        };
        document.body.appendChild(btn);
        entryButton = btn;
    }

    function initUI() {
        // 先检查 DOM 中是否已有元素
        const existingOverlay = document.getElementById('ai-overlay-v14');
        if (existingOverlay) {
            overlay = existingOverlay;
            overlay.style.display = 'flex';
            // 重新初始化所有元素引用
            titleEl = overlay.querySelector('.ai-title');
            statusEl = overlay.querySelector('.ai-status');
            countEl = overlay.querySelector('.ai-count');
            closeBtn = overlay.querySelector('#ai-close-btn');
            const saveBtn = overlay.querySelector('#ai-save-btn');
            return;
        }
        overlay = document.createElement('div');
        overlay.id = 'ai-overlay-v14';
        overlay.innerHTML = `
            <div id="ai-box">
                <div class="ai-title">${t('title_ready')}</div>
                <div class="ai-banner">${t('banner_top')}</div>
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
            if (cachedExportBlob) {
                downloadBlob(cachedExportBlob, `Gemini_Chat_v14_${Date.now()}.${exportMode === 'full' ? 'zip' : 'md'}`);
                return;
            }
            try {
                const result = await downloadCollectedData();
                if (!result) {
                    updateUI('ERROR', t('err_no_data'));
                }
            } catch (err) {
                console.error("Failed to re-download file:", err);
                debugLog((t('err_runtime') + (err && err.message ? err.message : '')), 'error');
                updateUI('ERROR', t('err_runtime') + err.message);
            }
        };
    }

    function computeCounts(order, map, includeUser = false) {
        const turns = order.length;
        let paragraphs = 0;
        for (const id of order) {
            const item = map.get(id);
            if (!item) continue;
            if (item.role === ROLE_GEMINI && item.thoughts) paragraphs++;
            const textOut = (item.text || '').trim();
            if (textOut.length > 0) {
                if (includeUser) {
                    paragraphs++;
                } else if (item.role !== ROLE_USER) {
                    paragraphs++;
                }
            }
        }
        return { turns, paragraphs };
    }

    function getDualCounts() {
        return computeCounts(turnOrder, collectedData, false);
    }

    function resetExportState() {
        collectedData.clear();
        turnOrder.length = 0;
        processedTurnIds.clear();
        scannedAttachmentTurns.clear();
        cachedExportBlob = null;
        cancelRequested = false;
        hasFinished = false;
    }

    // 更新遮罩界面状态（支持多种流程状态）
    // Update overlay UI state (supports multiple workflow states)
    function updateUI(state, msg = "") {
        initUI();
        const saveBtn = overlay.querySelector('#ai-save-btn');
        const btnContainer = overlay.querySelector('.ai-btn-container');
        btnContainer.style.display = 'none';
        // Hide any mode-selection buttons by default; only show them from showModeSelection()
        btnContainer.querySelectorAll('.ai-mode-btn').forEach(btn => btn.style.display = 'none');

        if (state === 'COUNTDOWN') {
            titleEl.innerText = t('title_countdown');
            statusEl.innerHTML = t('status_countdown', msg);
            countEl.style.display = 'none';
            countEl.innerText = '';
        } else if (state === 'SCROLLING') {
            titleEl.innerText = t('title_scrolling');
            statusEl.innerHTML = t('status_scrolling');
            countEl.style.display = 'block';
            const { turns, paragraphs } = getDualCounts();
            countEl.innerText = `${t('ui_turns')}: ${turns}\n${t('ui_paragraphs')}: ${paragraphs}`;
        } else if (state === 'PACKAGING') {
            titleEl.innerText = t('title_scrolling');
            statusEl.innerHTML = msg + '<br>' + t('status_esc_hint');
            countEl.style.display = 'none';
        } else if (state === 'FINISHED') {
            titleEl.innerText = t('title_finished');
            statusEl.innerHTML = t('status_finished');
            const { turns, paragraphs } = getDualCounts();
            countEl.innerText = `${t('ui_turns')}: ${turns}\n${t('ui_paragraphs')}: ${paragraphs}`;
            btnContainer.style.display = 'flex';
            saveBtn.style.display = 'inline-block';
            closeBtn.style.display = 'inline-block';
        } else if (state === 'ERROR') {
            titleEl.innerText = t('title_error');
            statusEl.innerHTML = `<span class="ai-red">${msg}</span>`;
            debugLog(msg, 'error');
            btnContainer.style.display = 'flex';
            closeBtn.style.display = 'inline-block';
        }
    }

    // 显示导出模式选择（附件/纯文本）
    // Show export mode selection (attachments/text-only)
    function showModeSelection() {
        initUI();
        titleEl.innerText = t('title_mode_select');
        statusEl.innerHTML = t('status_mode_select');
        countEl.innerText = '';

        const btnContainer = overlay.querySelector('.ai-btn-container');
        prepareButtonContainer(btnContainer);

        return new Promise((resolve, reject) => {
            const fullBtn = createModeButton('ai-mode-full', t('btn_mode_full'), true, () => {
                exportMode = 'full';
                resolve('full');
            }, btnContainer);
            fullBtn.disabled = true;
            const fullHint = document.createElement('span');
            fullHint.className = 'ai-hint';
            fullHint.textContent = '（已合并至纯文本）';
            btnContainer.appendChild(fullHint);

            createModeButton('ai-mode-text', t('btn_mode_text'), false, () => {
                exportMode = 'text';
                resolve('text');
            }, btnContainer);

            createModeButton('ai-mode-close', t('btn_close'), false, () => {
                overlay.style.display = 'none';
                reject(new Error('Export cancelled by user.'));
            }, btnContainer);
        });
    }

    function debugLog(message, level = 'info') {
        try {
            if (!overlay) initUI();
            if (!statusEl) return;
            const line = document.createElement('div');
            if (level === 'error') {
                line.className = 'ai-red';
            }
            line.textContent = message;
            statusEl.appendChild(line);
        } catch (_) {}
    }

    window.addEventListener('error', (e) => {
        const msg = e && e.message ? e.message : 'Script error';
        debugLog(msg, 'error');
    });
    window.addEventListener('unhandledrejection', (e) => {
        const reason = e && e.reason ? (e.reason.message || String(e.reason)) : 'Unhandled rejection';
        debugLog(reason, 'error');
    });

    // 当 ZIP 库不可用时的回退提示（纯文本/重试/取消）
    // Fallback prompt when ZIP library is unavailable (text/retry/cancel)
    function showZipFallbackPrompt() {
        return showPrompt(t('title_zip_missing'), t('status_zip_missing'), [
            {
                id: 'ai-fallback-text',
                text: t('btn_mode_text'),
                isPrimary: true,
                value: 'text',
                onClick: () => exportMode = 'text'
            },
            {
                id: 'ai-retry-zip',
                text: t('btn_retry'),
                isPrimary: false,
                value: 'retry'
            },
            {
                id: 'ai-cancel',
                text: t('btn_cancel'),
                isPrimary: false,
                value: 'cancel',
                onClick: () => overlay.style.display = 'none'
            }
        ]);
    }

    // 用户按下 ESC 的取消提示（选择继续打包或改为纯文本）
    // Cancel prompt when user presses ESC (continue attachments or text-only)
    function showCancelPrompt() {
        return showPrompt(t('title_cancel'), t('status_cancel'), [
            {
                id: 'ai-cancel-text',
                text: t('btn_mode_text'),
                isPrimary: true,
                value: 'text'
            },
            {
                id: 'ai-cancel-retry',
                text: t('btn_retry'),
                isPrimary: false,
                value: 'retry'
            },
            {
                id: 'ai-cancel-close',
                text: t('btn_cancel'),
                isPrimary: false,
                value: 'cancel'
            }
        ]);
    }

    // ==========================================
    // 13. 核心流程
    // ==========================================
    // 导出主流程：模式选择 → 倒计时 → 采集 → 导出
    // Main export flow: mode select → countdown → capture → export
    async function processXHRData() {
        dlog("[AI Studio Exporter] 开始处理 XHR 数据...");
        
        try {
            // 检查 XHR 数据是否可用
            if (!capturedChatData) {
                dlog("[AI Studio Exporter] 没有捕获到 XHR 数据");
                return false;
            }
            
            const history = findHistoryRecursive(capturedChatData);
            if (!history || history.length === 0) {
                dlog("[AI Studio Exporter] 未找到聊天历史");
                return false;
            }
            
            dlog(`[AI Studio Exporter] 找到 ${history.length} 个聊天回合`);
            
            // 动态检测回合类型指示器的索引位置
            detectTurnIndicatorIndices(history);

            let processedCount = 0;
            const newTurnOrder = [];

            for (let i = 0; i < history.length; i++) {
                const turn = history[i];

                if (!isTurn(turn)) {
                    continue;
                }

                const isThinking = isThinkingTurn(turn);
                const isResponse = isResponseTurn(turn);

                let role = null;

                if (isThinking) {
                    if (!CONFIG.INCLUDE_THINKING) {
                        continue;
                    }
                    role = ROLE_GEMINI;
                } else if (isResponse) {
                    if (!CONFIG.INCLUDE_MODEL) {
                        continue;
                    }
                    role = ROLE_GEMINI;
                } else {
                    if (!CONFIG.INCLUDE_USER) {
                        continue;
                    }
                    role = ROLE_USER;
                }

                const text = extractTextFromTurn(turn);
                const turnId = `xhr_turn_${i}`;

                const entry = {
                    role: role,
                    text: text,
                    thoughts: null,
                    attachments: []
                };

                if (isThinking && CONFIG.INCLUDE_THINKING) {
                    entry.thoughts = text;
                    entry.text = "";
                }

                collectedData.set(turnId, entry);
                newTurnOrder.push(turnId);
                processedCount++;

                dlog(`[AI Studio Exporter] 处理回合 ${i + 1}/${history.length}: ${role}, 文本长度: ${text.length}`);
            }

            dlog(`[AI Studio Exporter] XHR 处理完成：成功处理 ${processedCount} 个回合`);

            // Update global turnOrder
            turnOrder.length = 0;
            turnOrder.push(...newTurnOrder);
            updateUI('SCROLLING', collectedData.size);

            return true;
        } catch (error) {
            dlog(`[AI Studio Exporter] XHR 数据处理错误: ${error.message}`);
            if (CONFIG_CONSTANTS.DEBUG) {
                console.error('[AI Studio Exporter] XHR processing detailed error:', error);
            }
            return false;
        }
    }

    /**
     * 启动导出流程，包括模式选择、倒计时、数据采集和导出
     * 
     * @returns {Promise<void>} - 表示导出流程完成的Promise
     */
    async function startProcess() {
        if (isRunning) return;
        resetExportState();

        autoFixFormFieldAttributes();

        // 显示模式选择
        try {
            await showModeSelection();
        } catch (e) {
            dlog('Export cancelled.');
            // isRunning is still false here, so no cleanup needed
            return;
        }

        isRunning = true; // Enable global ESC handler only after mode is selected

        for (let i = 3; i > 0; i--) {
            updateUI('COUNTDOWN', i);
            await sleep(1000);
        }

        // ========================================
        // 根据提取模式选择处理方式
        // ========================================
        dlog(`[AI Studio Exporter] 当前配置的提取模式: ${CONFIG.EXTRACTION_MODE}`);
        
        if (CONFIG.EXTRACTION_MODE === 'xhr') {
            dlog("[AI Studio Exporter] 使用 XHR 模式提取数据");
            const success = await processXHRData();

            if (!success) {
                dlog("[AI Studio Exporter] XHR 提取失败，回退到 DOM 模式");
                updateUI('SCROLLING', 0);
            } else {
                dlog("[AI Studio Exporter] XHR 提取成功，跳过 DOM 滚动");
                endProcess("FINISHED");
                return;
            }
        }

        // DOM 模式或 XHR 失败后的回退
        dlog("使用 DOM 模式提取数据");

        // ========================================
        // 模式检测和切换（仅 DOM 模式）
        // ========================================
        const currentMode = detectCurrentMode();
        dlog(`当前显示模式: ${currentMode}`);

        if (currentMode === 'rendered') {
            dlog("尝试切换到原始模式...");
            const toggleSuccess = await toggleRawMode();

            if (toggleSuccess) {
                dlog("成功切换到原始模式");
            } else {
                dlog("切换到原始模式失败，继续使用当前模式");
            }
        } else {
            dlog("当前已是原始模式，跳过切换");
        }

        await sleep(CONFIG_CONSTANTS.RAW_MODE_RENDER_DELAY_MS);

        let scroller = findRealScroller();

        // 移动端增强激活逻辑
        if (!scroller || scroller.scrollHeight <= scroller.clientHeight) {
            dlog("尝试主动激活滚动容器...");
            // 先尝试滚动 window
            window.scrollBy(0, 1);
            await sleep(CONFIG_CONSTANTS.SCROLL_DELAY_MS);
            scroller = findRealScroller();
        }

        // 如果还是找不到，尝试触摸激活
        if (!scroller || scroller.scrollHeight <= scroller.clientHeight) {
            dlog("尝试触摸激活...");
            const bubble = document.querySelector('ms-chat-turn');
            if (bubble) {
                bubble.scrollIntoView({ behavior: 'instant' });
                await sleep(CONFIG_CONSTANTS.RAW_MODE_MENU_DELAY_MS);
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
        dlog("尝试使用滚动条按钮跳转到第一个对话...");

        // 查找所有对话轮次按钮
        const scrollbarButtons = document.querySelectorAll('button[id^="scrollbar-item-"]');
        dlog(`找到 ${scrollbarButtons.length} 个对话轮次按钮`);

        if (scrollbarButtons.length > 0) {
            // 点击第一个按钮（最早的对话）
            const firstButton = scrollbarButtons[0];
            dlog("点击第一个对话按钮:", firstButton.getAttribute('name') || firstButton.id);
            firstButton.click();

            // 等待跳转和渲染
            await sleep(CONFIG_CONSTANTS.UPWARD_SCROLL_DELAY_MS + CONFIG_CONSTANTS.RAW_MODE_RENDER_DELAY_MS);
            dlog("跳转后 scrollTop:", scroller.scrollTop);
        } else {
            dlog("未找到滚动条按钮，使用备用方案...");
        }

        // 备用方案：如果按钮不存在或跳转失败，逐步向上滚动
        const initialScrollTop = scroller.scrollTop;
        if (initialScrollTop > 500) {
            dlog("执行备用滚动方案，当前 scrollTop:", initialScrollTop);
            let currentPos = initialScrollTop;
            let upwardAttempts = 0;
            const maxUpwardAttempts = 15; // 减少尝试次数

            while (currentPos > CONFIG_CONSTANTS.BOTTOM_DETECTION_TOLERANCE * 10 && upwardAttempts < maxUpwardAttempts) {
                upwardAttempts++;

                // 每次向上滚动一个视口高度
                const scrollAmount = Math.min(window.innerHeight, currentPos);
                scroller.scrollBy({ top: -scrollAmount, behavior: 'smooth' });

                await sleep(CONFIG_CONSTANTS.UPWARD_SCROLL_DELAY_MS / 2);

                const newPos = scroller.scrollTop;
                dlog(`向上滚动 ${upwardAttempts}/${maxUpwardAttempts}: ${currentPos} → ${newPos}`);

                // 如果卡住了，尝试直接设置
                if (Math.abs(newPos - currentPos) < CONFIG_CONSTANTS.MIN_SCROLL_DISTANCE_THRESHOLD * 2) {
                    dlog("检测到卡住，尝试直接设置...");
                    scroller.scrollTop = Math.max(0, currentPos - scrollAmount);
                    await sleep(CONFIG_CONSTANTS.RAW_MODE_RENDER_DELAY_MS);
                }

                currentPos = scroller.scrollTop;

                // 如果已经到顶部附近，退出
                if (currentPos < CONFIG_CONSTANTS.BOTTOM_DETECTION_TOLERANCE * 10) {
                    break;
                }
            }
        }

        // 最终确保到达顶部
        dlog("执行最终回到顶部，当前 scrollTop:", scroller.scrollTop);
        scroller.scrollTop = 0;
        await sleep(CONFIG_CONSTANTS.UPWARD_SCROLL_DELAY_MS / 2);

        // 再次确认
        if (scroller.scrollTop > CONFIG_CONSTANTS.BOTTOM_DETECTION_TOLERANCE) {
            scroller.scrollTo({ top: 0, behavior: 'instant' });
            await sleep(CONFIG_CONSTANTS.UPWARD_SCROLL_DELAY_MS / 2);
        }

        dlog("✓ 回到顶部完成，最终 scrollTop:", scroller.scrollTop);

        // 等待 DOM 稳定
        await sleep(CONFIG_CONSTANTS.UPWARD_SCROLL_DELAY_MS - CONFIG_CONSTANTS.RAW_MODE_MENU_DELAY_MS);





        let lastScrollTop = -9999;
        let stuckCount = 0;
        let scrollCount = 0;

        try {
            while (isRunning && scrollCount < CONFIG_CONSTANTS.MAX_SCROLL_ATTEMPTS) {
                scrollCount++;
                await captureData(scroller);
                updateUI('SCROLLING', collectedData.size);

                scroller.scrollBy({ top: CONFIG_CONSTANTS.SCROLL_INCREMENT_INITIAL, behavior: 'smooth' });

                await sleep(CONFIG_CONSTANTS.RAW_MODE_RENDER_DELAY_MS * 3);

                const currentScroll = scroller.scrollTop;

                if (Math.abs(currentScroll - lastScrollTop) <= CONFIG_CONSTANTS.MIN_SCROLL_DISTANCE_THRESHOLD) {
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

            if (scrollCount >= CONFIG_CONSTANTS.MAX_SCROLL_ATTEMPTS) {
                dlog(`达到最大滚动尝试次数 (${CONFIG_CONSTANTS.MAX_SCROLL_ATTEMPTS})`);
            }
        } catch (e) {
            console.error(e);
            endProcess("ERROR", t('err_runtime') + e.message);
            return;
        }

        // 执行最终数据收集，确保在不同滚动位置都能捕获到数据
        await performFinalCollection(scroller);

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
            if (fields.length > 0) debugLog('Auto-assigned name for ' + fields.length + ' form fields');
        } catch (_) {}
    }

    // ==========================================
    // 14. 辅助功能
    // ==========================================

    // Shared Regex Constants
    // Capture: 1=Alt/Text, 2=URL, 3=Optional title (supports ')' in URL and single/double-quoted titles)
    const IMG_REGEX = /!\[([^\]]*)\]\((.+?)(\s+["'][^"']*["'])?\)/g;
    const LINK_REGEX = /\[([^\]]*)\]\((.+?)(\s+["'][^"']*["'])?\)/g;
    const ROLE_USER = 'User';
    const ROLE_GEMINI = 'Gemini';
    const ROLE_GEMINI_THOUGHTS = 'Gemini-Thoughts';

    /**
     * 查找实际的滚动容器
     * @returns {HTMLElement} - 滚动容器元素
     */
    function findRealScroller() {
        // Prioritize finding chat turns within the main content area to avoid sidebars
        const bubble = document.querySelector('main ms-chat-turn') || document.querySelector('ms-chat-turn');
        if (!bubble) {
            return document.querySelector('div[class*="scroll"]') || document.body;
        }

        let el = bubble.parentElement;
        let depth = 0;
        while (el && el !== document.body && depth < CONFIG_CONSTANTS.SCROLL_PARENT_SEARCH_DEPTH) {
            const style = window.getComputedStyle(el);
            if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight >= el.clientHeight) {
                return el;
            }
            el = el.parentElement;
            depth++;
        }
    return document.documentElement;
}

/**
 * 规范化URL
 * @param {string} href - 原始URL
 * @returns {string} - 规范化后的URL
 */
function normalizeHref(href) {
    try {
        const raw = String(href || '').trim();
        if (!raw || raw === '#') return '';

        // 验证URL安全性
        if (!SecurityUtils.isValidUrl(raw)) {
            console.warn('[AI Studio Exporter] Invalid URL detected:', raw);
            return '';
        }

        const u = new URL(raw, window.location.href);
        return u.href;
    } catch (_) {
        return '';
    }
}

function filterHref(href) {
    if (!href) return false;

    // 验证URL安全性
    if (!SecurityUtils.isValidUrl(href)) {
        return false;
    }

    const lower = href.toLowerCase();
    if (lower.startsWith('http:') || lower.startsWith('https:')) return true;
    if (CONFIG_CONSTANTS.ATTACHMENT_COMBINED_FALLBACK && lower.startsWith('blob:')) return true;
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
        } catch (_) {}
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

    /**
     * 从DOM中捕获对话数据，包括用户和模型的消息、思考过程和附件
     * 
     * @param {HTMLElement} scroller - 滚动容器元素，默认为document
     * @returns {Promise<void>} - 表示数据收集完成的Promise
     */
    async function captureData(scroller = document) {
        // Scope the query to the scroller container to avoid capturing elements from other parts of the page
        const turns = scroller.querySelectorAll('ms-chat-turn');

        // Helper to derive a stable turn id from container or inner chunks
        const getTurnId = (el) => {
            if (el.id) return el.id;
            const chunk = el.querySelector('ms-prompt-chunk[id], ms-response-chunk[id], ms-thought-chunk[id]');
            return chunk ? chunk.id : null;
        };

        // Update turn order based on visible turns
        const visibleTurnIds = Array.from(new Set(Array.from(turns)
            .filter(t => t.offsetParent !== null && window.getComputedStyle(t).visibility !== 'hidden')
            .map(t => getTurnId(t))
            .filter(id => !!id)));
        updateTurnOrder(visibleTurnIds);

        for (const turn of turns) {
            // Check if the element is visible (offsetParent is null for hidden elements)
            if (turn.offsetParent === null || window.getComputedStyle(turn).visibility === 'hidden') continue;

            const turnId = getTurnId(turn);
            if (!turnId) continue;

            // 缓存DOM查询结果，减少重复查询
            const modelRoleElement = turn.querySelector('[data-turn-role="Model"]') || turn.querySelector('[class*="model-prompt-container"]');
            const role = modelRoleElement ? ROLE_GEMINI : ROLE_USER;
            const existing = collectedData.get(turnId) || { role };
            
            const thoughtChunkElement = role === ROLE_GEMINI ? turn.querySelector('ms-thought-chunk') : null;
            const hasThoughtChunkNow = !!thoughtChunkElement;

            if (processedTurnIds.has(turnId) && !(role === ROLE_GEMINI && !existing.thoughts && hasThoughtChunkNow)) continue;

            // Expand collapsed thinking sections
            let thoughtExpanded = false;
            if (role === ROLE_GEMINI) {
                const collapsedPanels = turn.querySelectorAll('mat-expansion-panel[aria-expanded="false"]');
                for (const panel of collapsedPanels) {
                    // 缓存面板内的查询结果，减少重复查询
                    const headerElement = panel.querySelector('.mat-expansion-panel-header-title');
                    const headerText = headerElement?.textContent?.toLowerCase() || '';
                    
                    const buttonElement = panel.querySelector('button[aria-expanded="false"]');
                    const buttonText = buttonElement?.textContent?.toLowerCase() || '';

                    if (headerText.includes('thought') || headerText.includes('thinking') ||
                        buttonText.includes('thought') || buttonText.includes('thinking')) {
                        if (buttonElement) {
                            buttonElement.click();
                            thoughtExpanded = true;
                        }
                    }
                }

                const thoughtChunks = turn.querySelectorAll('ms-thought-chunk');
                for (const chunk of thoughtChunks) {
                    const showMoreButton = chunk.querySelector('button[aria-expanded="false"], button:not([aria-expanded])');
                    if (showMoreButton && showMoreButton.textContent?.toLowerCase().includes('more')) {
                        showMoreButton.click();
                        thoughtExpanded = true;
                    }
                }
            }

            if (thoughtExpanded) {
                await sleep(CONFIG_CONSTANTS.THOUGHT_EXPAND_DELAY_MS);
            }

            // Extract download links from the original turn before stripping UI-only elements
            let dlLinks = extractDownloadLinksFromTurn(turn);
            if (dlLinks.length > 0) {
                const prev = existing.attachments || [];
                existing.attachments = Array.from(new Set([...prev, ...dlLinks]));
            }

            if ((!existing.attachments || existing.attachments.length === 0) && !scannedAttachmentTurns.has(turnId)) {
                const imgs = Array.from(turn.querySelectorAll('img'));
                const found = [];
                existing.attachmentScanAttempted = true;
                const scanImg = async (img) => {
                    const r1 = img.getBoundingClientRect();
                    img.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                    img.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                    await sleep(CONFIG_CONSTANTS.SCROLL_DELAY_MS + CONFIG_CONSTANTS.RAW_MODE_MENU_DELAY_MS);
                    const spans = turn.querySelectorAll('span.material-symbols-outlined, span.ms-button-icon-symbol');
                    spans.forEach(sp => {
                        const txt = (sp.textContent || '').trim().toLowerCase();
                        if (txt !== 'download' && txt !== '下载') return;
                        const a = sp.closest('a') || sp.parentElement?.querySelector('a[href]');
                        if (a) {
                            const r2 = a.getBoundingClientRect();
                            const cx1 = (r1.left + r1.right) / 2, cy1 = (r1.top + r1.bottom) / 2;
                            const cx2 = (r2.left + r2.right) / 2, cy2 = (r2.top + r2.bottom) / 2;
                            const dist = Math.hypot(cx1 - cx2, cy1 - cy2);
                            if (dist < CONFIG_CONSTANTS.ATTACHMENT_MAX_DIST) {
                                const href = a?.getAttribute('href') || '';
                                if (filterHref(href)) found.push(href);
                            }
                        }
                    });
                    img.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
                };
                await Promise.all(imgs.map(img => scanImg(img)));
                if (found.length > 0) {
                    const prev = existing.attachments || [];
                    existing.attachments = Array.from(new Set([...prev, ...found]));
                }
                scannedAttachmentTurns.add(turnId);
            }

            const clone = turn.cloneNode(true);
            const trash = ['.actions-container', '.turn-footer', 'button', 'mat-icon', 'ms-grounding-sources', 'ms-search-entry-point', '.role-label', '.ms-role-tag', 'svg', '.author-label'];
            trash.forEach(s => clone.querySelectorAll(s).forEach(e => e.remove()));

            if (role === ROLE_GEMINI) {
                const thoughtChunk = clone.querySelector('ms-thought-chunk');
                if (thoughtChunk) {
                    const thoughtsText = cleanMarkdown(htmlToMarkdown(thoughtChunk));
                    thoughtChunk.remove();
                    if (thoughtsText.length > 0 && !existing.thoughts) {
                        existing.thoughts = thoughtsText;
                    }
                }
            }

            const text = cleanMarkdown(htmlToMarkdown(clone));
            if (text.length > 0 && !existing.text) {
                existing.text = text;
            }

            if (existing.text || existing.thoughts || (Array.isArray(existing.attachments) && existing.attachments.length > 0)) {
                collectedData.set(turnId, existing);
                if (role === ROLE_USER || (role === ROLE_GEMINI && !!existing.text)) {
                    processedTurnIds.add(turnId);
                }
            }
        }
    }

    function findLastCommonIdx(newIds, oldOrder) {
        for (let i = newIds.length - 1; i >= 0; i--) {
            if (oldOrder.includes(newIds[i])) return i;
        }
        return -1;
    }

    function mergeWithOverlap(oldOrder, newIds) {
        const oldIdSet = new Set(oldOrder);
        const result = [...oldOrder];
        newIds.forEach((newId, index) => {
            if (!oldIdSet.has(newId)) {
                let prevInOldIdx = -1;
                for (let i = index - 1; i >= 0; i--) {
                    const neighborId = newIds[i];
                    const pos = result.indexOf(neighborId);
                    if (pos !== -1) { prevInOldIdx = pos; break; }
                }
                result.splice(prevInOldIdx + 1, 0, newId);
            }
        });
        return result;
    }

    function appendDisjointIds(oldOrder, newIds) {
        return [...oldOrder, ...newIds];
    }

    function updateTurnOrder(newIds) {
        if (!newIds || newIds.length === 0) return;
        if (turnOrder.length === 0) {
            turnOrder = [...newIds];
            return;
        }
        const firstCommonIdx = newIds.findIndex(id => turnOrder.includes(id));
        if (firstCommonIdx !== -1) {
            turnOrder = mergeWithOverlap(turnOrder, newIds);
        } else {
            turnOrder = appendDisjointIds(turnOrder, newIds);
        }
        turnOrder = [...new Set(turnOrder)];
    }

    function htmlToMarkdown(node, listContext = null, indent = 0) {
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
            const text = node.textContent;
            // Handle backticks inside inline code for correct Markdown rendering.
            if (text.includes('`')) {
                return `\`\` ${text} \`\``;
            }
            return `\`${text}\``;
        }

        // Headings
        if (/^h[1-6]$/.test(tag)) {
            const level = parseInt(tag[1]);
            return '\n' + '#'.repeat(level) + ' ' + getChildrenText(node, listContext, indent) + '\n';
        }

        // Bold
        if (tag === 'strong' || tag === 'b') {
            return `**${getChildrenText(node, listContext, indent)}**`;
        }

        // Italic
        if (tag === 'em' || tag === 'i') {
            return `*${getChildrenText(node, listContext, indent)}*`;
        }

        // Links
        if (tag === 'a') {
            const href = node.getAttribute('href') || '';
            const text = getChildrenText(node, listContext, indent);
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
                    // Pass indent + 1 to children
                    result += htmlToMarkdown(child, { type: listType, index: index }, indent + 1);
                } else {
                    // Pass indent + 1 to children even if not li (e.g. nested ul)
                    result += htmlToMarkdown(child, listContext, indent + 1);
                }
            }

            return result + '\n';
        }

        // List items - use context to determine format
        if (tag === 'li') {
            // Children of li are at the same indent level as the li itself (which is already indented by parent)
            const content = getChildrenText(node, listContext, indent);
            // Render bullet at indent - 1
            const indentStr = '  '.repeat(Math.max(0, indent - 1));
            if (listContext && listContext.type === 'ol') {
                return `${indentStr}${listContext.index}. ${content}\n`;
            } else {
                return `${indentStr}- ${content}\n`;
            }
        }

        // Line breaks
        if (tag === 'br') {
            return '  \n';
        }

        // Blockquotes - prefix each line with >
        if (tag === 'blockquote') {
            const content = getChildrenText(node, listContext, indent);
            // Split by lines and prefix each with "> "
            return '\n' + content.split('\n')
                .map(line => `> ${line}`)
                .join('\n') + '\n';
        }

        // Block elements
        if (['div', 'p'].includes(tag)) {
            return '\n' + getChildrenText(node, listContext, indent) + '\n';
        }

        return getChildrenText(node, listContext, indent);
    }

    function getChildrenText(node, listContext = null, indent = 0) {
        return Array.from(node.childNodes).map(child => htmlToMarkdown(child, listContext, indent)).join('');
    }

    function cleanMarkdown(str) {
        return str.trim().replace(/\n{3,}/g, '\n\n');
    }

    // Helper: Get role name for display
    function getRoleName(role) {
        const roleMap = {
            [ROLE_GEMINI_THOUGHTS]: t('role_thoughts'),
            [ROLE_GEMINI]: t('role_gemini'),
            [ROLE_USER]: t('role_user')
        };
        return roleMap[role] || role;
    }

    // Normalize: merge consecutive Gemini-thoughts-only into next Gemini text within the same segment
    function normalizeConversation() {
        if (turnOrder.length === 0 || collectedData.size === 0) return;
        
        // 第一步：识别合并关系
        const mergeMap = new Map(); // key: 要合并的thoughts条目ID, value: 目标text条目ID
        const skipIds = new Set(); // 要跳过的条目ID
        
        // 创建数据的深拷贝，避免修改原始数据
        const dataCopy = new Map();
        turnOrder.forEach(id => {
            const item = collectedData.get(id);
            if (item) {
                dataCopy.set(id, JSON.parse(JSON.stringify(item)));
            }
        });
        
        // 识别需要合并的条目
        turnOrder.forEach((id, i) => {
            const item = dataCopy.get(id);
            if (!item) return;
            
            // 寻找需要合并的thoughts条目
            if (item.role === ROLE_GEMINI && item.thoughts && !item.text) {
                // 向后查找下一个有text的Gemini条目
                const nextGeminiTextId = turnOrder.slice(i + 1)
                    .find(nextId => {
                        const nextItem = dataCopy.get(nextId);
                        return nextItem && nextItem.role === ROLE_GEMINI && nextItem.text;
                    });
                
                if (nextGeminiTextId) {
                    mergeMap.set(id, nextGeminiTextId);
                    skipIds.add(id);
                }
            }
        });
        
        // 第二步：执行合并并生成新的结构
        const newOrder = [];
        const newMap = new Map();
        
        turnOrder.forEach(id => {
            if (skipIds.has(id)) return; // 跳过已标记为合并的条目
            
            const item = dataCopy.get(id);
            if (!item) return;
            
            // 检查是否有需要合并到此条目的thoughts
            const mergedThoughtsIds = Array.from(mergeMap.entries())
                .filter(([_, targetId]) => targetId === id)
                .map(([sourceId]) => sourceId);
            
            // 合并所有相关的thoughts
            if (mergedThoughtsIds.length > 0) {
                const allThoughts = [item.thoughts, ...mergedThoughtsIds.map(thoughtId => dataCopy.get(thoughtId).thoughts)]
                    .filter(Boolean) // 过滤掉空值
                    .join('\n\n');
                
                item.thoughts = allThoughts;
            }
            
            newOrder.push(id);
            newMap.set(id, item);
        });
        
        turnOrder = newOrder;
        collectedData = newMap;
    }

    // 统计导出内容的段落数（不含 User 段落）
    // Count exported paragraphs (excluding User paragraphs)
    function countParagraphs() {
        return computeCounts(turnOrder, collectedData, false).paragraphs;
    }

    // Helper: Download text-only mode
    // 仅文本导出：生成 Markdown 并下载
    // Text-only export: generate Markdown and download
    async function downloadTextOnly() {
        let content = `# ${t('file_header')}` + "\n\n";
        content += `**${t('file_time')}:** ${new Date().toLocaleString()}` + "\n\n";
        content += `**${t('file_turns')}:** ${turnOrder.length}` + "\n\n";
        content += `**${t('file_paragraphs')}:** ${countParagraphs()}` + "\n\n";
        content += "---\n\n";

        for (const id of turnOrder) {
            const item = collectedData.get(id);
            if (!item) continue;
            if (item.role === ROLE_GEMINI && item.thoughts) {
                const processedThoughts = convertResourcesToLinks(item.thoughts || '');
                content += `## ${t('role_thoughts')}\n\n${processedThoughts}\n\n`;
                content += `---\n\n`;
            }
            const roleName = getRoleName(item.role);
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
        cachedExportBlob = blob;
        downloadBlob(blob, `Gemini_Chat_v14_${Date.now()}.md`);
        return;
    }

    // Generic Helper: Process resources (images or files)
    // 通用打包助手：并发下载资源、支持进度与取消
    // Generic packaging helper: concurrent downloads with progress and cancel support
    async function processResources(uniqueUrls, zipFolder, config) {
        const resourceMap = new Map();

        if (uniqueUrls.size > 0) {
            updateUI('PACKAGING', t(config.statusStart, { n: uniqueUrls.size }));
            let completedCount = 0;

            const abortController = new AbortController();
            const { signal } = abortController;
            let cancelIntervalId = null;

            // Check for cancellation requests
            cancelIntervalId = setInterval(() => {
                if (cancelRequested && !signal.aborted) {
                    abortController.abort();
                }
            }, CONFIG_CONSTANTS.SCROLL_DELAY_MS * 4);

            const promises = Array.from(uniqueUrls).map(async (url, index) => {
                if (signal.aborted) return;
                try {
                    const blob = await fetchResource(url, signal);
                    if (blob && !signal.aborted) {
                        const filename = config.filenameGenerator(url, index, blob);
                        zipFolder.file(filename, blob);
                        resourceMap.set(url, `${config.subDir}/${filename}`);
                    }
                } catch (e) {
                    if (e.name !== 'AbortError') {
                        console.error(`${config.subDir} download failed:`, url, e);
                        debugLog(`${config.subDir} download failed: ${url} (${e && e.message ? e.message : 'error'})`, 'error');
                    }
                }
                completedCount++;
                if (!signal.aborted && (completedCount % 5 === 0 || completedCount === uniqueUrls.size)) {
                    updateUI('PACKAGING', t(config.statusProgress, { c: completedCount, t: uniqueUrls.size }));
                }
            });

            try {
                await Promise.all(promises);
            } catch (e) {
                if (e.name !== 'AbortError') {
                    throw e;
                }
            } finally {
                clearInterval(cancelIntervalId);
            }
        }
        return resourceMap;
    }

    // Helper: Collect unique image URLs from all messages
    function collectImageUrls() {
        const uniqueUrls = new Set();
        for (const item of collectedData.values()) {
            const text = item.text || '';
            const thoughts = item.thoughts || '';

            for (const match of text.matchAll(IMG_REGEX)) {
                uniqueUrls.add(match[2]);
            }
            for (const match of thoughts.matchAll(IMG_REGEX)) {
                uniqueUrls.add(match[2]);
            }
        }
        return uniqueUrls;
    }

    // Helper: Process and download images
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

    // Helper: Collect unique file URLs from all messages
    function collectFileUrls() {
        const downloadableExtensions = ['.pdf', '.csv', '.txt', '.json', '.py', '.js', '.html', '.css', '.md', '.zip', '.tar', '.gz'];
        const uniqueUrls = new Set();

        const fileFilter = (match) => {
            // match[0].startsWith('!') check removed as it's ineffective for LINK_REGEX matches
            const url = match[2];
            const lowerUrl = url.toLowerCase();
            const isBlob = lowerUrl.startsWith('blob:');
            const isGoogleStorage = lowerUrl.includes('googlestorage') || lowerUrl.includes('googleusercontent');
            const hasExt = downloadableExtensions.some(ext => lowerUrl.split('?')[0].endsWith(ext));
            return isBlob || isGoogleStorage || hasExt;
        };

        for (const item of collectedData.values()) {
            const text = item.text || '';
            const thoughts = item.thoughts || '';

            for (const match of text.matchAll(LINK_REGEX)) {
                // Skip image-style markdown links: `![alt](url)`
                if (match.index > 0 && text[match.index - 1] === '!') continue;

                if (fileFilter(match)) {
                    uniqueUrls.add(match[2]);
                }
            }
            for (const match of thoughts.matchAll(LINK_REGEX)) {
                if (match.index > 0 && thoughts[match.index - 1] === '!') continue;
                if (fileFilter(match)) {
                    uniqueUrls.add(match[2]);
                }
            }
        }
        return uniqueUrls;
    }

    // Helper: Process and download files
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
                if (!decodedFilename || decodedFilename.length > 100) {
                    const extMatch = filename.match(/\.[^./?]+$/);
                    const ext = extMatch ? extMatch[0] : '';
                    decodedFilename = `file_${index}${ext}`;
                }
                return `${index}_${decodedFilename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            }
        });
    }

    // Helper: Generate Markdown content with URL replacements
    function generateMarkdownContent(imgMap, fileMap) {
        let content = `# ${t('file_header')}` + "\n\n";
        content += `**${t('file_time')}:** ${new Date().toLocaleString()}` + "\n\n";
        content += `**${t('file_turns')}:** ${turnOrder.length}` + "\n\n";
        content += `**${t('file_paragraphs')}:** ${countParagraphs()}` + "\n\n";
        content += "---\n\n";

        for (const id of turnOrder) {
            const item = collectedData.get(id);
            if (!item) continue;
            if (item.role === ROLE_GEMINI && item.thoughts) {
                let processedThoughts = item.thoughts;
                processedThoughts = processedThoughts.replace(IMG_REGEX, (match, alt, url, title) => {
                    if (imgMap.has(url)) {
                        const titleStr = title || '';
                        return `![${alt}](${imgMap.get(url)}${titleStr})`;
                    }
                    return match;
                });
                processedThoughts = processedThoughts.replace(LINK_REGEX, (match, text, url, title) => {
                    if (fileMap.has(url)) {
                        const titleStr = title || '';
                        return `[${text}](${fileMap.get(url)}${titleStr})`;
                    }
                    return match;
                });
                
                if (CONFIG.INCLUDE_THINKING) {
                    const cleanedContent = processedThoughts
                        .replace(/(\n\s*)+$/g, '')
                        .replace(/\n{3,}/g, '\n\n');
                    const quoted = cleanedContent.replace(/\n/g, '\n> ');
                    
                    if (CONFIG.COLLAPSIBLE_THINKING) {
                        content += `<details>\n<summary>${t('role_thoughts')}</summary>\n\n> ${quoted}\n\n</details>\n\n`;
                    } else {
                        content += `## ${t('role_thoughts')}\n\n> ${quoted}\n\n`;
                    }
                    content += `---\n\n`;
                }
            }

            const roleName = getRoleName(item.role);
            let processedText = (item.text || '').trim();
            const attachmentsMd = generateAttachmentsMarkdown(item);

            processedText = processedText.replace(IMG_REGEX, (match, alt, url, title) => {
                if (imgMap.has(url)) {
                    const titleStr = title || '';
                    return `![${alt}](${imgMap.get(url)}${titleStr})`;
                }
                return match;
            });
            processedText = processedText.replace(LINK_REGEX, (match, text, url, title) => {
                if (fileMap.has(url)) {
                    const titleStr = title || '';
                    return `[${text}](${fileMap.get(url)}${titleStr})`;
                }
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
        try {
            const u = new URL(url);
            let base = u.pathname.substring(u.pathname.lastIndexOf('/') + 1) || 'file';
            if (!base || base === 'file') {
                const qp = new URLSearchParams(u.search);
                base = qp.get('filename') || qp.get('file') || qp.get('name') || base;
            }
            return decodeURIComponent(base.replace(/^['"]+|['"]+$/g, ''));
        } catch (_) {
            const m = String(url).match(/[?&](?:filename|file|name)=([^&]+)/i);
            return m ? decodeURIComponent(m[1].replace(/^['"]+|['"]+$/g, '')) : 'file';
        }
    }

    function escapeMdLabel(s) {
        return String(s || '').replace(/\]/g, '\\]').replace(/\n/g, ' ');
    }

    function generateAttachmentsMarkdown(item) {
        const links = Array.isArray(item.attachments) ? item.attachments : [];
        if (links.length === 0 && !(CONFIG_CONSTANTS.ATTACHMENT_COMBINED_FALLBACK && item.attachmentScanAttempted)) {
            return '';
        }
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
        const replacedImages = text.replace(IMG_REGEX, (match, alt, url) => {
            const name = (alt && alt.trim().length > 0) ? alt.trim() : toFileName(url);
            return `[${name}](${url})`;
        });
        const replacedLinks = replacedImages.replace(LINK_REGEX, (match, textLabel, url) => {
            const name = (textLabel && textLabel.trim().length > 0) ? textLabel.trim() : toFileName(url);
            return `[${name}](${url})`;
        });
        return replacedLinks;
    }

    // 获取 JSZip：优先使用 IIFE 外部捕获的引用
    // Get JSZip: prefer the reference captured outside IIFE
    function getJSZip() {
        // 1. 使用 IIFE 外部捕获的引用（@require 加载的）
        if (_JSZipRef) {
            return _JSZipRef;
        }
        // 2. 检查当前作用域中的 JSZip
        if (typeof JSZip !== 'undefined') {
            return JSZip;
        }
        // 3. 检查页面上下文（通过 script 标签注入的）
        if (typeof unsafeWindow !== 'undefined' && typeof unsafeWindow.JSZip !== 'undefined') {
            return unsafeWindow.JSZip;
        }
        // 4. 检查 window 对象
        if (typeof window !== 'undefined' && typeof window.JSZip !== 'undefined') {
            return window.JSZip;
        }
        return null;
    }

    // 加载 JSZip 的备用方案（通过 blob URL 注入脚本绕过 CSP）
    // Fallback loader for JSZip (inject script via blob URL to bypass CSP)
    async function ensureJSZip() {
        const existing = getJSZip();
        if (existing) return existing;

        if (CONFIG_CONSTANTS.DISABLE_SCRIPT_INJECTION) {
            debugLog('Script injection disabled due to CSP. Use @require or choose text-only.', 'error');
            return null;
        }

        // GM 注入：依次尝试多 CDN
        if (typeof GM_xmlhttpRequest !== 'undefined') {
            for (const url of JSZIP_URLS) {
                try {
                    /* eslint-disable no-await-in-loop */
                    const lib = await new Promise((resolve, reject) => {
                        GM_xmlhttpRequest({
                            method: 'GET',
                            url,
                            responseType: 'blob',
                            onload: (response) => {
                                try {
                                    const blobUrl = URL.createObjectURL(response.response);
                                    const script = document.createElement('script');
                                    script.src = blobUrl;
                                    script.onload = () => {
                                        URL.revokeObjectURL(blobUrl);
                                        const loaded = getJSZip();
                                        loaded ? resolve(loaded) : reject(new Error('JSZip not defined after load'));
                                    };
                                    script.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error('JSZip script load failed')); };
                                    document.head.appendChild(script);
                                } catch (e) { reject(e); }
                            },
                            onerror: () => reject(new Error('JSZip download failed'))
                        });
                    });
                    if (lib) return lib;
                } catch (e) { debugLog('JSZip load failed: ' + url + ' (' + (e && e.message ? e.message : 'error') + ')', 'error'); }
            }
        }

        // script 注入：依次尝试多 CDN
        for (const url of JSZIP_URLS) {
            try {
                /* eslint-disable no-await-in-loop */
                const lib = await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = url;
                    script.onload = () => {
                        const loaded = getJSZip();
                        loaded ? resolve(loaded) : reject(new Error('JSZip not defined after load'));
                    };
                    script.onerror = () => reject(new Error('JSZip load failed'));
                    document.head.appendChild(script);
                });
                if (lib) return lib;
            } catch (e) { debugLog('JSZip script injection failed: ' + url + ' (' + (e && e.message ? e.message : 'error') + ')', 'error'); }
        }
        debugLog('All JSZip CDN attempts failed', 'error');
        throw new Error('All JSZip CDN attempts failed');
    }

    // Main function: orchestrate the download process
    // 导出调度：纯文本/附件模式、ZIP 生成与回退
    // Export orchestrator: text/attachments modes, ZIP generation & fallback
    async function downloadCollectedData() {
        if (collectedData.size === 0) return false;
        // Normalize conversation before exporting (affects both modes)
        normalizeConversation();

        // Text-only mode
        if (exportMode === 'text') {
            downloadTextOnly();
            return true;
        }

        // Full mode with attachments
        let JSZipLib = getJSZip();
        if (!JSZipLib) {
            try { JSZipLib = await ensureJSZip(); } catch (e) { console.error('ensureJSZip failed:', e); debugLog('ensureJSZip failed: ' + (e && e.message ? e.message : 'error'), 'error'); }
        }
        while (!JSZipLib) {
            const action = await showZipFallbackPrompt();
            if (action === 'text') {
                downloadTextOnly();
                return true;
            }
            if (action === 'retry') {
                try { JSZipLib = await ensureJSZip(); } catch (e) { console.error('ensureJSZip retry failed:', e); }
                continue;
            }
            return false;
        }
        const zip = new JSZipLib();
        const imgFolder = zip.folder("images");
        const fileFolder = zip.folder("files");

        // Process images and files in parallel (memory-efficient approach)
        const [imgMap, fileMap] = await Promise.all([
            processImages(imgFolder),
            processFiles(fileFolder)
        ]);

        // Generate final Markdown content
        const content = generateMarkdownContent(imgMap, fileMap);

        zip.file("chat_history.md", content);
        let zipBlob;
        try {
            zipBlob = await Promise.race([
                zip.generateAsync({ type: "blob" }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('ZIP timeout')), 15000))
            ]);
        } catch (e) {
            const action = await showZipFallbackPrompt();
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
        cachedExportBlob = zipBlob;
        downloadBlob(zipBlob, `Gemini_Chat_v14_${Date.now()}.zip`);

        return true;
    }

    // 资源下载：支持 GM_xmlhttpRequest 与 fetch，并内置超时
    // Resource fetcher: supports GM_xmlhttpRequest and fetch, with timeout
    function fetchResource(url, signal) {
        const timeoutMs = 10000;
        return new Promise((resolve) => {
            let settled = false;
            const timeout = setTimeout(() => { if (!settled) { settled = true; debugLog(`Resource fetch timed out: ${url}`, 'error'); resolve(null); } }, timeoutMs);
            const finish = (val) => { if (!settled) { settled = true; clearTimeout(timeout); resolve(val); } };

            // 检查信号是否已中止
            if (signal?.aborted) {
                finish(null);
                return;
            }

            // 设置信号中止处理
            const abortHandler = () => finish(null);
            signal?.addEventListener('abort', abortHandler);

            if (typeof GM_xmlhttpRequest !== 'undefined') {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: url,
                    responseType: "blob",
                    onload: (response) => {
                        signal?.removeEventListener('abort', abortHandler);
                        if (response.status >= 200 && response.status < 300) {
                            finish(response.response);
                        } else {
                            console.warn(`Resource fetch failed with status ${response.status}:`, url);
                            debugLog(`Resource fetch failed (${response.status}): ${url}`, 'error');
                            finish(null);
                        }
                    },
                    onerror: () => {
                        signal?.removeEventListener('abort', abortHandler);
                        debugLog(`Resource fetch network error: ${url}`, 'error');
                        finish(null);
                    },
                    onabort: () => {
                        signal?.removeEventListener('abort', abortHandler);
                        finish(null);
                    }
                });
            } else {
                fetch(url, { credentials: 'include', signal })
                    .then(r => {
                        signal?.removeEventListener('abort', abortHandler);
                        if (r.ok) return r.blob();
                        debugLog(`Fetch failed (${r.status}): ${url}`, 'error');
                        return null;
                    })
                    .then(finish)
                    .catch((e) => {
                        signal?.removeEventListener('abort', abortHandler);
                        if (e.name === 'AbortError') {
                            // 忽略中止错误，直接返回 null
                            finish(null);
                        } else {
                            debugLog(`Fetch error: ${url}`, 'error');
                            finish(null);
                        }
                    });
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
        if (hasFinished) return;
        hasFinished = true;
        isRunning = false;

        if (status === "FINISHED") {
            if (collectedData.size > 0) {
                // 记录使用统计
                const startTime = performance.now();
                downloadCollectedData().then(() => {
                    const duration = performance.now() - startTime;
                    
                    // 计算总字符数和回合数
                    let totalCharacters = 0;
                    let totalTurns = 0;
                    for (const [id, entry] of collectedData) {
                        totalCharacters += (entry.text || '').length + (entry.thoughts || '').length;
                        totalTurns++;
                    }
                    
                    // 记录导出统计
                    UsageStats.recordExport(exportMode, totalCharacters, totalTurns, duration);
                    
                    updateUI('FINISHED', collectedData.size);
                }).catch(err => {
                    console.error("Failed to generate and download file:", err);
                    UsageStats.recordError();
                    updateUI('ERROR', t('err_runtime') + err.message);
                });
            } else {
                updateUI('ERROR', t('err_no_data'));
            }
        } else {
            UsageStats.recordError();
            updateUI('ERROR', msg);
        }
    }

    /**
     * 执行最终数据收集，确保在不同滚动位置都能捕获到完整的数据
     *
     * 优化版本：只滚动到关键位置，减少不必要的滚动操作
     * 1. 如果当前不在顶部，先滚动到顶部
     * 2. 滚动到底部确保加载所有内容
     * 3. 在顶部和底部各收集一次数据
     *
     * @param {HTMLElement} scroller - 滚动容器元素
     * @returns {Promise<void>} - 表示最终数据收集完成的Promise
     */
    async function performFinalCollection(scroller) {
        dlog("执行最终数据收集...");

        const currentScrollTop = scroller.scrollTop;
        const isAtTop = currentScrollTop <= CONFIG_CONSTANTS.BOTTOM_DETECTION_TOLERANCE;
        const isAtBottom = currentScrollTop >= scroller.scrollHeight - scroller.clientHeight - CONFIG_CONSTANTS.BOTTOM_DETECTION_TOLERANCE;

        // 如果不在顶部，先滚动到顶部
        if (!isAtTop) {
            dlog("滚动到顶部...");
            scroller.scrollTop = 0;
            await sleep(CONFIG_CONSTANTS.FINAL_COLLECTION_DELAY_MS);
            await captureData(scroller);
        }

        // 滚动到底部确保加载所有内容
        if (!isAtBottom) {
            dlog("滚动到底部...");
            scroller.scrollTop = scroller.scrollHeight;
            await sleep(CONFIG_CONSTANTS.FINAL_COLLECTION_DELAY_MS);
            await captureData(scroller);
        }

        // 再次在顶部收集一次，确保捕获所有内容
        if (!isAtTop || !isAtBottom) {
            dlog("再次在顶部收集...");
            scroller.scrollTop = 0;
            await sleep(CONFIG_CONSTANTS.FINAL_COLLECTION_DELAY_MS);
            await captureData(scroller);
        }

        dlog(`最终数据收集完成。总记录数: ${collectedData.size}`);
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    // 全局 ESC 处理：弹出取消提示并根据选择继续或回退
    // Global ESC handler: show cancel prompt and proceed based on choice
    document.addEventListener('keydown', async e => {
        if (e.key !== 'Escape') return;
        if (!isRunning || isHandlingEscape) return;
        isHandlingEscape = true;
        try {
            cancelRequested = true;
            const choice = await showCancelPrompt();
            if (choice === 'text') {
                normalizeConversation();
                exportMode = 'text';
                try { await downloadTextOnly(); } catch (err) { debugLog('Text export failed: ' + (err && err.message ? err.message : 'error'), 'error'); }
                updateUI('FINISHED', collectedData.size);
                isRunning = false;
            } else if (choice === 'retry') {
                cancelRequested = false;
                exportMode = 'full';
                isRunning = true;
                try { await downloadCollectedData(); } catch (err) { debugLog('Retry export failed: ' + (err && err.message ? err.message : 'error'), 'error'); }
            } else {
                isRunning = false;
                overlay.style.display = 'none';
            }
        } finally {
            isHandlingEscape = false;
        }
    });

    // 确保DOM加载完成后再创建按钮
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            createEntryButton();
        });
    } else {
        createEntryButton();
    }
    // 设置定时器定期检查和创建入口按钮
    setInterval(createEntryButton, CONFIG_CONSTANTS.UPWARD_SCROLL_DELAY_MS * 2);

    // 导航处理：切换对话时清除缓存
    function clearCapturedData() {
        if (Date.now() - capturedTimestamp < CONFIG_CONSTANTS.UPWARD_SCROLL_DELAY_MS * 2) {
            return;
        }
        capturedChatData = null;
        capturedTimestamp = 0;
    }

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function() {
        clearCapturedData();
        clearOldCaches(); // 切换对话时清除旧缓存
        return originalPushState.apply(this, arguments);
    };

    history.replaceState = function() {
        clearCapturedData();
        clearOldCaches(); // 切换对话时清除旧缓存
        return originalReplaceState.apply(this, arguments);
    };

    window.addEventListener('popstate', function() {
        clearCapturedData();
        clearOldCaches(); // 切换对话时清除旧缓存
    });
})();
