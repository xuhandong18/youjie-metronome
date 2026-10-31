const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./harness.cjs');
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
function nativeStub() {
  return {
    active: true, listeners: {}, queries: 0,
    async getState() { this.queries++; return {active:this.active, foreground:this.active}; },
    async addListener(name, handler) { this.listeners[name] = handler; return {remove(){}}; }
  };
}
test('安卓一打开就显示常亮，忽略旧版关闭选项；训练、暂停、重置和完成不改变常亮', async () => {
  const native = nativeStub(), h = load({nativeScreen:native, keepScreenOff:true}); await flush();
  assert.equal(h.elements.get('screenState').textContent, '已保持亮屏');
  assert.equal(h.elements.get('keepScreenOn').checked, true);
  h.setup(1, 1, 2, 2); await h.t.start(); h.t.pause(); await flush();
  assert.equal(native.active,true); assert.equal(h.elements.get('screenState').dataset.active,'true');
  h.t.reset(); await flush(); assert.equal(native.active,true);
  h.setup(0.5,0.5,1); await h.t.start(); h.at(1.1); await flush();
  assert.equal(h.t.state.mode,'done'); assert.equal(native.active,true);
});
test('进入后台暂停，返回前台恢复常亮但不自动训练，手动继续先准备3秒', async () => {
  const native = nativeStub(), h=load({nativeScreen:native});
  h.setup(1,4,3); await h.t.start(); h.at(6.4);
  native.active=false; native.listeners.appPaused(); await flush();
  assert.equal(h.t.state.mode,'paused'); assert.equal(h.t.position(h.t.state.elapsed).completed,1);
  assert.equal(h.elements.get('screenState').dataset.active,'false');
  native.active=true; native.listeners.appResumed(); await flush();
  assert.equal(h.t.state.mode,'paused'); assert.equal(h.elements.get('screenState').dataset.active,'true');
  await h.t.start(); assert.equal(h.t.position(0).kind,'prep'); assert.equal(h.t.position(0).completed,1);
});
test('过时状态查询不会覆盖新的前台状态，查询失败不影响训练', async () => {
  const native=nativeStub(), h=load({nativeScreen:native}); await flush();
  let resolveOld; native.getState=()=>new Promise(resolve=>{resolveOld=resolve;});
  native.listeners.appPaused();
  native.getState=async()=>({active:true,foreground:true}); native.listeners.appResumed(); await flush();
  resolveOld({active:false,foreground:false}); await flush();
  assert.equal(h.elements.get('screenState').dataset.active,'true');
  native.getState=async()=>{throw new Error('unavailable');};
  h.setup(1,1,2); await h.t.start(); await flush();
  assert.equal(h.t.state.mode,'running'); assert.equal(h.elements.get('screenState').textContent,'状态暂不可用');
});
