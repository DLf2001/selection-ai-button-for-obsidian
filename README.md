# Selection AI Button for Obsidian

在 Obsidian 笔记中选中文字，点击浮动的「询问 AI」按钮，即可打开 Copilot Quick Ask。支持在设置中选择是否将选中文字自动填入提问框。

项目由 [DLf2001](https://github.com/DLf2001) 维护。这是独立的第三方插件，与 Obsidian 和 Copilot 官方无隶属关系。

## 功能

- 在**实时预览模式**中选中文字后显示「询问 AI」。
- 点击按钮打开已有的 Copilot 划词问答，无需右键菜单。
- 「自动填入选中文字」可开关，默认关闭。
- 开启后只填入原选词句，不自动加翻译指令、不自动发送。
- 不改动系统剪贴板，也不替换用户已经输入的问题。
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
4. 重启 Obsidian，在「设置 → 第三方插件」启用 **Selection AI Button for Obsidian**。

目录结构：

```text
你的知识库/
└─ .obsidian/plugins/selection-ai-button/
   ├─ main.js
   ├─ manifest.json
   └─ styles.css
```

项目名含 `for Obsidian`，内部插件 ID 仍为 `selection-ai-button`，用于兼容已有安装。

## 使用

1. 切换到实时预览模式，选中非空白文字。
2. 点击选区附近的「询问 AI」。
3. 在 Quick Ask 中输入或修改问题，手动发送。
4. 回复生成后，使用 Copilot 的复制、插入或替换功能。

例如选中「激光谐振腔稳定条件」，打开问答后输入「解释这个条件的物理意义，并说明公式中各符号的含义」。

## 设置

进入「设置 → Selection AI Button for Obsidian」。

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
