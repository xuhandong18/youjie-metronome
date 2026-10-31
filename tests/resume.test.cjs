const test=require('node:test');
const assert=require('node:assert/strict');
const load=require('./harness.cjs');

for (const order of ['up-down','down-up']) test(`${order}：第8次中途暂停，准备后重做第8次，累计换气次数保持不变`,async()=>{
  const h=load(); h.setup(1,4,20,2,2,order); await h.t.start();
  const eighth=h.t.getConfig().segments.find(s=>s.completed===7 && s.kind===order.split('-')[0]);
  h.at(eighth.start+2.5); h.t.pause();
  const oldNodes=h.nodes.filter(n=>n.buffer); await h.t.start();
  assert.equal(h.t.position(0).completed,7); assert.equal(h.t.position(0).kind,'prep');
  assert.equal(h.elements.get('completed').textContent,'07');
  assert.deepEqual(h.cues().slice(0,4).map(c=>[c[0],c[1],c[2]]),[[0,'count',3],[1,'count',2],[2,'count',1],[3,order.split('-')[0],undefined]]);
  assert.ok(oldNodes.every(n=>n.stops>=1));
  assert.equal(h.t.position(8).kind,'breath'); assert.equal(h.t.position(8).completed,8);
  const total=h.t.getSession().total; h.at(total+.1);
  assert.equal(h.t.state.mode,'done'); assert.equal(h.elements.get('completed').textContent,'20');
  assert.equal(h.t.state.cues.filter(c=>c.kind==='finish').length,1);
});
test('准备期间反复暂停都重新倒数3秒；换气期间暂停后直接进入下一次',async()=>{
  const h=load(); h.setup(1,1,4,4,2,'up-down',true); await h.t.start(); h.at(1.1); h.t.pause();
  await h.t.start(); assert.equal(h.t.position(0).remaining,3);
  h.at(1.5); h.t.pause(); await h.t.start(); assert.equal(h.t.position(0).remaining,3);
  h.at(7.5); assert.equal(h.t.position(h.t.elapsedNow()).kind,'breath'); h.t.pause();
  await h.t.start(); assert.equal(h.t.position(0).completed,2);
  assert.equal(h.t.position(3).kind,'up'); assert.equal(h.t.position(3).completed,2);
  assert.equal(h.t.getSession().total,7);
});
test('首次关闭准备仍直接开始；暂停后强制准备；最后一次完成后不被暂停事件重启',async()=>{
  const h=load(); h.setup(1,1,2); await h.t.start(); assert.equal(h.t.position(0).kind,'up');
  h.at(3.5); h.t.pause(); await h.t.start(); assert.equal(h.t.position(0).kind,'prep');
  h.at(5.1); assert.equal(h.t.state.mode,'done'); h.t.pause(); assert.equal(h.t.state.mode,'done');
  assert.equal(h.t.position(h.t.state.elapsed).completed,2);
});
test('换气开关关闭后无等待或换气声音，保存参数并可重新恢复',async()=>{
  const h=load(); h.setup(1,1,5,3,2);
  h.elements.get('breathEnabled').checked=false; h.elements.get('breathEnabled').events.change();
  assert.equal(h.t.getConfig().exercise,10); assert.equal(h.t.getConfig().restCount,0);
  assert.equal(h.elements.get('breathFields').disabled,true); assert.equal(h.saved().breathSeconds,3); assert.equal(h.saved().breathEvery,2);
  await h.t.start(); assert.ok(!h.t.state.cues.some(c=>['breath','restTick'].includes(c.kind)));
  h.t.reset(); h.elements.get('breathEnabled').checked=true; h.elements.get('breathEnabled').events.change();
  assert.equal(h.t.getConfig().exercise,16); assert.equal(h.elements.get('breathFields').disabled,false);
  const restored=load({savedSettings:h.saved()}); assert.equal(restored.t.getConfig().breath,3);
  assert.equal(restored.t.getConfig().breathEvery,2);
});
test('旧版0秒迁移关闭，重新打开用2秒；旧版正数和新版关闭参数正确恢复',()=>{
  const oldOff=load({savedSettings:{breathSeconds:0,breathEvery:3}});
  assert.equal(oldOff.t.getConfig().breathEnabled,false); assert.equal(oldOff.t.getConfig().breath,0);
  oldOff.elements.get('breathEnabled').checked=true; oldOff.elements.get('breathEnabled').events.change();
  assert.equal(oldOff.t.getConfig().breath,2); assert.equal(oldOff.t.getConfig().breathEvery,3);
  assert.equal(load({savedSettings:{breathSeconds:4}}).t.getConfig().breathEnabled,true);
  const restored=load({savedSettings:{breathSeconds:4,breathEvery:2,breathEnabled:false}});
  assert.equal(restored.t.getConfig().breath,0); assert.equal(restored.saved().breathSeconds,4);
});
