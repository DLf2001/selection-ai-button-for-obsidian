const { Plugin, PluginSettingTab, Setting, MarkdownView, Notice, setIcon } = require("obsidian");

const DEFAULT_SETTINGS = { autoFillSelection: false };

class SelectionAISettings extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    this.containerEl.empty();
    new Setting(this.containerEl)
      .setName("自动填入选中文字")
      .setDesc("开启后，点击询问 AI 时将选中的词句填入提问框；关闭时提问框保持空白。不会自动发送，也不更改系统剪贴板。")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoFillSelection)
        .onChange(async value => {
          this.plugin.settings.autoFillSelection = value;
          await this.plugin.saveData(this.plugin.settings);
        }));
  }
}

module.exports = class SelectionAIButton extends Plugin {
  async onload() {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
    this.windows = new Map();
    this.pendingFills = new Set();
    this.addSettingTab(new SelectionAISettings(this.app, this));
    this.attachWindow(window);
    this.registerEvent(this.app.workspace.on("window-open", (entry) => {
      this.attachWindow(entry.win);
    }));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.hideAll()));
    this.registerEvent(this.app.workspace.on("layout-change", () => this.hideAll()));
    this.register(() => {
      for (const cancel of this.pendingFills) cancel();
      this.pendingFills.clear();
      for (const state of this.windows.values()) {
        state.win.clearTimeout(state.timer);
        state.button.remove();
      }
      this.windows.clear();
    });
  }

  attachWindow(win) {
    if (!win || this.windows.has(win)) return;
    const doc = win.document;
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "selection-ai-button";
    button.hidden = true;
    button.setAttribute("aria-label", "询问 AI：解释选中的文字");
    button.title = "打开 Copilot 划词问答（点击后才会打开，不会自动发送）";
    const icon = doc.createElement("span");
    icon.className = "selection-ai-button-icon";
    setIcon(icon, "sparkles");
    const label = doc.createElement("span");
    label.textContent = "询问 AI";
    button.append(icon, label);
    doc.body.appendChild(button);
    const state = { win, button, timer: null, dragging: false, view: null, from: 0, to: 0 };
    this.windows.set(win, state);

    const schedule = () => {
      win.clearTimeout(state.timer);
      state.timer = win.setTimeout(() => this.update(state), 120);
    };
    // Keep CodeMirror's selection and focus intact while the button is clicked.
    this.registerDomEvent(button, "pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    this.registerDomEvent(button, "click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      const selection = view?.editor?.cm?.state?.selection?.main;
      if (view !== state.view || !selection || selection.from !== state.from || selection.to !== state.to) {
        this.hide(state);
        return;
      }
      const selectedText = view.editor.getSelection();
      this.hide(state);
      const command = "copilot:trigger-quick-ask";
      if (!this.app.commands.commands[command]) {
        new Notice("请先启用 Copilot，再使用划词问答。");
        return;
      }
      view.editor.focus();
      if (!this.app.commands.executeCommandById(command)) {
        new Notice("无法打开划词问答，请确认当前使用实时预览模式。");
      } else if (this.settings.autoFillSelection) {
        this.fillQuestion(win, selectedText);
      }
    });
    this.registerDomEvent(doc, "pointerdown", (event) => {
      if (button.contains(event.target)) return;
      state.dragging = true;
      this.hide(state);
    });
    this.registerDomEvent(doc, "pointerup", () => {
      state.dragging = false;
      schedule();
    });
    this.registerDomEvent(doc, "pointercancel", () => {
      state.dragging = false;
      this.hide(state);
    });
    this.registerDomEvent(doc, "selectionchange", schedule);
    this.registerDomEvent(doc, "keyup", (event) => {
      if (event.key !== "Escape") schedule();
    });
    this.registerDomEvent(doc, "keydown", (event) => {
      this.hide(state);
      if (event.key === "Escape") win.clearTimeout(state.timer);
    });
    this.registerDomEvent(doc, "input", () => this.hide(state), true);
    this.registerDomEvent(doc, "scroll", () => this.hide(state), true);
    this.registerDomEvent(win, "blur", () => {
      state.dragging = false;
      this.hide(state);
    });
    this.registerDomEvent(win, "resize", () => this.hide(state));
  }

  fillQuestion(win, text) {
    if (!text.trim()) return;
    // Only fill the newly opened Copilot input. Never paste into the note or
    // overwrite a question that the user has already started typing.
    const doc = win.document;
    const deadline = Date.now() + 2000;
    let timer;
    let cancelled = false;
    const cancel = () => {
      cancelled = true;
      win.clearTimeout(timer);
      this.pendingFills.delete(cancel);
    };
    this.pendingFills.add(cancel);
    const attempt = () => {
      if (cancelled) return;
      const input = doc.querySelector(
        '.copilot-quick-ask-overlay [contenteditable="true"][data-lexical-editor="true"]',
      );
      if (!input || !input.isConnected) {
        if (Date.now() < deadline) timer = win.setTimeout(attempt, 50);
        else cancel();
        return;
      }
      if ((input.textContent || "").trim()) {
        cancel();
        return;
      }
      input.focus();
      const range = doc.createRange();
      range.selectNodeContents(input);
      range.collapse(false);
      const selection = doc.getSelection();
      if (!selection) {
        cancel();
        return;
      }
      selection.removeAllRanges();
      selection.addRange(range);
      // Obsidian Desktop's editing command follows the rich editor's input
      // pipeline, including Lexical state and undo. DOM textContent writes do not.
      if (!doc.execCommand("insertText", false, text)) {
        new Notice("自动填入未成功，请手动输入问题；选中文字仍作为 Copilot 上下文保留。");
      }
      cancel();
    };
    timer = win.setTimeout(attempt, 80);
  }

  hide(state) {
    state.button.hidden = true;
  }

  hideAll() {
    for (const state of this.windows.values()) {
      state.win.clearTimeout(state.timer);
      this.hide(state);
    }
  }

  update(state) {
    const { win, button } = state;
    const doc = win.document;
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (state.dragging || !doc.hasFocus() || !view || view.containerEl.ownerDocument !== doc ||
        view.getMode() !== "source" || view.getState().source === true ||
        doc.querySelector(".modal-container, .copilot-quick-ask-overlay") ||
        !this.app.plugins.getPlugin("copilot")) {
      this.hide(state);
      return;
    }
    const cm = view.editor?.cm;
    const selection = cm?.state?.selection?.main;
    if (!cm?.hasFocus || !selection || selection.empty || !view.editor.getSelection().trim()) {
      this.hide(state);
      return;
    }
    let position;
    try { position = cm.coordsAtPos(selection.head); } catch { position = null; }
    const pane = cm.scrollDOM.getBoundingClientRect();
    if (!position || position.bottom < pane.top || position.top > pane.bottom ||
        pane.width < 100 || pane.height < 60) {
      this.hide(state);
      return;
    }
    state.view = view;
    state.from = selection.from;
    state.to = selection.to;
    button.hidden = false;
    const width = button.offsetWidth;
    const height = button.offsetHeight;
    const margin = 8;
    const leftBound = Math.max(margin, pane.left + margin);
    const rightBound = Math.min(win.innerWidth - margin, pane.right - margin);
    const topBound = Math.max(margin, pane.top + margin);
    const bottomBound = Math.min(win.innerHeight - margin, pane.bottom - margin);
    let top = position.top - height - margin;
    if (top < topBound) top = position.bottom + margin;
    button.style.left = `${Math.max(leftBound, Math.min(position.left, rightBound - width))}px`;
    button.style.top = `${Math.max(topBound, Math.min(top, bottomBound - height))}px`;
  }
};
