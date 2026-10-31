module.exports = function load(options = {}) {
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
let saved = options.savedSettings ? JSON.stringify(options.savedSettings) : undefined;
const sandbox = { document, window: { AudioContext: FakeAudio, addEventListener() {}, ...(options.nativeScreen ? {capacitorExports: {Capacitor: {getPlatform: () => "android"}, registerPlugin: () => options.nativeScreen}} : {}) }, navigator: {}, localStorage: { getItem(key) { return key === 'youjie-action-metronome-v1' ? saved || null : options.keepScreenOff ? '0' : null; }, setItem(key, value) { if (key === 'youjie-action-metronome-v1') saved = value; } }, atob, setInterval: () => 1, clearInterval() {}, console, __sounds: [] };
vm.createContext(sandbox);
let source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
source = source.replace('function sound(kind, at, slot = Infinity, number) {', 'function sound(kind, at, slot = Infinity, number) { globalThis.__sounds.push({kind, at, slot, number});');
source = source.replace('restoreSettings(); config = readConfig(true);', 'globalThis.test = {state, position, refreshSettings, start, pause, reset, tick, elapsedNow, numberBuffer, updateVolume, restoreSettings, getConfig: () => config, getSession: () => session, getAudio: () => audio, getMaster: () => master, getVoices: () => voiceBuffers}; restoreSettings(); config = readConfig(true);');
vm.runInContext(source, sandbox);
const t = sandbox.test, set = (id, value) => { elements.get(id).value = String(value); };
function setup(up, down, reps, rest = 0, every = 1, order = 'up-down', prep = false) { t.reset(); set('upSeconds', up); set('downSeconds', down); set('repetitions', reps); set('breathSeconds', rest); set('breathEvery', every); elements.get('breathEnabled').checked = rest !== 0 && !(Number(rest) < 0); elements.get('prep').checked = prep; buttons.find(b => b.dataset.order === order).events.click(); t.refreshSettings(true); sandbox.__sounds.length = 0; }
function at(time) { const audio = t.getAudio(); audio.currentTime = t.state.anchor + time; t.tick(); }
const cues = () => Array.from(t.state.cues, c => [Number(c.time.toFixed(6)), c.kind, c.number]);

return {t, setup, at, elements, sandbox, nodes, buttons, set, cues, saved: () => JSON.parse(saved)};
};
