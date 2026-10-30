const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function load(nativeScreen) {
  let harness = fs.readFileSync(path.join(__dirname, 'metronome.test.cjs'), 'utf8').split('(async () => {')[0];
  harness = harness.replace('window: { AudioContext: FakeAudio, addEventListener() {} }', 'window: { AudioContext: FakeAudio, addEventListener() {}, capacitorExports: {Capacitor: {getPlatform: () => "android"}, registerPlugin: () => nativeScreen} }');
  return new Function('require', '__dirname', 'nativeScreen', `${harness}\nreturn {t, setup, at, elements, sandbox};`)(require, __dirname, nativeScreen);
}
function nativeStub() {
  return {
    active: false,
    listeners: {},
    async setTrainingState({running, enabled}) { this.active = running && enabled; return {active:this.active}; },
    async addListener(name, handler) { this.listeners[name] = handler; return {remove(){}}; }
  };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

test('开始和换气保持亮屏，暂停、关闭开关及重置解除亮屏', async () => {
  const native = nativeStub(), h = load(native);
  h.setup(1, 1, 3, 2, 1); await h.t.start(); await flush();
  assert.equal(native.active, true);
  assert.equal(h.elements.get('screenState').textContent, '已保持亮屏');
  h.at(2.2); assert.equal(h.t.position(h.t.elapsedNow()).kind, 'breath'); assert.equal(native.active, true);
  h.t.pause(); await flush(); assert.equal(native.active, false);
  await h.t.start(); await flush(); assert.equal(native.active, true);
  const toggle = h.elements.get('keepScreenOn'); toggle.checked = false; toggle.events.change(); await flush();
  assert.equal(native.active, false); assert.equal(h.t.state.mode, 'running');
  toggle.checked = true; toggle.events.change(); await flush(); assert.equal(native.active, true);
  h.t.reset(); await flush(); assert.equal(native.active, false);
});

test('过时的开启结果不会覆盖已经关闭的开关状态', async () => {
  const native = nativeStub(); let resolveOpening;
  native.setTrainingState = ({running}) => running ? new Promise(resolve => { resolveOpening = resolve; }) : Promise.resolve({active:false});
  const h = load(native); h.setup(1, 1, 2); await h.t.start();
  assert.equal(h.elements.get('screenState').textContent, '正在开启');
  const toggle = h.elements.get('keepScreenOn'); toggle.checked = false; toggle.events.change();
  resolveOpening({active:true}); await flush();
  assert.equal(h.elements.get('screenState').textContent, '已关闭');
  assert.equal(h.elements.get('screenState').dataset.active, 'false');
});

test('安卓应用切到后台时冻结进度并解除亮屏', async () => {
  const native = nativeStub(), h = load(native); h.setup(1, 4, 2); await h.t.start();
  h.at(2.4); native.listeners.appPaused(); await flush();
  const elapsed = h.t.state.elapsed;
  assert.equal(h.t.state.mode, 'paused'); assert.equal(native.active, false);
  h.t.getAudio().currentTime += 100; assert.equal(h.t.elapsedNow(), elapsed);
});

test('本组完成后解除安卓常亮', async () => {
  const native = nativeStub(), h = load(native); h.setup(0.5, 0.5, 1); await h.t.start(); h.at(1.01); await flush();
  assert.equal(h.t.state.mode, 'done'); assert.equal(native.active, false);
});

test('原生亮屏请求失败时给出实际状态，不影响节拍计时', async () => {
  const native = nativeStub(); native.setTrainingState = async ({running}) => { if (running) throw new Error('not available'); return {active:false}; };
  const h = load(native); h.setup(1, 1, 2); await h.t.start(); await flush();
  assert.equal(h.t.state.mode, 'running'); assert.equal(h.elements.get('screenState').textContent, '开启失败，可重试');
});
