# Selection AI Button

[中文介绍](#中文介绍) · [English](#english)

## 中文介绍

在 Obsidian 笔记中选中文字，点击浮动的「询问 AI」按钮，即可打开 Copilot Quick Ask。支持在设置中选择是否将选中文字自动填入提问框。

项目由 [DLf2001](https://github.com/DLf2001) 维护。这是独立的第三方插件，与 Obsidian 和 Copilot 官方无隶属关系。

## 功能

- 在**实时预览模式**中选中文字后显示「询问 AI」。
- 点击按钮打开已有的 Copilot 划词问答，无需右键菜单。
- 「自动填入选中文字」可开关，默认关闭。
- 开启后只填入原选词句，不自动加翻译指令、不自动发送。
- 不改动系统剪贴板，也不替换用户已经输入的问题。
- 点击问答浮窗外部自动关闭；在原文重新划词、点击按钮后，可填入新的所选词句。
- 关闭或重新打开问答时取消旧的延迟填入，避免旧词句出现在新问题里。
- 取消选择、切换笔记、输入、滚动或按 Esc 时隐藏按钮。
- 使用 Obsidian 主题配色，按钮尽量保持在编辑区可见范围内。

## 环境要求

- Obsidian Desktop 1.11.4 或更高版本。
- 已安装并启用 **Copilot**，作者为 **Logan Yang**。
- 已在 Copilot 中启用快捷聊天模型，并配置 Quick Ask 默认模型。
- 当前兼容实现以 Copilot **4.0.15** 为基准，依赖其命令 `copilot:trigger-quick-ask` 和输入框结构。其他版本需要实际验证。

目前不支持手机、阅读模式、源码模式或 PDF 选词。本插件不包含 Copilot，不修改其文件，也不提供模型服务。

## 安装

此项目尚未进入 Obsidian 社区插件列表，请先手动安装。

1. 下载本仓库的 `main.js`、`manifest.json`、`styles.css`，或从 Releases 下载对应附件。
2. 在知识库中新建 `.obsidian/plugins/selection-ai-button/`。
3. 将这三个文件放入该文件夹。
4. 重启 Obsidian，在「设置 → 第三方插件」启用 **Selection AI Button**。

目录结构：

```text
你的知识库/
└─ .obsidian/plugins/selection-ai-button/
   ├─ main.js
   ├─ manifest.json
   └─ styles.css
```

插件显示名称为 `Selection AI Button`，GitHub 仓库名保留 `selection-ai-button-for-obsidian`。内部插件 ID 仍为 `selection-ai-button`，已有安装可以直接更新，无需重新创建项目或迁移设置。

## 使用

1. 切换到实时预览模式，选中非空白文字。
2. 点击选区附近的「询问 AI」。
3. 在 Quick Ask 中输入或修改问题，手动发送。
4. 回复生成后，使用 Copilot 的复制、插入或替换功能。

点击问答浮窗外部可关闭它。重新选择另一段文字，再点击「询问 AI」，会打开针对新选区的问答；开启自动填入时，提问框会填入最新选区内容。

例如选中「激光谐振腔稳定条件」，打开问答后输入「解释这个条件的物理意义，并说明公式中各符号的含义」。

## 设置

进入「设置 → Selection AI Button」。

| 选项 | 关闭（默认） | 开启 |
| --- | --- | --- |
| 自动填入选中文字 | 提问框保持空白，选中文字由 Copilot 作为上下文处理 | 将所选词句填入空白提问框，可继续编辑后发送 |

这个选项不会调用系统复制或粘贴。若模型输入框不兼容，插件会提示手动输入。

## 数据与网络

本插件自身不发起网络请求，不读取 API Key，不索引知识库，不收集遥测。选择文字、显示按钮和自动填入都在本地完成。只有你在 Copilot 中发送请求时，Copilot 才会按其配置将上下文发送给模型服务商。

## 排查问题

- **没有按钮**：确认插件和 Copilot 都已启用，当前处于实时预览模式，且选择的不是纯空白文字。
- **提示没有模型**：在 Copilot 中添加 API 服务商，并启用快捷聊天模型、选择默认 Quick Ask 模型。
- **自动填入没有生效**：检查本插件开关；已输入的问题不会被覆盖；Copilot 升级可能改变输入框结构。
- **更新文件后没有变化**：关闭再启用本插件，或重启 Obsidian。

## 开发与验证

源码直接使用 CommonJS，无构建步骤或运行时 npm 依赖。Obsidian 提供 `obsidian` 模块。

```sh
npm test
```

自动检查覆盖语法、配置保存、选区按钮位置、不同编辑模式的显示条件、自动填入开关及禁止覆盖已有提问。完整交互仍需在 Obsidian Desktop 中验证。

提交 Issue 时请注明 Obsidian 版本、Copilot 版本、编辑模式和复现步骤，请勿上传 API Key 或私人笔记。

## 许可证

作者暂未为本项目添加许可证。

---

## English

Select text in an Obsidian note and click the floating **询问 AI** (Ask AI) button to open Copilot Quick Ask. An optional setting lets you prefill the question box with the selected text.

Maintained by [DLf2001](https://github.com/DLf2001). This is an independent third-party plugin, not affiliated with Obsidian or Copilot.

### Features

- Shows an Ask AI button near selected text in **Live Preview**.
- Opens Copilot Quick Ask without using the context menu.
- Optional selection prefill, disabled by default.
- Prefills the selected text as-is, without adding a translation instruction or sending a message.
- Does not change the system clipboard or overwrite a question you have already typed.
- Closes the question popup when you click outside it, while keeping model dropdown menus usable.
- Uses the latest selection when you select different text and reopen Quick Ask.
- Cancels pending prefill tasks when a popup is closed or a new question is opened.
- Hides the button when the selection is cleared, notes are switched, or you type, scroll, or press Esc.
- Uses your Obsidian theme and positions the button within the visible editor area where possible.

### Requirements

- Obsidian Desktop 1.11.4 or later.
- **Copilot**, by **Logan Yang**, installed and enabled.
- An enabled Quick Chat model and a configured default Quick Ask model in Copilot.
- The integration targets Copilot **4.0.15** and depends on its `copilot:trigger-quick-ask` command, popup controller, and input structure. Other versions require verification.

Mobile, Reading view, Source mode, and PDF selections are currently unsupported. Copilot is not bundled. This plugin does not modify Copilot files or provide a model service. The plugin interface currently uses Chinese labels.

### Installation

The plugin is not yet listed in the Obsidian Community Plugins directory. Install it manually:

1. Download `main.js`, `manifest.json`, and `styles.css` from this repository or a GitHub release.
2. Create `.obsidian/plugins/selection-ai-button/` in your vault.
3. Put the three files in that directory.
4. Restart Obsidian and enable **Selection AI Button** under **Settings → Community plugins**.

```text
your-vault/
└─ .obsidian/plugins/selection-ai-button/
   ├─ main.js
   ├─ manifest.json
   └─ styles.css
```

The display name is `Selection AI Button`. The GitHub repository remains `selection-ai-button-for-obsidian`, and the plugin ID remains `selection-ai-button`. Existing installations can be updated in place without migrating settings.

### Usage

1. Open a Markdown note in Live Preview and select non-whitespace text.
2. Click **询问 AI** (Ask AI) near the selection.
3. Enter or edit your question in Quick Ask, then send it manually.
4. Use Copilot's copy, insert, or replace actions on the response.

Click outside the question popup to dismiss it. Select different text and click Ask AI again to open a question for the new selection. With selection prefill enabled, the new text is placed in the question box.

### Settings

Open **Settings → Selection AI Button**.

| Setting | Off (default) | On |
| --- | --- | --- |
| 自动填入选中文字 (Prefill selected text) | Leaves the question box blank; Copilot handles the selection as context. | Inserts the selected text into an empty question box for you to edit and send. |

Prefill does not use the system clipboard. If the input is incompatible, the plugin displays a notice so you can type your question manually.

### Data and network use

This plugin makes no network requests, reads no API keys, does not index your vault, and collects no telemetry. Selection handling, button display, and prefill happen locally. When you send a request in Copilot, Copilot sends context to the model provider according to its configuration.

### Troubleshooting

- **No button:** Confirm both plugins are enabled, use Live Preview, and select non-whitespace text.
- **No models:** Add a provider in Copilot, enable a Quick Chat model, and select a default Quick Ask model.
- **Prefill does not work:** Check the setting. Existing questions are never overwritten. A Copilot update may change its input structure.
- **Updated files have no effect:** Disable and re-enable this plugin, or restart Obsidian.

### Development

The source uses CommonJS directly, with no build step or runtime npm dependencies. Obsidian provides the `obsidian` module.

```sh
npm test
```

Automated checks cover syntax, settings persistence, selection positioning, editor modes, prefill behavior, cancellation, popup dismissal, and protecting existing questions. Full interaction still requires verification in Obsidian Desktop.

When opening an issue, include your Obsidian version, Copilot version, editor mode, and reproduction steps. Do not include API keys or private notes.

### License

The author has not added a license to this project.
