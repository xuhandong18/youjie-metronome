const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'web', 'index.html'), 'utf8');
const attrs = s => Object.fromEntries([...s.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
class Element {
  get value() { return this._value; } set value(value) { this._value = String(value); }
  constructor(a = {}) { Object.assign(this, a); this.value = a.value || ''; this.checked = false; this.style = {}; this.dataset = {}; this.textContent = ''; this.events = {}; this.classList = { toggle() {}, contains() { return false; } }; for (const [key, value] of Object.entries(a)) if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value; }
  addEventListener(kind, fn) { this.events[kind] = fn; } setAttribute(key, value) { this[key] = value; } querySelector() { return this.child ||= new Element(); }
}
const elements = new Map([...html.matchAll(/<[^>]+\bid="[^"]+"[^>]*>/g)].map(m => { const a = attrs(m[0]); const el = new Element(a); el.checked = /\bchecked\b/.test(m[0]); return [a.id, el]; }));
const buttons = [...html.matchAll(/<button\b([^>]*)>/g)].map(m => new Element(attrs(m[1])));
const document = { hidden: false, events: {}, body: new Element(), getElementById: id => elements.get(id), addEventListener(kind, fn) { this.events[kind] = fn; }, querySelectorAll: selector => buttons.filter(b => selector.startsWith('.') ? b.class?.split(' ').includes(selector.slice(1)) : 'input' in b.dataset) };
const nodes = [];
const param = () => ({ setValueAtTime(value) { this.value = value; }, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime(value) { this.value = value; } });
const buffer = (length, rate, data = new Float32Array(length)) => ({ length, duration: length / rate, sampleRate: rate, getChannelData: () => data });
const node = () => { const result = { frequency: param(), playbackRate: param(), connect() {}, disconnect() {}, start(at) { this.at = at; }, stop(at) { this.stopAt = at; this.stops = (this.stops || 0) + 1; } }; nodes.push(result); return result; };
class FakeAudio {
  constructor() { this.currentTime = 0; this.sampleRate = 22050; this.state = 'running'; this.destination = {}; this.events = {}; }
  createGain() { return { gain: param(), connect() {}, disconnect() {} }; }
  createOscillator() { return node(); } createBufferSource() { return node(); }
  createBuffer(channels, length, rate) { return buffer(length, rate); }
  async decodeAudioData(data) { const wav = Buffer.from(data), length = wav.readUInt32LE(40) / 2, rate = wav.readUInt32LE(24), samples = new Float32Array(length); for (let i = 0; i < length; i++) samples[i] = wav.readInt16LE(44 + i * 2) / 32768; return buffer(length, rate, samples); }
  addEventListener(kind, fn) { this.events[kind] = fn; } async resume() { this.state = 'running'; }
}
let saved;
const sandbox = { document, window: { AudioContext: FakeAudio, addEventListener() {} }, navigator: {}, localStorage: { getItem() { return saved || null; }, setItem(key, value) { saved = value; } }, atob, setInterval: () => 1, clearInterval() {}, console, __sounds: [] };
vm.createContext(sandbox);
let source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
source = source.replace('function sound(kind, at, slot = Infinity, number) {', 'function sound(kind, at, slot = Infinity, number) { globalThis.__sounds.push({kind, at, slot, number});');
source = source.replace('restoreSettings(); config = readConfig(true);', 'globalThis.test = {state, position, refreshSettings, start, pause, reset, tick, elapsedNow, numberBuffer, updateVolume, restoreSettings, getConfig: () => config, getAudio: () => audio, getMaster: () => master, getVoices: () => voiceBuffers}; restoreSettings(); config = readConfig(true);');
vm.runInContext(source, sandbox);
const t = sandbox.test, set = (id, value) => { elements.get(id).value = String(value); };
function setup(up, down, reps, rest = 0, every = 1, order = 'up-down', prep = false) { t.reset(); set('upSeconds', up); set('downSeconds', down); set('repetitions', reps); set('breathSeconds', rest); set('breathEvery', every); elements.get('prep').checked = prep; buttons.find(b => b.dataset.order === order).events.click(); t.refreshSettings(true); sandbox.__sounds.length = 0; }
function at(time) { const audio = t.getAudio(); audio.currentTime = t.state.anchor + time; t.tick(); }
const cues = () => Array.from(t.state.cues, c => [Number(c.time.toFixed(6)), c.kind, c.number]);
(async () => {
  assert.equal(t.getConfig().exercise, 158); assert.equal(t.getConfig().total, 161); assert.equal(elements.get('volume').value, '100');
  setup(1, 4, 2, 0, 1, 'down-up'); await t.start();
  assert.deepEqual(cues().slice(0, 6), [[0,'down',undefined],[1,'count',3],[2,'count',2],[3,'count',1],[4,'up',undefined],[5,'down',undefined]]);
  assert.equal(t.position(0).kind, 'down'); assert.equal(t.position(4).kind, 'up'); assert.equal(t.position(5).completed, 1); assert.equal(t.position(10).kind, 'finish');
  console.log('通过：4 秒下准确播报“下、三、二、一”，第 4 秒切换到上；支持先下后上。');
  setup(1, 5, 20); await t.start();
  assert.equal(t.state.cues.length, 121);
  assert.deepEqual(cues().slice(0, 7), [[0,'up',undefined],[1,'down',undefined],[2,'count',4],[3,'count',3],[4,'count',2],[5,'count',1],[6,'up',undefined]]);
  assert.equal(t.position(5.999).completed, 0); assert.equal(t.position(6).completed, 1); assert.equal(t.position(120).completed, 20);
  setup(1, 3, 1, 0, 1, 'down-up'); await t.start();
  assert.deepEqual(cues().slice(0, 4).map(c => c[1]), ['down','down','down','up']);
  console.log('通过：5 秒动作按剩余秒数倒数；3 秒及以内每秒报动作；每个边界仅一个提示。');
  setup(1, 1, 5, 3, 2); await t.start();
  assert.equal(t.getConfig().exercise, 16);
  assert.deepEqual(cues().filter(c => c[1] === 'breath').map(c => c[0]), [4,11]);
  for (const [time, kind, completed] of [[4,'breath',2],[7,'up',2],[11,'breath',4],[14,'up',4],[16,'finish',5]]) { assert.equal(t.position(time).kind, kind); assert.equal(t.position(time).completed, completed); }
  setup(1, 1, 4, 3, 2); await t.start(); assert.equal(t.getConfig().exercise, 11); assert.equal(cues().filter(c => c[1] === 'breath').length, 1); assert.equal(cues().at(-1)[0], 11);
  setup(1, 1, 1, 120, 1); assert.equal(t.getConfig().exercise, 2);
  setup(1, 1, 20, 2, 999); assert.equal(t.getConfig().exercise, 40);
  console.log('通过：每 2 次换气位置正确；最后一次不换气；间隔超过总次数不额外等待。');
  setup(0.3, 0.7, 3, 0.5, 2); await t.start();
  for (let i = 0; i <= 141; i++) at(i * 0.025);
  assert.equal(t.state.mode, 'done'); assert.equal(elements.get('completed').textContent, '03'); assert.equal(elements.get('remaining').textContent, '00:00');
  assert.equal(sandbox.__sounds.filter(s => s.kind === 'up').length, 3); assert.equal(sandbox.__sounds.filter(s => s.kind === 'down').length, 3); assert.equal(sandbox.__sounds.filter(s => s.kind === 'breath').length, 1); assert.equal(sandbox.__sounds.filter(s => s.kind === 'finish').length, 1);
  const count = sandbox.__sounds.length; at(20); assert.equal(sandbox.__sounds.length, count);
  assert.ok(nodes.filter(n => n.buffer).every(n => n.playbackRate.value >= 1));
  console.log('通过：小数秒动作与换气、准确计次、结束音只一次、完成后停止。');
  setup(1, 4, 2, 0, 1, 'down-up'); await t.start(); at(1.4); t.pause();
  const frozen = t.state.elapsed, soundCount = sandbox.__sounds.length; t.getAudio().currentTime += 100; assert.equal(t.elapsedNow(), frozen);
  await t.start(); assert.equal(sandbox.__sounds.length, soundCount); at(1.81);
  assert.equal(sandbox.__sounds.at(-1).number, 2); assert.ok(Math.abs(sandbox.__sounds.at(-1).at - (t.state.anchor + 2)) < 1e-7);
  t.reset(); assert.equal(t.state.mode, 'idle'); assert.equal(t.state.elapsed, 0);
  console.log('通过：暂停继续保留倒数相位，不插入额外语音打乱每秒节拍；重置取消后续声音。');
  setup(1, 1, 3, 2, 2, 'down-up', true); await t.start();
  assert.equal(t.state.cues[0].number, 3); assert.equal(t.state.cues[1].number, 2); assert.equal(t.state.cues[2].number, 1); assert.equal(t.position(3).kind, 'down');
  document.hidden = true; document.events.visibilitychange(); assert.equal(t.state.mode, 'paused'); document.hidden = false;
  console.log('通过：中文三二一准备后按所选顺序开始；切到后台自动暂停。');
  const voices = t.getVoices(); assert.equal(Object.keys(voices).filter(k => !k.startsWith('number-')).length, 16);
  for (const [key, clip] of Object.entries(voices).filter(([key]) => !key.startsWith('number-'))) { assert.ok(clip.duration > 0.1 && clip.duration < 0.8, key); assert.ok(Math.max(...clip.getChannelData(0).map(Math.abs)) > 0.94, key); }
  assert.equal(t.numberBuffer(101).length, voices.n1.length + voices.hundred.length + voices.n0.length + voices.n1.length);
  assert.equal(t.numberBuffer(119).length, voices.n1.length + voices.hundred.length + voices.n1.length + voices.ten.length + voices.n9.length);
  assert.equal(t.getMaster().gain.value, 1); set('volume',0); t.updateVolume(); assert.equal(t.getMaster().gain.value, 0); set('volume',100); t.updateVolume();
  console.log('通过：全部中文录音已嵌入、音频峰值提高、可静音、长动作中文数字可组合。');
  setup(-8, 500, 2.8, -2, 2.7); assert.equal(t.getConfig().up, 0.1); assert.equal(t.getConfig().down, 120); assert.equal(t.getConfig().reps, 3); assert.equal(t.getConfig().breath, 0); assert.equal(t.getConfig().breathEvery, 3);
  setup('', 'invalid', 0, '', 0); assert.equal(t.getConfig().up, 1); assert.equal(t.getConfig().down, 5); assert.equal(t.getConfig().reps, 1); assert.equal(t.getConfig().breath, 2); assert.equal(t.getConfig().breathEvery, 1);
  console.log('通过：空值、负值、超范围和非整数次数/间隔均被校正。');
  t.reset(); const audio = t.getAudio(); audio.state = 'suspended'; let unblock; audio.resume = () => new Promise(resolve => { unblock = () => { audio.state = 'running'; resolve(); }; });
  const pending = t.start(); assert.equal(t.state.mode, 'starting'); t.reset(); unblock(); await pending; assert.equal(t.state.mode, 'idle'); assert.equal(t.state.interval, null);
  console.log('通过：开启声音过程中重置，不会意外启动训练。');
  console.log('全部新版节拍器检查通过。');
})().catch(error => { console.error(error); process.exitCode = 1; });
