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

A powerful **UserScript** that exports your complete **Google AI Studio** chat history with Gemini, solving the "Virtual Scrolling" limitation and providing clean, formatted exports with multiple export modes.

### ✨ Key Features

#### 🧠 Smart Auto-Scrolling System
- **Intelligent Jump**: Automatically uses scrollbar buttons to jump to the first conversation
- **Fallback Mechanism**: Gradually scrolls upward if direct jump fails
- **Bottom Detection**: Automatically stops when reaching the end of the conversation
- **Sticky Prevention**: Smart detection prevents getting stuck

#### 📦 Dual Export Modes
- **📄 Text-Only Mode**: Pure Markdown file (`.md`) with clean text export
- **📦 Full Package Mode**: ZIP archive with images, files, and complete chat history
  - Automatically downloads all embedded images
  - Captures linked files (PDF, CSV, TXT, JSON, code files, etc.)
  - Updates markdown links to point to local resources
  - Organized folder structure: `images/`, `files/`, and `chat_history.md`

#### 🎨 Rich Markdown Support
- **Complete HTML-to-Markdown Conversion**:
  - Code blocks with syntax highlighting
  - Inline code with backtick support
  - Bold, italic, headings (H1-H6)
  - Ordered and unordered lists (with proper nesting)
  - Blockquotes with multi-line support
  - Images and links
  - Line breaks and paragraphs

#### 🌍 Full Responsive Design
- **Desktop (PC)**: Top-right floating button with optimal positioning
- **Tablet (600px-900px)**: Adjusted button size and position
- **Mobile (<600px)**: Bottom-right floating ball with touch-optimized size
- **Ultra-small screens (<360px)**: Further optimized layout
- **Dark Mode Support**: Automatic dark theme detection

#### 🔒 Safety & User Experience
- **Countdown Timer**: 3-second countdown before auto-scrolling
- **Emergency Stop**: Press `ESC` key anytime to stop and save
- **Progress Tracking**: Real-time message count display
- **Deduplication**: Prevents duplicate message capture
- **Error Handling**: Clear error messages with recovery options
- **Cache Support**: Re-download option without re-processing

#### 🌐 i18n Support
- **English** and **简体中文** (Simplified Chinese)
- Automatic language detection based on browser settings
- All UI elements, messages, and file headers are localized

### 📁 Project Structure

```
Google-AI-Studio-Exporter/
├── Stable Version/           # Stable releases (version-numbered backups)
│   └── *.user.js            # e.g., 1.3.5.user.js
├── google-ai-studio-exporter.user.js  # Main script (latest)
└── README.md                # This file
```

### 📦 Installation

#### Prerequisites
- **Browser**: Chrome, Edge, or any Chromium-based browser
- **Extension**: [OrangeMonkey](https://chromewebstore.google.com/detail/orangemonkey/ekmeppjgajofkpiofbebgcbohbmfldaf) (UserScript manager)

> ⚠️ **Important**: This script currently requires **OrangeMonkey**. Tampermonkey is **NOT** supported due to compatibility issues with `GM_xmlhttpRequest`.

#### Installation Steps

1. **Install OrangeMonkey**:
   - Visit the [Chrome Web Store](https://chromewebstore.google.com/detail/orangemonkey/ekmeppjgajofkpiofbebgcbohbmfldaf)
   - Click "Add to Chrome" / "Add to Edge"

2. **Install the Script**:
   - [👉 Click here to install](https://github.com/GhostXia/Google-AI-Studio-Exporter/raw/main/google-ai-studio-exporter.user.js)
   - Or manually:
     1. Copy the script content from the repository
     2. Open OrangeMonkey dashboard
     3. Click "Create a new script"
     4. Paste the content and save

3. **Verify Installation**:
   - Open [Google AI Studio](https://aistudio.google.com/)
   - You should see a **"🚀 Export"** button in the top-right corner
   - On mobile, it appears as a floating button in the bottom-right

### 📖 Usage Guide

#### Basic Export Flow

1. **Navigate to Google AI Studio**:
   - Open your chat conversation at [aistudio.google.com](https://aistudio.google.com/)

2. **Click Export Button**:
   - **Desktop**: Top-right corner button labeled **"🚀 Export"**
   - **Mobile**: Bottom-right floating button

3. **Select Export Mode**:
   - **📦 With Attachments**: Downloads a ZIP file containing:
     - `chat_history.md` - Markdown file with localized links
     - `images/` - All embedded images
     - `files/` - All linked files (PDF, CSV, code, etc.)
   - **📄 Text Only**: Downloads a single `.md` file with plain text
   - **Close**: Cancel the export

4. **Wait for Countdown**:
   - **3-second countdown** appears
   - ⚠️ **Do NOT move your mouse or click anything!**
   - This prepares the scroll system

5. **Auto-Scrolling Phase**:
   - Script automatically jumps to the first message (using scrollbar buttons)
   - Scrolls downward smoothly to load all messages
   - Progress counter updates in real-time
   - **Press `ESC`** anytime to stop and save current progress

6. **Download**:
   - File automatically downloads when complete
   - **Text Mode**: `Gemini_Chat_v14_<timestamp>.md`
   - **Full Mode**: `Gemini_Chat_v14_<timestamp>.zip`

#### Export Modes Comparison

| Feature | 📄 Text Only | 📦 With Attachments |
|---------|-------------|---------------------|
| File format | Single `.md` file | `.zip` archive |
| Images | Referenced by URL | Downloaded locally |
| Linked files | Referenced by URL | Downloaded locally |
| File size | Small (~KB) | Larger (depends on attachments) |
| Offline viewing | Requires internet | Fully self-contained |
| Processing time | Fast | Slower (downloads resources) |

#### Keyboard Shortcuts

- **ESC**: Stop scrolling and save current progress
  - Works during scrolling phase
  - Triggers immediate download with collected messages

### 📝 Export Format

#### Text-Only Mode (`.md`)

```markdown
# Google AI Studio Chat History

**Time:** 2025/11/27 19:00:00

**Count:** 42

---

## User

Can you explain how virtual scrolling works?

---

## Gemini

Virtual scrolling is a technique used in web applications to efficiently render large lists by only rendering the visible items...

---

## User

Can you provide a code example?

---

## Gemini

Here's an example in JavaScript:

```javascript
function virtualScrolling(items, viewport) {
  // Implementation...
}
```

---
```

#### Full Package Mode (`.zip`)

```
Gemini_Chat_v14_1732704000000.zip
├── chat_history.md         # Markdown with local links
├── images/
│   ├── image_0.png
│   ├── image_1.jpeg
│   └── image_2.webp
└── files/
    ├── 0_example.pdf
    ├── 1_data.csv
    └── 2_script.py
```

**Modified Links in `chat_history.md`**:
```markdown
## Gemini

Here's the analysis of the data:

![Chart](images/image_0.png)

You can download the full dataset: [data.csv](files/1_data.csv)
```

### 🔧 Technical Details

#### Core Technology Stack
- **JSZip 3.10.1**: ZIP file generation
- **GM_xmlhttpRequest**: Cross-origin resource fetching
- **Modern ES6+**: Async/await, Map, Set, Regex
- **Responsive CSS**: Media queries for all screen sizes

#### Key Algorithms

1. **Smart Scroll Detection**:
   - Uses `ms-chat-turn` elements as reference
   - Finds parent container with `overflow-y: auto/scroll`
   - Fallback to `document.documentElement`

2. **Intelligent Jump System**:
   - Primary: Click scrollbar button `button[id^="scrollbar-item-"]`
   - Secondary: Gradual upward scrolling with viewport-based increments
   - Tertiary: Direct `scrollTop = 0` assignment

3. **Bottom Detection**:
   - Monitors `scrollTop` position changes
   - Triggers stop if position doesn't change after 3 consecutive scroll attempts
   - Threshold: ±2px to account for sub-pixel rendering

4. **Deduplication**:
   - Uses `Map<turn.id, messageData>` structure
   - Prevents duplicate capture during multiple scrolls

5. **Resource Processing**:
   - Parallel download using `Promise.all()`
   - Progress updates every 5 resources
   - Filename sanitization and length limiting (100 chars)

#### Supported File Types

**Auto-Download in Full Mode**:
- **Documents**: `.pdf`, `.txt`, `.md`
- **Data**: `.csv`, `.json`
- **Code**: `.py`, `.js`, `.html`, `.css`
- **Archives**: `.zip`, `.tar`, `.gz`
- **Images**: All formats (`.png`, `.jpg`, `.webp`, `.svg`, etc.)
- **Blob URLs**: Any `blob:` URLs
- **Google Storage**: URLs containing `googlestorage` or `googleusercontent`

### ❓ FAQ & Troubleshooting

#### Q: Why do I need OrangeMonkey? Can I use Tampermonkey?

**A**: This script requires `GM_xmlhttpRequest` to download cross-origin resources (images, files). Tampermonkey has compatibility issues with this API on modern Chrome/Edge. OrangeMonkey provides better support.

#### Q: The export button doesn't appear

**A**: 
- Make sure OrangeMonkey is installed and enabled
- Refresh the Google AI Studio page (`Ctrl+R` / `Cmd+R`)
- Check OrangeMonkey dashboard to verify the script is active
- The button appears every 2 seconds automatically

#### Q: Scrolling gets stuck or stops prematurely

**A**:
- This can happen with very long conversations (>500 messages)
- **Solution**: Press `ESC` to save current progress, then click export again to continue
- The script automatically detects and skips duplicate messages

#### Q: Some images or files are missing in the ZIP

**A**:
- **Cause**: CORS restrictions or expired blob URLs
- **Behavior**: The script attempts to download all resources but silently skips failures
- **Check**: Console logs (`F12` → Console) will show which resources failed
- **Workaround**: Use "Text Only" mode to preserve original URLs

#### Q: Export is slow with many images

**A**:
- This is normal behavior for "With Attachments" mode
- Progress is shown during download (e.g., "Packaging images: 15/50")
- **Tip**: Use "Text Only" mode for faster export if you don't need offline viewing

#### Q: Can I re-download without scrolling again?

**A**:
- **Yes!** After the first export, the data is cached
- Click the **💾 Save** button in the finished dialog
- The same file will be generated instantly

#### Q: Does this work on mobile devices?

**A**:
- **Yes!** The UI is fully optimized for mobile
- The floating button appears in the bottom-right corner
- Same functionality as desktop version

#### Q: How do I view the exported conversations?

**A**:
- **Text Mode**: Open the `.md` file with any Markdown viewer:
  - [Typora](https://typora.io/)
  - [Obsidian](https://obsidian.md/)
  - [VS Code](https://code.visualstudio.com/)
  - GitHub (upload and view online)
- **Full Mode**: Extract the `.zip` file and open `chat_history.md`

### 🛠️ Development

#### Version History

The `Stable Version/` folder contains proven releases:
- Each file is named by version number (e.g., `1.3.5.user.js`)
- Main script (`google-ai-studio-exporter.user.js`) is the latest development version
- Current version: **1.3.6**

#### Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Test thoroughly on both desktop and mobile
4. Submit a pull request

### 🌟 Credits

Created by **GhostXia**

- GitHub: [GhostXia/Google-AI-Studio-Exporter](https://github.com/GhostXia/Google-AI-Studio-Exporter)
- License: **AGPL-3.0**

---

<span id="chinese"></span>

## 中文

一个强大的 **UserScript**（用户脚本），可导出您在 **Google AI Studio** 中与 Gemini 的完整对话历史，解决"虚拟滚动"限制，并提供多种导出模式的干净格式化输出。

### ✨ 核心功能

#### 🧠 智能自动滚动系统
- **智能跳转**：自动使用滚动条按钮跳转到第一条对话
- **备用机制**：如果直接跳转失败，逐步向上滚动
- **触底检测**：到达对话末尾时自动停止
- **防卡住**：智能检测防止滚动卡住

#### 📦 双模式导出
- **📄 纯文本模式**：纯净的 Markdown 文件 (`.md`)
- **📦 完整打包模式**：ZIP 压缩包，包含图片、文件和完整对话记录
  - 自动下载所有嵌入的图片
  - 捕获链接的文件（PDF、CSV、TXT、JSON、代码文件等）
  - 将 Markdown 链接更新为本地资源路径
  - 有组织的文件夹结构：`images/`、`files/` 和 `chat_history.md`

#### 🎨 丰富的 Markdown 支持
- **完整的 HTML 到 Markdown 转换**：
  - 带语法高亮的代码块
  - 支持反引号的内联代码
  - 粗体、斜体、标题（H1-H6）
  - 有序和无序列表（支持正确嵌套）
  - 多行引用块
  - 图片和链接
  - 换行和段落

#### 🌍 全平台响应式设计
- **桌面端（PC）**：右上角悬浮按钮，位置最优
- **平板（600px-900px）**：调整按钮大小和位置
- **手机（<600px）**：右下角悬浮球，触控尺寸优化
- **超小屏幕（<360px）**：进一步优化布局
- **深色模式支持**：自动检测深色主题

#### 🔒 安全性与用户体验
- **倒计时**：自动滚动前 3 秒倒计时
- **紧急停止**：随时按 `ESC` 键停止并保存
- **进度跟踪**：实时显示消息计数
- **去重**：防止重复捕获消息
- **错误处理**：清晰的错误消息和恢复选项
- **缓存支持**：无需重新处理即可重新下载

#### 🌐 国际化支持
- **English** 和 **简体中文**
- 基于浏览器设置自动检测语言
- 所有 UI 元素、消息和文件标题均已本地化

### 📁 项目结构

```
Google-AI-Studio-Exporter/
├── Stable Version/           # 稳定版本（版本号备份）
│   └── *.user.js            # 例如：1.3.5.user.js
├── google-ai-studio-exporter.user.js  # 主脚本（最新版）
└── README.md                # 本文件
```

### 📦 安装方法

#### 前置要求
- **浏览器**：Chrome、Edge 或任何基于 Chromium 的浏览器
- **扩展**：[OrangeMonkey](https://chromewebstore.google.com/detail/orangemonkey/ekmeppjgajofkpiofbebgcbohbmfldaf)（用户脚本管理器）

> ⚠️ **重要提示**：此脚本目前需要 **OrangeMonkey**。由于 `GM_xmlhttpRequest` 的兼容性问题，**不支持** Tampermonkey。

#### 安装步骤

1. **安装 OrangeMonkey**：
   - 访问 [Chrome 网上应用店](https://chromewebstore.google.com/detail/orangemonkey/ekmeppjgajofkpiofbebgcbohbmfldaf)
   - 点击"添加至 Chrome" / "添加至 Edge"

2. **安装脚本**：
   - [👉 点击这里安装](https://github.com/GhostXia/Google-AI-Studio-Exporter/raw/main/google-ai-studio-exporter.user.js)
   - 或手动安装：
     1. 从仓库复制脚本内容
     2. 打开 OrangeMonkey 控制面板
     3. 点击"创建新脚本"
     4. 粘贴内容并保存

3. **验证安装**：
   - 打开 [Google AI Studio](https://aistudio.google.com/)
   - 您应该看到右上角出现 **"🚀 导出"** 按钮
   - 在移动端，它显示为右下角的悬浮按钮

### 📖 使用指南

#### 基本导出流程

1. **打开 Google AI Studio**：
   - 在 [aistudio.google.com](https://aistudio.google.com/) 打开您的对话

2. **点击导出按钮**：
   - **桌面端**：右上角标有 **"🚀 导出"** 的按钮
   - **移动端**：右下角的悬浮按钮

3. **选择导出模式**：
   - **📦 包含附件**：下载 ZIP 文件，包含：
     - `chat_history.md` - 带本地化链接的 Markdown 文件
     - `images/` - 所有嵌入的图片
     - `files/` - 所有链接的文件（PDF、CSV、代码等）
   - **📄 纯文本**：下载单个 `.md` 文件
   - **关闭**：取消导出

4. **等待倒计时**：
   - 出现 **3 秒倒计时**
   - ⚠️ **请勿移动鼠标或点击任何内容！**
   - 这是为滚动系统做准备

5. **自动滚动阶段**：
   - 脚本自动跳转到第一条消息（使用滚动条按钮）
   - 平滑向下滚动以加载所有消息
   - 实时更新进度计数器
   - **按 `ESC`** 可随时停止并保存当前进度

6. **下载**：
   - 完成后自动下载文件
   - **文本模式**：`Gemini_Chat_v14_<时间戳>.md`
   - **完整模式**：`Gemini_Chat_v14_<时间戳>.zip`

#### 导出模式对比

| 功能 | 📄 纯文本 | 📦 包含附件 |
|------|----------|------------|
| 文件格式 | 单个 `.md` 文件 | `.zip` 压缩包 |
| 图片 | 通过 URL 引用 | 本地下载 |
| 链接文件 | 通过 URL 引用 | 本地下载 |
| 文件大小 | 小（约 KB） | 较大（取决于附件） |
| 离线查看 | 需要联网 | 完全自包含 |
| 处理时间 | 快速 | 较慢（下载资源） |

#### 键盘快捷键

- **ESC**：停止滚动并保存当前进度
  - 在滚动阶段有效
  - 立即触发下载已收集的消息

### 📝 导出格式

#### 纯文本模式（`.md`）

```markdown
# Google AI Studio 完整对话记录

**时间：** 2025/11/27 19:00:00

**条数：** 42

---

## User

能否解释一下虚拟滚动的工作原理？

---

## Gemini

虚拟滚动是一种在 Web 应用程序中用于高效渲染大型列表的技术，它只渲染可见的项目...

---

## User

能提供一个代码示例吗？

---

## Gemini

这是一个 JavaScript 示例：

```javascript
function virtualScrolling(items, viewport) {
  // 实现...
}
```

---
```

#### 完整打包模式（`.zip`）

```
Gemini_Chat_v14_1732704000000.zip
├── chat_history.md         # 带本地链接的 Markdown
├── images/
│   ├── image_0.png
│   ├── image_1.jpeg
│   └── image_2.webp
└── files/
    ├── 0_example.pdf
    ├── 1_data.csv
    └── 2_script.py
```

**`chat_history.md` 中修改后的链接**：
```markdown
## Gemini

这是数据分析结果：

![图表](images/image_0.png)

您可以下载完整数据集：[data.csv](files/1_data.csv)
```

### 🔧 技术细节

#### 核心技术栈
- **JSZip 3.10.1**：ZIP 文件生成
- **GM_xmlhttpRequest**：跨域资源获取
- **现代 ES6+**：Async/await、Map、Set、Regex
- **响应式 CSS**：适配所有屏幕尺寸的媒体查询

#### 关键算法

1. **智能滚动检测**：
   - 使用 `ms-chat-turn` 元素作为参考
   - 查找具有 `overflow-y: auto/scroll` 的父容器
   - 回退到 `document.documentElement`

2. **智能跳转系统**：
   - 主方案：点击滚动条按钮 `button[id^="scrollbar-item-"]`
   - 次方案：基于视口的逐步向上滚动
   - 三方案：直接设置 `scrollTop = 0`

3. **触底检测**：
   - 监控 `scrollTop` 位置变化
   - 如果连续 3 次滚动尝试后位置不变则触发停止
   - 阈值：±2px（考虑亚像素渲染）

4. **去重**：
   - 使用 `Map<turn.id, messageData>` 结构
   - 防止多次滚动期间的重复捕获

5. **资源处理**：
   - 使用 `Promise.all()` 并行下载
   - 每下载 5 个资源更新一次进度
   - 文件名清理和长度限制（100 字符）

#### 支持的文件类型

**完整模式自动下载**：
- **文档**：`.pdf`、`.txt`、`.md`
- **数据**：`.csv`、`.json`
- **代码**：`.py`、`.js`、`.html`、`.css`
- **压缩包**：`.zip`、`.tar`、`.gz`
- **图片**：所有格式（`.png`、`.jpg`、`.webp`、`.svg` 等）
- **Blob URL**：任何 `blob:` URL
- **Google Storage**：包含 `googlestorage` 或 `googleusercontent` 的 URL

### ❓ 常见问题与故障排除

#### Q：为什么需要 OrangeMonkey？可以使用 Tampermonkey 吗？

**A**：此脚本需要 `GM_xmlhttpRequest` 来下载跨域资源（图片、文件）。Tampermonkey 在现代 Chrome/Edge 上对此 API 存在兼容性问题。OrangeMonkey 提供更好的支持。

#### Q：导出按钮没有出现

**A**：
- 确保已安装并启用 OrangeMonkey
- 刷新 Google AI Studio 页面（`Ctrl+R` / `Cmd+R`）
- 检查 OrangeMonkey 控制面板，确认脚本处于激活状态
- 按钮每 2 秒自动出现

#### Q：滚动卡住或提前停止

**A**：
- 这在非常长的对话（>500 条消息）中可能发生
- **解决方案**：按 `ESC` 保存当前进度，然后再次点击导出继续
- 脚本会自动检测并跳过重复消息

#### Q：ZIP 中缺少某些图片或文件

**A**：
- **原因**：CORS 限制或过期的 blob URL
- **行为**：脚本会尝试下载所有资源，但静默跳过失败的资源
- **检查**：控制台日志（`F12` → 控制台）会显示哪些资源失败
- **解决方法**：使用"纯文本"模式保留原始 URL

#### Q：有很多图片时导出很慢

**A**：
- 这是"包含附件"模式的正常行为
- 下载期间会显示进度（例如"打包图片：15/50"）
- **提示**：如果不需要离线查看，使用"纯文本"模式可更快导出

#### Q：可以在不重新滚动的情况下重新下载吗？

**A**：
- **可以！**首次导出后，数据会被缓存
- 在完成对话框中点击 **💾 保存** 按钮
- 将立即生成相同的文件

#### Q：在移动设备上可以使用吗？

**A**：
- **可以！**UI 已针对移动端完全优化
- 悬浮按钮出现在右下角
- 功能与桌面版相同

#### Q：如何查看导出的对话？

**A**：
- **文本模式**：使用任何 Markdown 查看器打开 `.md` 文件：
  - [Typora](https://typora.io/)
  - [Obsidian](https://obsidian.md/)
  - [VS Code](https://code.visualstudio.com/)
  - GitHub（上传并在线查看）
- **完整模式**：解压 `.zip` 文件并打开 `chat_history.md`

### 🛠️ 开发

#### 版本历史

`Stable Version/` 文件夹包含经过验证的版本：
- 每个文件以版本号命名（例如 `1.3.5.user.js`）
- 主脚本（`google-ai-studio-exporter.user.js`）是最新开发版本
- 当前版本：**1.3.6**

#### 贡献

欢迎贡献！请：
1. Fork 此仓库
2. 创建功能分支
3. 在桌面端和移动端彻底测试
4. 提交 Pull Request

### 🌟 致谢

由 **GhostXia** 创建

- GitHub：[GhostXia/Google-AI-Studio-Exporter](https://github.com/GhostXia/Google-AI-Studio-Exporter)
- 许可证：**AGPL-3.0**

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=GhostXia/Google-AI-Studio-Exporter&type=date&legend=top-left)](https://www.star-history.com/#GhostXia/Google-AI-Studio-Exporter&type=date&legend=top-left)

## 📜 License

AGPL-3.0 License
