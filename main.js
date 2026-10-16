const { Plugin: ObsidianPlugin, PluginSettingTab, Setting, Component, MarkdownView, Notice, setIcon } = require("obsidian");

const DEFAULT_SETTINGS = { language: "zh", autoFillSelection: false };
const STRINGS = {
  zh: {
    language: "界面语言",
    languageDesc: "选择本插件的界面语言，切换后立即生效。Copilot 的语言由其自身设置决定。",
    prefill: "自动填入选中文字",
    prefillDesc: "开启后，点击询问 AI 时将选中的词句填入提问框；关闭时提问框保持空白。不会自动发送，也不更改系统剪贴板。",
    button: "询问 AI",
    buttonLabel: "询问 AI：解释选中的文字",
    buttonTitle: "打开 Copilot 划词问答（不会自动发送）",
    missingCopilot: "请先启用 Copilot，再使用划词问答。",
    unavailable: "无法打开划词问答，请确认 Copilot 支持 Quick Ask，且当前使用实时预览模式。",
    fillFailed: "自动填入未成功，请手动输入问题；选中文字仍作为 Copilot 上下文保留。",
  },
  en: {
    language: "Interface language",
    languageDesc: "Choose this plugin's language. Changes apply immediately. Copilot manages its own language separately.",
    prefill: "Prefill selected text",
    prefillDesc: "When enabled, clicking Ask AI inserts the selected text into the question box. When disabled, it stays blank. Nothing is sent automatically and the system clipboard is unchanged.",
    button: "Ask AI",
    buttonLabel: "Ask AI about selected text",
    buttonTitle: "Open Copilot Quick Ask without sending a message",
    missingCopilot: "Enable Copilot before using Quick Ask.",
    unavailable: "Could not open Quick Ask. Check that Copilot supports it and that you are using Live Preview.",
    fillFailed: "Could not prefill the question. Type it manually; Copilot still has the selection as context.",
  },
};

class SelectionAISettings extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  // Searchable settings on Obsidian 1.13+. display() remains the older-app fallback.
  getSettingDefinitions() {
    return [
      {
        name: this.plugin.t("language"),
        desc: this.plugin.t("languageDesc"),
        render: setting => this.renderLanguage(setting),
      },
      {
        name: this.plugin.t("prefill"),
        desc: this.plugin.t("prefillDesc"),
        control: { type: "toggle", key: "autoFillSelection", defaultValue: false },
      },
    ];
  }

  renderLanguage(setting) {
    setting.addDropdown(dropdown => dropdown
      .addOption("zh", "简体中文")
      .addOption("en", "English")
      .setValue(this.plugin.settings.language)
      .onChange(async value => {
        await this.plugin.setLanguage(value);
        // Obsidian preserves the focused row during update(). Refresh that row
        // explicitly as well, including when reached from settings search.
        setting.setName(this.plugin.t("language")).setDesc(this.plugin.t("languageDesc"));
        if (typeof this.update === "function") this.update();
        else this.display();
      }));
  }

  async setControlValue(key, value) {
    if (key === "language") {
      await this.plugin.setLanguage(value);
      if (typeof this.update === "function") this.update();
    } else if (key === "autoFillSelection") {
      this.plugin.settings.autoFillSelection = value === true;
      await this.plugin.saveData(this.plugin.settings);
    }
  }

  display() {
    this.containerEl.empty();
    this.renderLanguage(new Setting(this.containerEl)
      .setName(this.plugin.t("language"))
      .setDesc(this.plugin.t("languageDesc")));
    new Setting(this.containerEl)
      .setName(this.plugin.t("prefill"))
      .setDesc(this.plugin.t("prefillDesc"))
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoFillSelection)
        .onChange(async value => {
          this.plugin.settings.autoFillSelection = value;
          await this.plugin.saveData(this.plugin.settings);
        }));
  }
}

module.exports = class SelectionAIButton extends ObsidianPlugin {
  async onload() {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
    this.settings.language = this.settings.language === "en" ? "en" : "zh";
    this.settings.autoFillSelection = this.settings.autoFillSelection === true;
    this.windows = new Map();
    this.pendingFills = new Set();
    this.addSettingTab(new SelectionAISettings(this.app, this));
    this.attachWindow(window);
    this.app.workspace.iterateAllLeaves?.(leaf => {
      this.attachWindow(leaf.view?.containerEl?.ownerDocument?.defaultView);
    });
    this.registerEvent(this.app.workspace.on("window-open", (entry) => {
      this.attachWindow(entry.win);
    }));
    this.registerEvent(this.app.workspace.on("window-close", (entry) => {
      this.detachWindow(entry.win);
    }));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.hideAll()));
    this.registerEvent(this.app.workspace.on("layout-change", () => this.hideAll()));
    this.register(() => {
      for (const cancel of this.pendingFills) cancel();
      this.pendingFills.clear();
      for (const win of this.windows.keys()) this.detachWindow(win);
    });
  }

  t(key) {
    return STRINGS[this.settings?.language === "en" ? "en" : "zh"][key];
  }

  async setLanguage(language) {
    this.settings.language = language === "en" ? "en" : "zh";
    for (const state of this.windows.values()) this.localizeButton(state);
    await this.saveData(this.settings);
  }

  localizeButton(state) {
    state.button.setAttribute("aria-label", this.t("buttonLabel"));
    state.button.title = this.t("buttonTitle");
    state.label.textContent = this.t("button");
  }

  detachWindow(win) {
    const state = this.windows.get(win);
    if (!state) return;
    win.clearTimeout(state.timer);
    for (const cancel of [...this.pendingFills]) {
      if (cancel.ownerWindow === win) cancel();
    }
    this.removeChild(state.component);
    state.button.remove();
    state.view = null;
    this.windows.delete(win);
  }

  attachWindow(win) {
    if (!win || this.windows.has(win)) return;
    const doc = win.document;
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "selection-ai-button";
    button.hidden = true;
    const icon = doc.createElement("span");
    icon.className = "selection-ai-button-icon";
    setIcon(icon, "sparkles");
    const label = doc.createElement("span");
    button.append(icon, label);
    doc.body.appendChild(button);
    const component = this.addChild(new Component());
    const state = { win, button, label, component, timer: null, dragging: false, view: null, from: 0, to: 0 };
    this.windows.set(win, state);
    this.localizeButton(state);

    const schedule = () => {
      win.clearTimeout(state.timer);
      state.timer = win.setTimeout(() => this.update(state), 120);
    };
    // Keep CodeMirror's selection and focus intact while the button is clicked.
    component.registerDomEvent(button, "pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    component.registerDomEvent(button, "click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      const selection = view?.editor?.cm?.state?.selection?.main;
      if (view !== state.view || !selection || selection.from !== state.from || selection.to !== state.to) {
        this.hide(state);
        return;
      }
      const selectedText = view.editor.getSelection();
      this.cancelPendingFills();
      this.hide(state);
      const command = "copilot:trigger-quick-ask";
      if (!this.app.plugins?.getPlugin?.("copilot")) {
        new Notice(this.t("missingCopilot"));
        return;
      }
      view.editor.focus();
      if (!this.app.commands?.executeCommandById?.(command)) {
        new Notice(this.t("unavailable"));
      } else if (this.settings.autoFillSelection) {
        this.fillQuestion(win, selectedText);
      }
    });
    component.registerDomEvent(doc, "pointerdown", (event) => {
      if (button.contains(event.target)) return;
      // Capture before the editor changes selection. Close immediately without
      // returning focus to the old editor, so a new selection can start normally.
      if (!this.isQuestionInteraction(event.target)) this.closeQuestion(win);
      state.dragging = true;
      this.hide(state);
    }, true);
    component.registerDomEvent(doc, "pointerup", () => {
      state.dragging = false;
      schedule();
    });
    component.registerDomEvent(doc, "pointercancel", () => {
      state.dragging = false;
      this.hide(state);
    });
    component.registerDomEvent(doc, "selectionchange", schedule);
    component.registerDomEvent(doc, "keyup", (event) => {
      if (event.key !== "Escape") schedule();
    });
    component.registerDomEvent(doc, "keydown", (event) => {
      this.hide(state);
      if (event.key === "Escape") win.clearTimeout(state.timer);
    });
    component.registerDomEvent(doc, "input", () => this.hide(state), true);
    component.registerDomEvent(doc, "scroll", () => this.hide(state), true);
    component.registerDomEvent(win, "blur", () => {
      state.dragging = false;
      this.hide(state);
    });
    component.registerDomEvent(win, "resize", () => this.hide(state));
  }

  isQuestionInteraction(target) {
    // Model menus use portals outside the question overlay. Keep them usable.
    return !!target?.closest?.(
      '.copilot-quick-ask-overlay, [data-radix-popper-content-wrapper], .menu, [role="menu"], [role="listbox"]',
    );
  }

  cancelPendingFills() {
    for (const cancel of this.pendingFills) cancel();
  }

  closeQuestion(win) {
    const controller = this.app.plugins?.getPlugin?.("copilot")?.quickAskController;
    const activeDocument = controller?.quickAskWidgetState?.view?.dom?.ownerDocument;
    if (activeDocument && activeDocument !== win.document) return;
    this.cancelPendingFills();
    // Copilot's close(false) also clears its selection highlights and state.
    // Removing the overlay DOM alone would leave the controller out of sync.
    controller?.close?.(false);
  }

  fillQuestion(win, text) {
    this.cancelPendingFills();
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
      try {
        if (!doc.execCommand("insertText", false, text)) new Notice(this.t("fillFailed"));
      } catch {
        new Notice(this.t("fillFailed"));
      } finally {
        cancel();
      }
    };
    cancel.ownerWindow = win;
    timer = win.setTimeout(attempt, 80);
  }

  hide(state) {
    state.button.hidden = true;
    state.view = null;
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
        !this.app.plugins?.getPlugin?.("copilot")) {
      this.hide(state);
      return;
    }
    const cm = view.editor?.cm;
    const selection = cm?.state?.selection?.main;
    if (!cm?.hasFocus || !selection || selection.empty ||
        typeof cm.coordsAtPos !== "function" || !cm.scrollDOM || !view.editor.getSelection().trim()) {
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
    button.style.setProperty("--selection-ai-x", `${Math.max(leftBound, Math.min(position.left, rightBound - width))}px`);
    button.style.setProperty("--selection-ai-y", `${Math.max(topBound, Math.min(top, bottomBound - height))}px`);
  }
};
