# 🚀 Google AI Studio Exporter (对话导出助手)

[English](#english) | [中文](#chinese)

<div align="center">
  <img src="assets/screenshot-ui.png" alt="UI Screenshot" width="600">
</div>

## ✨ Features (功能亮点)

This UserScript solves the problem of "Virtual Scrolling" in Google AI Studio, allowing you to export your full chat history with Gemini.

*   **🧠 Smart Auto-Scrolling**: Automatically scrolls through the chat history to load all content (solving the DOM detachment issue).
*   **🛡️ Active Detection**: Works perfectly even on fresh page loads (no manual scrolling needed).
*   **🧹 Clean Output**: Removes UI garbage (buttons, icons, "Run/Edit" text) and keeps only the dialogue.
*   **🎨 Interactive UI**: Beautiful overlay with progress tracking, countdown, and status indicators.
*   **🔒 Safety Lock**: Prevents double-downloads and allows emergency stop via `ESC` key.

这个脚本解决了 Google AI Studio 因“虚拟滚动”导致无法获取完整历史记录的问题。

*   **🧠 智能自动滚动**：全自动模拟滚动加载，确保抓取所有历史对话。
*   **🛡️ 主动探测机制**：v14内核，解决冷启动找不到滚动条的问题。
*   **🧹 数据清洗**：自动去除按钮、图标、引用来源等干扰信息，只保留纯净文本。
*   **🎨 交互式 UI**：带有倒计时、进度显示和状态提示的漂亮界面。
*   **🔒 安全机制**：防止重复下载，支持按 `ESC` 键随时中断并保存。

## 📦 Installation (安装方法)

1.  Install the **OrangeMonkey** extension.
    > ⚠️ **Note**: Tampermonkey is currently **NOT** supported.
    > ⚠️ **注意**：暂不支持 Tampermonkey，请使用 OrangeMonkey。
2.  [👉 Click here to install](https://github.com/GhostXia/Google-AI-Studio-Exporter/raw/main/google-ai-studio-exporter.user.js)
3.  Open [Google AI Studio](https://aistudio.google.com/).
4.  You will see a **"🚀 导出对话"** button on the top right.

## 📖 Usage (使用指南)

1.  Click the **Export Button** on the top right corner.
2.  Wait for the **3-second countdown** (Do not touch your mouse!).
3.  The script will **automatically scroll** to the top and then down to capture all messages.
4.  Once finished, a `.txt` file will be downloaded automatically.

> **Tip**: Press `ESC` key at any time to stop scrolling and save what has been captured so far.

## 📝 Example Output (导出示例)

```text
Google AI Studio 完整对话记录
时间: 2025/11/25 19:30:00
条数: 42
========================================

### User:
Analyze the provided code snippet.

----------------------------------------------------------------

### Gemini:
Here is the analysis of the code...
[Code block content...]
```

## 📜 License

AGPL-3.0 License
