# 🚀 Google AI Studio Exporter

[English](#english) | [中文](#chinese)

<div align="center">
  <img src="assets/screenshot-ui.svg" alt="UI Screenshot" width="600">
  
  <br><br>

  <!-- 浏览量徽章 -->
  <img src="https://visitor-badge.laobi.icu/badge?page_id=GhostXia.Google-AI-Studio-Exporter" alt="visitors">
  <!-- GitHub Stars 徽章 -->
  <img src="https://img.shields.io/github/stars/GhostXia/Google-AI-Studio-Exporter?style=flat-square&logo=github" alt="GitHub stars">
  <!-- License 徽章 -->
  <img src="https://img.shields.io/github/license/GhostXia/Google-AI-Studio-Exporter?style=flat-square" alt="license">
</div>

<span id="english"></span>

## English

### ✨ Features

This UserScript solves the problem of "Virtual Scrolling" in Google AI Studio, allowing you to export your full chat history with Gemini.

*   **⚡ XHR Mode (Instant)**: Intercepts network requests to capture data instantly without scrolling.
*   **🧠 Smart Auto-Scrolling**: Fallback DOM-based scrolling to load all content (solving the DOM detachment issue).
*   **🔄 Session Isolation**: Automatically detects URL changes and resets the exporter to prevent data contamination.
*   **📊 Real-time Badge**: A red badge on the export button shows the number of captured turns in real-time.
*   **📄 Multiple Formats**: Supports **Markdown (ZIP)**, **HTML**, and **Plain Text** exports.
*   **🧹 Clean Output**: Removes UI garbage and keeps only the dialogue, including "Thinking" processes.
*   **🎨 Interactive UI**: Beautiful overlay with progress tracking, countdown, and status indicators.
*   **🔒 Safety Lock**: Allows emergency stop via `ESC` key.

### 📦 Installation

1.  Install the **OrangeMonkey** extension.
    > ⚠️ **Note**: Tampermonkey is currently **NOT** supported.
2.  [👉 Click here to install](https://github.com/GhostXia/Google-AI-Studio-Exporter/raw/main/google-ai-studio-exporter.user.js)
3.  Open [Google AI Studio](https://aistudio.google.com/).
4.  You will see a **"🚀 Export"** button on the bottom right.

### 📖 Usage

1.  Click the **Export Button** on the bottom right corner.
2.  Choose your preferred **Extraction Mode** in Settings (XHR is recommended).
3.  Select the **Export Format** (ZIP, HTML, or Text).
4.  Wait for the process to complete (or watch the badge count up!).
5.  Once finished, the file will be downloaded automatically.

> **Tip**: Press `ESC` key at any time to stop and save what has been captured so far.

### 📝 Example Output

```text
Google AI Studio Chat History
Time: 2025/12/31 20:00:00
Turns: 42
----------------------------------------

## User
Analyze the provided code snippet.

---

## Gemini
Here is the analysis of the code...
[Code block content...]
```

---

<span id="chinese"></span>

## 中文

### ✨ 功能亮点

这个脚本解决了 Google AI Studio 因“虚拟滚动”导致无法获取完整历史记录的问题。

*   **⚡ XHR 模式 (极速)**：拦截网络请求，无需滚动即可瞬间获取完整数据。
*   **🧠 智能自动滚动**：备用 DOM 滚动机制，确保在各种环境下都能抓取所有历史对话。
*   **🔄 会话隔离**：自动监测 URL 变化并重置状态，防止不同对话间的数据污染。
*   **📊 实时计数徽章**：导出按钮上带有红色徽章，实时显示已捕获的对话轮数。
*   **📄 多格式支持**：支持 **Markdown (ZIP)**、**HTML** 以及 **纯文本** 导出。
*   **🧹 数据清洗**：自动去除 UI 干扰信息，保留纯净文本，支持“思考过程”导出。
*   **🎨 交互式 UI**：带有进度显示、倒计时和状态提示的精美界面。
*   **🔒 安全机制**：支持按 `ESC` 键随时中断并保存。

### 📦 安装方法

1.  安装 **OrangeMonkey** 扩展。
    > ⚠️ **注意**：暂不支持 Tampermonkey，请使用 OrangeMonkey。
2.  [👉 点击这里安装](https://github.com/GhostXia/Google-AI-Studio-Exporter/raw/main/google-ai-studio-exporter.user.js)
3.  打开 [Google AI Studio](https://aistudio.google.com/)。
4.  你会看到右下角出现一个 **"🚀 导出"** 按钮。

### 📖 使用指南

1.  点击右下角的 **导出按钮**。
2.  在设置中选择 **提取模式**（推荐使用 XHR 模式）。
3.  选择 **导出格式**（ZIP、HTML 或 纯文本）。
4.  等待处理完成（或者观察徽章计数！）。
5.  完成后，文件将自动下载。

> **提示**：随时按 `ESC` 键可停止并保存已抓取的内容。

### 📝 导出示例

```text
Google AI Studio 聊天记录
时间: 2025/12/31 20:00:00
回合数: 42
----------------------------------------

## 用户
请分析这段代码。

---

## Gemini
这是对代码的分析...
[代码块内容...]
```

---

## 📜 License

AGPL-3.0 License

### 📎 Attachments Handling / 附件处理

- Supports images and various file types (PDF, CSV, TXT, etc.).
- In **ZIP** mode, attachments are packaged into folders.
- In **HTML/Text** mode, attachments are integrated as clickable links.
- **Note**: Due to site CSP, ZIP packaging may require OrangeMonkey's advanced permissions.

### 🧾 Changelog (1.6.0) / 变更记录

- **Architecture**: Full refactor into modular classes (`UIManager`, `ExporterCore`, etc.).
- **XHR Mode**: Added instant data extraction via network interception.
- **Session Isolation**: Added URL monitoring to reset state on conversation switch.
- **HTML Export**: Added a new polished HTML export format.
- **Real-time Badge**: Added a turn counter badge to the export button.
- **Bilingual Code**: Updated all script comments to be bilingual (CN/EN).

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=GhostXia/Google-AI-Studio-Exporter&type=date&legend=top-left)](https://www.star-history.com/#GhostXia/Google-AI-Studio-Exporter&type=date&legend=top-left)
