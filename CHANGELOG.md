# 更新日志

## 1.3.1

- 自动填入支持等待输入框就绪、检查文字是否保留，并在输入框重新渲染或空白插入失败时有限重试。
- 等待上限调整为 5 秒，失败时提示关闭问答重试或手动输入。
- 手动输入、粘贴、输入法组合、切换笔记、关闭问答或关闭自动填入时取消旧任务，避免覆盖或串入旧词句。
- 点击按钮前保存并核对选区内容和所属笔记。
- 阅读模式选词后显示「切换到实时预览」按钮；点击后重新选词即可使用 Copilot Quick Ask。不改动笔记内容，不自动发送消息。
- Prefill now waits for input readiness, verifies retained text, and retries empty or re-created inputs without overwriting user questions.
- Reading view offers an explicit Switch to Live Preview button; select text again after switching to use Quick Ask.

## 1.3.0

- 增加简体中文 / English 界面设置，切换后立即更新按钮、设置项和通知。
- 保留原有自动填入设置，语言默认使用简体中文。
- 改进多窗口关闭及卸载时的事件、计时器和选区引用清理。
- 增加英文简介、MIT 许可证和官方 Obsidian 规则检查。
- 未提交社区目录审核，发布与审核状态分别记录。

## 1.2.1

- 插件显示名称调整为 Selection AI Button，仓库名和插件 ID 保持不变。
- README 在中文介绍之后增加完整英文介绍。
- 功能和已有设置不变，支持原位更新。

## 1.2.0

- 点击问答浮窗外部自动关闭，保留模型下拉菜单交互。
- 开启自动填入时，重新划词并点击按钮使用最新选中文字。
- 关闭浮窗或新建提问时取消旧的延迟填入，避免旧词句串入新问题。

## 1.1.0

- 项目命名为 Selection AI Button for Obsidian。
- 增加「自动填入选中文字」设置，默认关闭。
- 自动填入不更改系统剪贴板，不自动发送，也不覆盖已有问题。
- 整理独立项目、安装说明和自动检查。

## 1.0.0

- 初始本地版本：实时预览模式下选中文字后显示询问 AI 按钮。
- 点击按钮调用 Copilot Quick Ask。
