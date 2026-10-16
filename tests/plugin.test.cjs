const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createPlugin() {
  const toggles = [];
  class Setting {
    setName() { return this; }
    setDesc() { return this; }
    addToggle(callback) {
      const toggle = {
        setValue(value) { this.value = value; return this; },
        onChange(callback) { this.change = callback; return this; },
      };
      toggles.push(toggle);
      callback(toggle);
      return this;
    }
  }
  const sandbox = {
    module: {exports: {}},
    window: {},
    require: () => ({
      Plugin: class {},
      PluginSettingTab: class {
        constructor() { this.containerEl = {empty() {}}; }
      },
      Setting, MarkdownView: class {}, Notice: class {}, setIcon() {},
    }),
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8'), sandbox);
  const plugin = new sandbox.module.exports();
  plugin.pendingFills = new Set();
  return {plugin, toggles};
}

test('setting defaults to off and persists toggle changes', async () => {
  const {plugin, toggles} = createPlugin();
  let saved, settingsTab;
  plugin.loadData = async () => null;
  plugin.saveData = async value => { saved = {...value}; };
  plugin.addSettingTab = tab => { settingsTab = tab; };
  plugin.attachWindow = () => {};
  plugin.registerEvent = () => {};
  plugin.register = () => {};
  plugin.app = {workspace: {on() { return {}; }}};
  await plugin.onload();
  assert.equal(plugin.settings.autoFillSelection, false);
  settingsTab.display();
  assert.equal(toggles[0].value, false);
  await toggles[0].change(true);
  assert.equal(saved.autoFillSelection, true);
});

test('live preview selection shows a bounded button without invoking AI', () => {
  const {plugin} = createPlugin();
  const doc = {hasFocus: () => true, querySelector: () => null};
  let mode = 'source', raw = false, text = 'selected text';
  const cm = {
    hasFocus: true,
    state: {selection: {main: {from: 10, to: 25, head: 25, empty: false}}},
    coordsAtPos: () => ({left: 795, top: 595, bottom: 615}),
    scrollDOM: {getBoundingClientRect: () => ({left:100,right:800,top:100,bottom:620,width:700,height:520})},
  };
  const view = {
    containerEl: {ownerDocument: doc}, getMode: () => mode,
    getState: () => ({source: raw}), editor: {cm, getSelection: () => text},
  };
  plugin.app = {
    workspace: {getActiveViewOfType: () => view}, plugins: {getPlugin: () => ({})},
    commands: {executeCommandById: () => { throw Error('Must not invoke AI'); }},
  };
  const state = {
    win: {document: doc, innerWidth: 1000, innerHeight: 800},
    button: {hidden:true,offsetWidth:100,offsetHeight:32,style:{}}, dragging:false,
  };
  plugin.update(state);
  assert.equal(state.button.hidden, false);
  assert.equal(state.button.style.left, '692px');
  assert.ok(parseFloat(state.button.style.top) + 32 <= 612);
  for (const change of [() => {raw=true;}, () => {raw=false;mode='preview';}, () => {mode='source';text=' ';}]) {
    change(); plugin.update(state); assert.equal(state.button.hidden, true);
  }
});

function fillWindow(existing = '') {
  const queue = [];
  const edits = [];
  const input = {isConnected: true, textContent: existing, focus() {}};
  const win = {
    setTimeout(callback) { queue.push(callback); return queue.length; },
    clearTimeout() {},
    document: {
      querySelector: () => input,
      createRange: () => ({selectNodeContents() {}, collapse() {}}),
      getSelection: () => ({removeAllRanges() {}, addRange() {}}),
      execCommand: (...args) => { edits.push(args); return true; },
    },
  };
  return {win, queue, edits};
}

test('auto fill uses an editor insertion without sending or touching clipboard', () => {
  const {plugin} = createPlugin();
  const {win, queue, edits} = fillWindow();
  plugin.fillQuestion(win, '激光谐振腔');
  queue.shift()();
  assert.deepEqual(edits, [['insertText', false, '激光谐振腔']]);
  assert.equal(plugin.pendingFills.size, 0);
});

test('auto fill never overwrites an existing question', () => {
  const {plugin} = createPlugin();
  const {win, queue, edits} = fillWindow('my question');
  plugin.fillQuestion(win, 'selected text');
  queue.shift()();
  assert.equal(edits.length, 0);
  assert.equal(plugin.pendingFills.size, 0);
});

test('cancelled auto fill performs no insertion', () => {
  const {plugin} = createPlugin();
  const {win, queue, edits} = fillWindow();
  plugin.fillQuestion(win, 'text');
  for (const cancel of plugin.pendingFills) cancel();
  queue.shift()();
  assert.equal(edits.length, 0);
});

test('a new selection cancels old prefill and inserts only the new text', () => {
  const {plugin} = createPlugin();
  const {win, queue, edits} = fillWindow();
  plugin.fillQuestion(win, 'old selection');
  plugin.fillQuestion(win, 'new selection');
  while (queue.length) queue.shift()();
  assert.deepEqual(edits, [['insertText', false, 'new selection']]);
  assert.equal(plugin.pendingFills.size, 0);
});

test('outside close uses controller cleanup without stealing editor focus', () => {
  const {plugin} = createPlugin();
  const {win, queue, edits} = fillWindow();
  const calls = [];
  plugin.app = {plugins: {getPlugin: () => ({quickAskController: {
    quickAskWidgetState: {view: {dom: {ownerDocument: win.document}}},
    close: animate => calls.push(animate),
  }})}};
  plugin.fillQuestion(win, 'old selection');
  plugin.closeQuestion(win);
  while (queue.length) queue.shift()();
  assert.deepEqual(calls, [false]);
  assert.equal(edits.length, 0);
});

test('interactions inside question and model menus are not outside clicks', () => {
  const {plugin} = createPlugin();
  assert.equal(plugin.isQuestionInteraction({closest: selector => {
    assert.ok(selector.includes('.copilot-quick-ask-overlay'));
    assert.ok(selector.includes('data-radix-popper-content-wrapper'));
    return {};
  }}), true);
  assert.equal(plugin.isQuestionInteraction({closest: () => null}), false);
  assert.equal(plugin.isQuestionInteraction(null), false);
});

test('outside click does not close a question in a different window', () => {
  const {plugin} = createPlugin();
  let closed = false;
  plugin.app = {plugins: {getPlugin: () => ({quickAskController: {
    quickAskWidgetState: {view: {dom: {ownerDocument: {}}}},
    close: () => {closed=true;},
  }})}};
  plugin.closeQuestion({document: {}});
  assert.equal(closed, false);
});

test('manifest and package versions match', () => {
  const root = path.join(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const versions = JSON.parse(fs.readFileSync(path.join(root, 'versions.json'), 'utf8'));
  assert.equal(manifest.version, pkg.version);
  assert.equal(versions[manifest.version], manifest.minAppVersion);
  assert.equal(manifest.id, 'selection-ai-button');
});

test('button respects the auto-fill switch and invokes only Quick Ask', () => {
  for (const enabled of [false, true]) {
    const {plugin} = createPlugin();
    let button, filled = 0;
    const commands = [];
    const handlers = new Map();
    const doc = {
      createElement(tag) {
        const element = {setAttribute() {}, append() {}, contains() {return false;}};
        if (tag === 'button') button = element;
        return element;
      },
      body: {appendChild() {}},
    };
    const win = {document: doc};
    const selection = {from: 1, to: 5};
    const view = {editor: {
      cm: {state: {selection: {main: selection}}},
      getSelection: () => 'term', focus() {},
    }};
    plugin.windows = new Map();
    plugin.settings = {autoFillSelection: enabled};
    plugin.registerDomEvent = (target, event, handler) => {
      if (target === button) handlers.set(event, handler);
    };
    plugin.fillQuestion = (target, text) => {
      assert.equal(target, win); assert.equal(text, 'term'); filled++;
    };
    plugin.app = {
      workspace: {getActiveViewOfType: () => view},
      commands: {
        commands: {'copilot:trigger-quick-ask': {}},
        executeCommandById(id) { commands.push(id); return true; },
      },
    };
    plugin.attachWindow(win);
    Object.assign(plugin.windows.get(win), {view, from:1, to:5});
    handlers.get('click')({preventDefault() {}, stopPropagation() {}});
    assert.deepEqual(commands, ['copilot:trigger-quick-ask']);
    assert.equal(filled, enabled ? 1 : 0);
  }
});
