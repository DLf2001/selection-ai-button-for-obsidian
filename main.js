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
    readingButton: "切换到实时预览",
    readingTitle: "切换到实时预览后，重新选择文字即可询问 AI",
    readingSwitched: "已切换到实时预览，请重新选择文字后点击询问 AI。",
    readingFailed: "无法切换到实时预览，请手动切换后重试。",
    missingCopilot: "请先启用 Copilot，再使用划词问答。",
    unavailable: "无法打开划词问答，请确认 Copilot 支持 Quick Ask，且当前使用实时预览模式。",
    fillFailed: "自动填入未成功，请关闭问答后重试，或手动输入问题。",
  },
  en: {
    language: "Interface language",
    languageDesc: "Choose this plugin's language. Changes apply immediately. Copilot manages its own language separately.",
    prefill: "Prefill selected text",
    prefillDesc: "When enabled, clicking Ask AI inserts the selected text into the question box. When disabled, it stays blank. Nothing is sent automatically and the system clipboard is unchanged.",
    button: "Ask AI",
    buttonLabel: "Ask AI about selected text",
    buttonTitle: "Open Copilot Quick Ask without sending a message",
    readingButton: "Switch to Live Preview",
    readingTitle: "Switch to Live Preview, then select text again to ask AI",
    readingSwitched: "Switched to Live Preview. Select text again and click Ask AI.",
    readingFailed: "Could not switch to Live Preview. Switch manually and try again.",
    missingCopilot: "Enable Copilot before using Quick Ask.",
    unavailable: "Could not open Quick Ask. Check that Copilot supports it and that you are using Live Preview.",
    fillFailed: "Could not prefill the question. Close Quick Ask and try again, or type your question manually.",
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
      await this.plugin.setAutoFill(value);
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
          await this.plugin.setAutoFill(value);
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
    const reading = state.mode === "preview";
    state.button.setAttribute("aria-label", this.t(reading ? "readingTitle" : "buttonLabel"));
    state.button.title = this.t(reading ? "readingTitle" : "buttonTitle");
    state.label.textContent = this.t(reading ? "readingButton" : "button");
  }

  async setAutoFill(value) {
    this.settings.autoFillSelection = value === true;
    if (!this.settings.autoFillSelection) this.cancelPendingFills();
    await this.saveData(this.settings);
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
    const state = { win, button, label, component, timer: null, dragging: false, view: null, snapshot: null, from: 0, to: 0 };
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
      const snapshot = state.snapshot;
      if (!snapshot || view !== state.view || view.file?.path !== snapshot.filePath) {
        this.hide(state);
        return;
      }
      if (snapshot.mode === "preview") {
        const current = this.getReadingSelection(view, doc);
        this.hide(state);
        if (current?.text === snapshot.text) void this.switchToLivePreview(view);
        return;
      }
      const selection = view.editor?.cm?.state?.selection?.main;
      if (view.getMode() !== "source" || view.getState().source === true || !selection ||
          selection.from !== snapshot.from || selection.to !== snapshot.to ||
          view.editor.getSelection() !== snapshot.text) {
        this.hide(state);
        return;
      }
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
        this.fillQuestion(win, snapshot.text, { view, filePath: snapshot.filePath });
      }
    });
    component.registerDomEvent(doc, "pointerdown", (event) => {
      if (button.contains(event.target)) return;
      // Capture before the editor changes selection. Close immediately without
      // returning focus to the old editor, so a new selection can start normally.
      if (!this.isQuestionInteraction(event.target)) this.closeQuestion(win);
      else this.cancelPendingFills();
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
      if (!["Shift", "Control", "Alt", "Meta"].includes(event.key)) this.cancelPendingFills();
      this.hide(state);
      if (event.key === "Escape") win.clearTimeout(state.timer);
    });
    component.registerDomEvent(doc, "input", () => this.hide(state), true);
    component.registerDomEvent(doc, "scroll", () => this.hide(state), true);
    component.registerDomEvent(win, "blur", () => {
      this.cancelPendingFills();
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

  getReadingSelection(view, doc) {
    const root = view.previewMode?.containerEl;
    const selection = doc.getSelection?.();
    if (!root || !selection || selection.isCollapsed || selection.rangeCount !== 1) return null;
    const range = selection.getRangeAt(0);
    const excluded = node => (node?.nodeType === 1 ? node : node?.parentElement)?.closest?.(
      '.markdown-embed, .internal-embed, [contenteditable="true"], input, textarea, button, .copilot-quick-ask-overlay',
    );
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer) ||
        excluded(range.startContainer) || excluded(range.endContainer)) return null;
    const text = selection.toString();
    if (!text.trim()) return null;
    const rects = Array.from(range.getClientRects());
    const position = selection.anchorNode === range.startContainer && selection.anchorOffset === range.startOffset
      ? rects[rects.length - 1] : rects[0];
    if (!position) return null;
    return { text, position, pane: root.getBoundingClientRect() };
  }

  async switchToLivePreview(view) {
    this.cancelPendingFills();
    try {
      if (!view.leaf?.setViewState) throw new Error("Missing Markdown leaf");
      await view.leaf.setViewState({ type: "markdown", state: { ...view.getState(), mode: "source", source: false } });
      new Notice(this.t("readingSwitched"));
    } catch {
      new Notice(this.t("readingFailed"));
    }
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

  fillQuestion(win, text, context) {
    this.cancelPendingFills();
    if (!text.trim()) return;
    // Only fill the newly opened Copilot input. Never paste into the note or
    // overwrite a question that the user has already started typing.
    const doc = win.document;
    const deadline = Date.now() + 5000;
    let timer;
    let cancelled = false;
    let writing = false;
    let attempts = 0;
    let nextInsertAt = 0;
    let verifiedInput = null;
    let stableSince = null;
    let seenOverlay = null;
    const listeners = [];
    const cancel = () => {
      cancelled = true;
      win.clearTimeout(timer);
      for (const [event, listener] of listeners) doc.removeEventListener(event, listener, true);
      this.pendingFills.delete(cancel);
    };
    const fail = () => { cancel(); new Notice(this.t("fillFailed")); };
    // Abort on user edits (including IME/paste/delete), even if they leave the
    // field empty. Ignore the synchronous input events caused by our insertion.
    for (const event of ["beforeinput", "paste", "cut", "drop", "compositionstart"]) {
      const listener = () => { if (!writing) cancel(); };
      doc.addEventListener(event, listener, true);
      listeners.push([event, listener]);
    }
    this.pendingFills.add(cancel);
    const normalize = value => value.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").trim();
    const expected = normalize(text);
    const attempt = () => {
      if (cancelled) return;
      if (this.settings?.autoFillSelection === false || (context &&
          (this.app.workspace.getActiveViewOfType(MarkdownView) !== context.view ||
           context.view.file?.path !== context.filePath || context.view.getMode() !== "source" ||
           context.view.getState().source === true))) {
        cancel();
        return;
      }
      const overlay = doc.querySelector(".copilot-quick-ask-overlay");
      if (seenOverlay && (!overlay || overlay !== seenOverlay)) {
        cancel();
        return;
      }
      if (overlay) seenOverlay = overlay;
      const input = overlay?.querySelector('[contenteditable="true"][data-lexical-editor="true"]');
      const value = input ? normalize(input.innerText ?? input.textContent ?? "") : "";
      if (value) {
        // Only a value inserted by this task can count as a successful prefill.
        if (!attempts) { cancel(); return; }
        if (value !== expected) { fail(); return; }
        if (verifiedInput !== input) { verifiedInput = input; stableSince = Date.now(); }
        if (Date.now() - stableSince >= 600) { cancel(); return; }
      } else if (input?.isConnected && attempts < 3 && Date.now() >= nextInsertAt) {
        verifiedInput = null;
        stableSince = null;
        try {
          input.focus({ preventScroll: true });
          const range = doc.createRange();
          range.selectNodeContents(input);
          range.collapse(false);
          const selection = doc.getSelection();
          if (selection && doc.activeElement === input && input.isConnected &&
              !normalize(input.innerText ?? input.textContent ?? "")) {
            selection.removeAllRanges();
            selection.addRange(range);
            writing = true;
            attempts++;
            nextInsertAt = Date.now() + 400;
            // Preserve Lexical's input pipeline and undo; never write DOM text.
            doc.execCommand("insertText", false, text);
          }
        } catch {
          // Retry only while the field stays empty; all exits clean up listeners.
        } finally {
          writing = false;
        }
      }
      if (Date.now() >= deadline) {
        fail();
        return;
      }
      if (attempts >= 3 && !value && (!input || !normalize(input.innerText ?? input.textContent ?? ""))) {
        fail();
        return;
      }
      timer = win.setTimeout(attempt, 100);
    };
    cancel.ownerWindow = win;
    timer = win.setTimeout(attempt, 80);
  }

  hide(state) {
    state.button.hidden = true;
    state.view = null;
    state.snapshot = null;
  }

  hideAll() {
    this.cancelPendingFills();
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
        doc.querySelector(".modal-container, .copilot-quick-ask-overlay") ||
        !this.app.plugins?.getPlugin?.("copilot")) {
      this.hide(state);
      return;
    }
    let position, pane, snapshot;
    const mode = view.getMode();
    if (mode === "preview") {
      const reading = this.getReadingSelection(view, doc);
      if (!reading) { this.hide(state); return; }
      ({ position, pane } = reading);
      snapshot = { mode, text: reading.text, filePath: view.file?.path };
    } else {
      const cm = view.editor?.cm;
      const selection = cm?.state?.selection?.main;
      if (mode !== "source" || view.getState().source === true || !cm?.hasFocus || !selection || selection.empty ||
          typeof cm.coordsAtPos !== "function" || !cm.scrollDOM || !view.editor.getSelection().trim()) {
        this.hide(state);
        return;
      }
      try { position = cm.coordsAtPos(selection.head); } catch { position = null; }
      pane = cm.scrollDOM.getBoundingClientRect();
      snapshot = { mode, text: view.editor.getSelection(), filePath: view.file?.path, from: selection.from, to: selection.to };
    }
    if (!position || position.bottom < pane.top || position.top > pane.bottom ||
        pane.width < 100 || pane.height < 60) {
      this.hide(state);
      return;
    }
    state.view = view;
    state.mode = mode;
    state.snapshot = snapshot;
    this.localizeButton(state);
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
