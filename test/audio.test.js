import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../js/modules/audio.js';
import { Player } from '../js/modules/player.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
const param = () => ({
  value: 0, setValueAtTime() {}, linearRampToValueAtTime() {},
  setTargetAtTime() {}, cancelAndHoldAtTime() {}, cancelScheduledValues() {}
});
function context({ suspended = false } = {}) {
  const oscillators = [];
  const ctx = {
    state: suspended ? 'suspended' : 'running', currentTime: 0, destination: {},
    createPeriodicWave: (real, imaginary) => ({ real, imaginary }),
    createBiquadFilter: () => ({ frequency: param(), Q: param(), connect() {}, disconnect() {} }),
    createGain: () => ({ gain: param(), connect() {}, disconnect() {} }),
    createDynamicsCompressor: () => ({ threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), connect() {} }),
    createOscillator() {
      const osc = { frequency: param(), setPeriodicWave(wave) { this.wave = wave; }, starts: 0, stops: 0, connect() {}, disconnect() {}, start() { this.starts++; }, stop() { this.stops++; } };
      oscillators.push(osc); return osc;
    },
    resume: async () => { ctx.state = 'running'; }
  };
  return { ctx, oscillators };
}
test('Stop cancels a note awaiting the browser audio permission/resume', async () => {
  const { ctx, oscillators } = context({ suspended: true });
  let resume;
  ctx.resume = () => new Promise(resolve => { resume = () => { ctx.state = 'running'; resolve(); }; });
  const engine = new AudioEngine({ contextFactory: () => ctx });
  engine.play('3/2', 330); engine.stopAll(); resume(); await tick();
  assert.equal(oscillators.length, 0);
  assert.equal(engine.voices.size, 0);
});
test('releasing one strike cannot terminate a later strike of the same pitch', async () => {
  const { ctx, oscillators } = context();
  const engine = new AudioEngine({ contextFactory: () => ctx });
  const first = engine.play('3/2', 330);
  const second = engine.play('3/2', 330);
  await tick(); engine.release(first);
  assert.equal(oscillators[0].stops, 1);
  assert.equal(oscillators[1].stops, 0);
  assert.ok(engine.voices.has(second)); engine.stopAll();
});
test('volume set before first gesture is applied and polyphony is bounded', async () => {
  const { ctx } = context();
  const engine = new AudioEngine({ contextFactory: () => ctx });
  engine.setVolume(0.1);
  for (let i = 0; i < 50; i++) engine.play(String(i), 220 + i);
  await tick();
  assert.equal(engine.master.gain.value, 0.05500000000000001);
  assert.equal(engine.voices.size, 32);
  engine.stopAll(); assert.equal(engine.voices.size, 0);
});
test('audio initialization failure leaves no voices and supports retry', async () => {
  let fails = true;
  const { ctx } = context();
  const engine = new AudioEngine({ contextFactory: () => { if (fails) throw new Error(); return ctx; } });
  engine.play('1/1', 220); await tick(); assert.equal(engine.voices.size, 0);
  fails = false; engine.play('1/1', 220); await tick(); assert.equal(engine.voices.size, 1);
  engine.stopAll();
});
test('Stop cancels future arpeggio notes, not just currently sounding voices', async () => {
  const calls = [];
  const engine = { play: key => { calls.push(key); return calls.length; }, stopAll() {}, release() {} };
  const player = new Player(engine);
  player.sequence([{ key: '1/1', frequency: 220 }, { key: '3/2', frequency: 330 }], 240);
  player.stop();
  await new Promise(resolve => setTimeout(resolve, 280));
  assert.deepEqual(calls, ['1/1']);
  assert.equal(player.timers.size, 0);
});
test('sustained chords deduplicate unisons and toggle off as a group', () => {
  const released = [], started = [];
  const engine = { play: key => { started.push(key); return started.length; }, release: id => released.push(id) };
  const player = new Player(engine);
  const notes = [{ key: '1/1', frequency: 220 }, { key: '1/1', frequency: 220 }, { key: '3/2', frequency: 330 }];
  player.chord(notes, 'latch'); assert.deepEqual(started, ['1/1', '3/2']);
  player.chord(notes, 'latch'); assert.deepEqual(released, [1, 2]);
  assert.equal(player.latched.size, 0);
});

test('a failed sustained note or chord can be retried without a dead toggle', async () => {
  let fails = true;
  const { ctx } = context();
  const engine = new AudioEngine({ contextFactory: () => { if (fails) throw new Error(); return ctx; } });
  const player = new Player(engine);
  const note = { key: '1/1', frequency: 392 };
  player.chord([note], 'latch'); await tick();
  assert.equal(engine.voices.size, 0);
  fails = false;
  player.chord([note], 'latch'); await tick();
  assert.equal(engine.voices.size, 1);
  player.stop();
});


test('a fresh touch release unlocks every note behind an earlier hanging resume', async () => {
  const {ctx,oscillators}=context({suspended:true});
  let calls=0;
  ctx.resume=()=>{
    if(++calls===1)return new Promise(()=>{});
    ctx.state='running'; return Promise.resolve();
  };
  const engine=new AudioEngine({contextFactory:()=>ctx});
  engine.play('1/1',220);engine.play('3/2',330);
  assert.equal(calls,1);
  assert.equal(oscillators.length,0);
  assert.equal(await engine.ensure(true),true);
  await tick();
  assert.equal(calls,2);
  assert.equal(oscillators.length,2);
  assert.ok(oscillators.every(o=>o.starts===1));
  engine.stopAll();
});

test('Stop cancels queued notes before a fresh activation unlocks the context', async () => {
  const {ctx,oscillators}=context({suspended:true});
  let calls=0;
  ctx.resume=()=>{ if(++calls===1)return new Promise(()=>{});ctx.state='running';return Promise.resolve(); };
  const engine=new AudioEngine({contextFactory:()=>ctx});
  engine.play('1/1',220);engine.stopAll();
  await engine.ensure(true);await tick();
  assert.equal(oscillators.length,0);
});

test('an interrupted context resumes on the next gesture and reports its pause', async () => {
  const {ctx,oscillators}=context();
  const statuses=[];
  const engine=new AudioEngine({contextFactory:()=>ctx,onStatus:(message,error)=>statuses.push({message,error})});
  await engine.ensure();
  ctx.state='interrupted';ctx.onstatechange();
  assert.equal(statuses.at(-1).error,true);
  engine.play('1/1',220);await tick();
  assert.equal(ctx.state,'running');
  assert.equal(oscillators.length,1);
  assert.equal(statuses.at(-1).error,false);
  engine.stopAll();
});

test('a denied resume leaves the engine retryable without retaining dead voices', async () => {
  const {ctx}=context({suspended:true});
  ctx.resume=()=>Promise.reject(new Error('NotAllowedError'));
  const engine=new AudioEngine({contextFactory:()=>ctx});
  engine.play('1/1',220);await tick();
  assert.equal(engine.voices.size,0);
  assert.equal(engine.resumeAttempt,null);
  ctx.resume=()=>{ctx.state='running';return Promise.resolve();};
  engine.play('1/1',220);await tick();
  assert.equal(engine.voices.size,1);
  engine.stopAll();
});


test('an already-running context releases notes even before its statechange event arrives', async () => {
  const {ctx,oscillators}=context({suspended:true});
  ctx.resume=()=>new Promise(()=>{});
  const engine=new AudioEngine({contextFactory:()=>ctx});
  engine.play('1/1',220);
  ctx.state='running';
  await engine.ensure(true);await tick();
  assert.equal(oscillators.length,1);
  assert.equal(engine.resumeAttempt,null);
  engine.stopAll();
});
