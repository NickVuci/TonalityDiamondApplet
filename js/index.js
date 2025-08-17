
;(function boot(init){
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})(function init(){
  'use strict';
  // ---------- Helpers ----------
  const gcd=(a,b)=>{a=Math.abs(a);b=Math.abs(b);while(b){[a,b]=[b,a%b];}return a;};
  const primesUpTo=(n)=>{n=Math.max(2, n|0);const s=new Array(n+1).fill(true);s[0]=s[1]=false;for(let p=2;p*p<=n;p++) if(s[p]) for(let k=p*p;k<=n;k+=p) s[k]=false;return [...Array(n+1).keys()].filter(i=>s[i]);};
  const factorAllowed=(n,allow)=>{if(n===1) return true; let m=n; for(const p of allow){ while(m%p===0) m/=p; } return m===1; };
  const normalizeFloat=(r)=>{ let x=r; while(x>=2) x/=2; while(x<1) x*=2; return x; };
  const hue=(n)=> (n*137+61)%360; const colorOdd=(n)=> n===1?"#f2f4f8":`hsl(${hue(n)} 75% 60%)`; const soften=(c)=>{ const m=c.match(/hsl\(([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\)/); if(!m) return c; const h=+m[1], s=+m[2], l=+m[3]; return `hsl(${h} ${s}% ${Math.min(92,l+22)}%)`; };
  const clamp=(x,a,b)=> Math.min(b, Math.max(a,x));

    // Attach build triggers to relevant inputs
    function attachBuildTriggers() {
      ['oddLimit', 'primeLimit', 'customNums'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('keydown', e => { if (e.key === 'Enter') build(); });
        el.addEventListener('blur', build);
      });
    }
    attachBuildTriggers();
  // --- Prime-base color mapping: prime gets full saturation, composites desaturate progressively ---
  function largestPrimeFactor(n){
    n = Math.abs(n|0);
    if (n <= 1) return 1;
    let maxPrime = 1;
    while (n % 2 === 0) {
        maxPrime = 2;
        n /= 2;
    }
    for (let p = 3; p * p <= n; p += 2) {
        while (n % p === 0) {
        maxPrime = p;
        n /= p;
        }
    }
    if (n > 2) maxPrime = n;
    return maxPrime;
  }
  function colorByPrimeBase(n){
    if(n===1) return "#f2f4f8"; // special-case unison color
    const p = largestPrimeFactor(n);
    const h = (primeHueMap.get(p) ?? hue(p)); // per-grid distinct hues; fallback to golden-angle if missing
    const k = Math.max(1, Math.round(n / p)); // multiplicative distance from the base prime
    const s = Math.max(28, Math.min(75, 75 * Math.pow(0.85, k-1))); // progressive desaturation
    const l = 60; // keep constant lightness; axis tiles are softened separately
    return `hsl(${h} ${s.toFixed(1)}% ${l}%)`;
  }

  // ---------- Audio (robust + banner) ----------
  let actx=null, master=null; const active=new Map();
  const audioBanner = document.getElementById('audioBanner');
  const audioBannerMsg = document.getElementById('audioBannerMsg');
  const enableAudioBtn = document.getElementById('enableAudio');
  const showAudioBanner=(msg)=>{ if(msg) audioBannerMsg.textContent=msg; audioBanner.classList.remove('hidden'); };
  const hideAudioBanner=()=>{ audioBanner.classList.add('hidden'); };

  function hasTarget(param){ return param && typeof param.setTargetAtTime==="function"; }
  async function ensureAudio(){
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if(!Ctor){ showAudioBanner('Audio not supported in this browser.'); return null; }
    if(!actx){
      try{ actx=new Ctor(); }
      catch(err){ console.error('AudioContext creation failed', err); showAudioBanner('Audio failed to initialize.'); return null; }
      try{
        master=actx.createGain(); master.gain.value=0.18; master.connect(actx.destination);
        const o=actx.createOscillator(); const g=actx.createGain(); g.gain.value=0; o.connect(g); g.connect(master); o.start(); o.stop(actx.currentTime);
      }catch(err){ console.error('Audio node graph failed', err); showAudioBanner('Audio failed to initialize.'); return null; }
      actx.onstatechange = ()=>{ if(actx.state==='running') hideAudioBanner(); else showAudioBanner('Audio disabled — tap anywhere or click Enable.'); };
    }
    if(actx.state==='suspended'){
      try{ await actx.resume(); }catch(e){ /* user gesture required */ }
    }
    if(actx.state!=='running') showAudioBanner('Audio disabled — tap anywhere or click Enable.'); else hideAudioBanner();
    return actx;
  }

  // Pitch + keys
  function normalizeFrac(sn,sd){
    if(sn===sd) return [1,1];
    let n=sn, d=sd;
    while(n/d >= 2){ d*=2; }
    while(n/d < 1){ n*=2; }
    const g=gcd(n,d);
    return [n/g, d/g];
  }
  const labelMode=()=> document.querySelector('input[name="labels"]:checked').value;
  function ratioFor(sn,sd){ const r = sn/sd; return (labelMode()==='norm') ? normalizeFloat(r) : r; }
  function noteKeyFor(sn,sd){
    // Key identity should mirror the audible pitch so we don't duplicate the same note
    if(labelMode()==='norm'){
      const [n2,d2]=normalizeFrac(sn,sd);
      return `note-${n2}/${d2}`;
    }
    return `note-${sn}/${sd}`;
  }
  function rtof(r){ const ref=parseFloat(document.getElementById('refHz').value||'392'); return ref*r; }

  async function noteOn(key,f){
    await ensureAudio();
    if(!actx){ console.warn('Audio unavailable'); return; }
    if(active.has(key)) return;
    const o=actx.createOscillator(); const g=actx.createGain();
    o.type=document.getElementById('wave').value; o.frequency.value=f;
    g.gain.value=0.0001; o.connect(g); g.connect(master);
    const att=Math.max(0,parseFloat(document.getElementById('attack').value||'5'))/1000;
    const now=actx.currentTime||0;
    if(hasTarget(g.gain)) g.gain.setTargetAtTime(1.0, now, Math.max(0.001, att)); else g.gain.setValueAtTime(1.0, now);
    o.start();
    active.set(key,{o,g});
    hideAudioBanner();
  }
  function noteOff(key){
    const s = active.get(key);
    if(!s) return;
    try{
        if(s.g && s.g.gain){
        s.g.gain.cancelScheduledValues && s.g.gain.cancelScheduledValues(0);
        s.g.gain.setValueAtTime && s.g.gain.setValueAtTime(0, actx.currentTime || 0);
        }
        s.o && s.o.stop && s.o.stop();
        s.o && s.o.disconnect && s.o.disconnect();
        s.g && s.g.disconnect && s.g.disconnect();
    }catch(e){}
    active.delete(key);
  }
  function stopAll(){ for(const k of Array.from(active.keys())) noteOff(k); if(window._stopAllSustain) window._stopAllSustain(); }
  document.getElementById('panic').addEventListener('click', stopAll);

  const gestureResume=()=>{ if(!actx || actx.state!=='running'){ ensureAudio(); } };
  document.addEventListener('pointerdown', gestureResume, true);
  document.addEventListener('keydown', gestureResume, true);

  document.addEventListener('visibilitychange', ()=>{ if(document.hidden){ stopAll(); } else { if(!actx || actx.state!=='running') showAudioBanner('Audio disabled — tap anywhere or click Enable.'); } });
  enableAudioBtn.addEventListener('click', ()=>{ ensureAudio(); });

  // ---------- Build ----------
  const viewport = document.getElementById('viewport');
  const wrap = document.getElementById('diamondWrap');
  const stage = document.getElementById('stage');
  function clearStage(){ stage.innerHTML=''; stage.style.gridTemplateColumns=''; stage.style.gridTemplateRows=''; }
  const mode=()=> document.querySelector('input[name="mode"]:checked').value;
  let currentNums = [];
  // Map of prime -> hue for the current grid; ensures primes are maximally separated on the wheel
  let primeHueMap = new Map();
  function computePrimeHueMap(nums){
    const bases = new Set();
    for(const n of nums){ if(n>1) bases.add(largestPrimeFactor(n)); }
    const primes = Array.from(bases).sort((a,b)=>a-b);
    const m = Math.max(1, primes.length);
    const offset = 17; // degrees; small offset so first prime isn't exactly red
    primeHueMap.clear();
    for(let i=0;i<primes.length;i++){
      const h = (offset + i * 360 / m) % 360; // evenly spaced around the hue circle
      primeHueMap.set(primes[i], h);
    }
  }

  const oddset=L=>{ const out=[]; for(let i=1;i<=L;i+=2) out.push(i); return out; };
  const limitset=(L,P)=>{ // odd-limit base, optionally filtered by prime-limit intersection
    L = Math.max(1, L|0); if(L%2===0) L--; const odds = oddset(L);
    const p = parseInt(P, 10);
    if(!isFinite(p) || p<2) return odds;
    const allow = primesUpTo(p);
    return odds.filter(n=> factorAllowed(n, allow));
  };
  const parseCustom=(text)=>{ const arr=(text||'').split(/[^\d]+/).filter(Boolean).map(x=>parseInt(x,10)).filter(n=>Number.isFinite(n)&&n>0); const out=[]; const seen=new Set(); for(const n of arr){ if(!seen.has(n)){ seen.add(n); out.push(n); } } return out; };

  function makeLabel(a,b,sn,sd){
    if(labelMode()==='rows') return `${b}/${a}`;
    const [n2,d2] = normalizeFrac(sn,sd);
    return `${n2}/${d2}`;
  }

  function render(nums){
    clearStage(); const N=nums.length; if(N<1) return; stage.dataset.n = N; stage.style.gridTemplateColumns = `repeat(${N+1}, var(--cell))`; stage.style.gridTemplateRows = `repeat(${N+1}, var(--cell))`;

    const corner=document.createElement('div'); corner.className='tile axis'; corner.tabIndex=0; const cornerCell=document.createElement('div'); cornerCell.className='cell'; corner.appendChild(cornerCell); stage.appendChild(corner);

    // top axis (columns)
    for(let j=0;j<N;j++){
      const t=document.createElement('div'); t.className='tile axis'; t.tabIndex=0;
      const cell=document.createElement('div'); cell.className='cell';
      const lab=document.createElement('div'); lab.className='label'; lab.textContent=nums[j];
      cell.appendChild(lab); t.appendChild(cell);
      t.style.background=soften(colorByPrimeBase(nums[j]));
      t.dataset.axis='col'; t.dataset.value=nums[j];
      stage.appendChild(t);
    }

    // left axis (rows) + grid
    for(let i=0;i<N;i++){
      const at=document.createElement('div'); at.className='tile axis'; at.tabIndex=0;
      const ac=document.createElement('div'); ac.className='cell';
      const alab=document.createElement('div'); alab.className='label'; alab.textContent=nums[i];
      ac.appendChild(alab); at.appendChild(ac);
      at.style.background=soften(colorByPrimeBase(nums[i]));
      at.dataset.axis='row'; at.dataset.value=nums[i];
      stage.appendChild(at);

      for(let j=0;j<N;j++){
        const a=nums[i], b=nums[j];
        const g=gcd(a,b); const sn=b/g, sd=a/g; // reduced for pitch
        const r=sn/sd;
        const labelText = makeLabel(a,b,sn,sd);

        const tile=document.createElement('div'); tile.className='tile'; tile.dataset.num=sn; tile.dataset.den=sd; tile.dataset.a=a; tile.dataset.b=b;
        tile.style.setProperty('--numColor', colorByPrimeBase(b));
        tile.style.setProperty('--denColor', colorByPrimeBase(a));

        const cell=document.createElement('div'); cell.className='cell';
        const label=document.createElement('div'); label.className='label';
        const frac=document.createElement('div'); frac.className='frac';
        const parts = labelText.split('/');
        const n=document.createElement('div'); n.className='n'; n.textContent=parts[0];
        const bar=document.createElement('div'); bar.className='bar';
        const d=document.createElement('div'); d.className='d'; d.textContent=parts[1];
        frac.appendChild(n); frac.appendChild(bar); frac.appendChild(d);
        label.appendChild(frac);
        const tip=document.createElement('div'); tip.className='tip'; const base=ratioFor(sn,sd); const cents=1200*Math.log2(base); tip.textContent=`${labelText} • ${(parseFloat(document.getElementById('refHz').value||'392')*base).toFixed(2)} Hz • ${(cents>=0?'+':'')+cents.toFixed(2)}¢`;
        cell.appendChild(label);
        tile.appendChild(cell); stage.appendChild(tile);
      }
    }
    fitToViewport();
    attachAxisHandlers();
    drawGridLines();
  }

  // Draw grid lines in SVG (for perfect alignment)
  function drawGridLines() {
    const svg = document.getElementById('gridLines');
    if (!svg) return;
    
    svg.innerHTML = ''; // Clear previous lines
    const N = parseInt(stage.dataset.n || '0', 10);
    if (N < 1) return;
    
    // Get size variables
    const cs = getComputedStyle(document.documentElement);
    const cellSize = parseFloat(cs.getPropertyValue('--cell')) || 32;
    const gridWidth = parseFloat(cs.getPropertyValue('--grid-width')) || 2;
    const gridColor = cs.getPropertyValue('--grid-color') || '#0b0d10';
    
    // Set SVG size
    const svgSize = (N + 1) * cellSize;
    svg.setAttribute('width', svgSize);
    svg.setAttribute('height', svgSize);
    
    // Draw horizontal grid lines along cell borders
    for (let r = 0; r <= N; r++) {
      // Position lines at cell borders
      const y = r * cellSize;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', 0);
      line.setAttribute('y1', y);
      line.setAttribute('x2', svgSize);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', gridColor);
      line.setAttribute('stroke-width', gridWidth);
      svg.appendChild(line);
    }
    
    // Draw vertical grid lines along cell borders
    for (let c = 0; c <= N; c++) {
      // Position lines at cell borders
      const x = c * cellSize;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x);
      line.setAttribute('y1', 0);
      line.setAttribute('x2', x);
      line.setAttribute('y2', svgSize);
      line.setAttribute('stroke', gridColor);
      line.setAttribute('stroke-width', gridWidth);
      svg.appendChild(line);
    }
  }

  // ---------- Layout: fit + zoom (buttons, pinch, ctrl+wheel) ----------
  let baseScale = 1; let userZoom = 1;
  function gridSizePx(){ const N = parseInt(stage.dataset.n||'0',10); const cs = getComputedStyle(document.documentElement); const cell = parseFloat(cs.getPropertyValue('--cell')) || 32; const gap = parseFloat(cs.getPropertyValue('--gap')) || 1; const count = N + 1; const width = count*cell + N*gap; return width; }
  function applyTransform(){ 
    wrap.style.transform = `translate(-50%,-50%) rotate(var(--wrap-rot)) scale(${(baseScale*userZoom).toFixed(5)})`; 
    const zoomPct = Math.round(userZoom*100); 
    document.getElementById('zoomPct').textContent = zoomPct+"%";
    // Redraw grid lines on transform changes
    drawGridLines();
  }
  function fitToViewport(){ const size = gridSizePx(); const diag = size * Math.SQRT2; const pad = 24; const availW = viewport.clientWidth - pad; const availH = viewport.clientHeight - pad; baseScale = clamp(Math.min(availW/diag, availH/diag), 0.01, 20); if(!isFinite(baseScale) || baseScale<=0) baseScale = 1; applyTransform(); }
  window.addEventListener('resize', fitToViewport);

  document.getElementById('zoomIn').addEventListener('click', ()=>{ userZoom = clamp(userZoom*1.15, 0.05, 40); applyTransform(); });
  document.getElementById('zoomOut').addEventListener('click', ()=>{ userZoom = clamp(userZoom/1.15, 0.05, 40); applyTransform(); });
  document.getElementById('fit').addEventListener('click', ()=>{ userZoom = 1; fitToViewport(); });

  // Pinch (two-pointer) + Ctrl+Wheel
  const pinch = { points:new Map(), startDist:0, startZoom:1 };
  viewport.addEventListener('pointerdown', (e)=>{ if(e.target.closest('#menu')) return; if(e.pointerType!=='touch' && e.pointerType!=='pen') return; viewport.setPointerCapture(e.pointerId); pinch.points.set(e.pointerId, {x:e.clientX, y:e.clientY}); if(pinch.points.size===2){ const [a,b]=[...pinch.points.values()]; pinch.startDist = Math.hypot(b.x-a.x, b.y-a.y); pinch.startZoom = userZoom; } });
  viewport.addEventListener('pointermove', (e)=>{ if(!pinch.points.has(e.pointerId)) return; pinch.points.set(e.pointerId, {x:e.clientX, y:e.clientY}); if(pinch.points.size===2 && pinch.startDist>0){ const [a,b]=[...pinch.points.values()]; const d = Math.hypot(b.x-a.x, b.y-a.y); userZoom = clamp(pinch.startZoom * (d / pinch.startDist), 0.05, 40); applyTransform(); } });
  const endPinch=(e)=>{ if(pinch.points.has(e.pointerId)) pinch.points.delete(e.pointerId); if(pinch.points.size<2){ pinch.startDist=0; } };
  viewport.addEventListener('pointerup', endPinch);
  viewport.addEventListener('pointercancel', endPinch);
  viewport.addEventListener('wheel', (e)=>{ if(!e.ctrlKey) return; e.preventDefault(); const factor = Math.exp(-e.deltaY * 0.0015); userZoom = clamp(userZoom * factor, 0.05, 40); applyTransform(); }, {passive:false});

  // ---------- Interaction: Drag-to-play + Shift-sustain ----------
  const mods = { shift:false };
  window.addEventListener('keydown', (e)=>{ if(e.key === 'Shift') mods.shift = true; });
  window.addEventListener('keyup', (e)=>{ if(e.key === 'Shift'){ mods.shift = false; releaseSustained(); }});

  const sustainKeys = new Set();
  function releaseSustained(){ for(const key of Array.from(sustainKeys)){ noteOff(key); sustainKeys.delete(key); } stage.querySelectorAll('.tile.play').forEach(t=>{ const k=noteKeyFor(+t.dataset.num, +t.dataset.den); if(!active.has(k)) t.classList.remove('play'); }); }
  window._stopAllSustain = () => releaseSustained();

  const gesture={ active:false, pointerId:null, touched:new Set() };
  function tileFromPoint(x,y){ let el=document.elementFromPoint(x,y); while(el && el!==stage && !el.classList.contains('tile')) el=el.parentElement; if(el && el.classList.contains('tile') && !el.classList.contains('axis')) return el; return null; }
  async function triggerTile(tile){ if(!tile) return; const sn=+tile.dataset.num, sd=+tile.dataset.den; const key=noteKeyFor(sn,sd); if(gesture.touched.has(key)) return; gesture.touched.add(key); tile.classList.add('play'); await noteOn(key, rtof(ratioFor(sn,sd))); if(mods.shift){ sustainKeys.add(key); } else { const relMs=Math.max(10, parseFloat(document.getElementById('release').value||'250')); setTimeout(()=>{ noteOff(key); if(!active.has(key)) tile.classList.remove('play'); }, relMs+40); } }
  function endGesture(){ if(!gesture.active) return; gesture.active=false; gesture.pointerId=null; gesture.touched.clear(); stage.querySelectorAll('.tile.play').forEach(t=>{ const k=noteKeyFor(+t.dataset.num, +t.dataset.den); if(!active.has(k)) t.classList.remove('play'); }); }
  stage.addEventListener('pointerdown', async ev=>{ if(ev.target.closest('.tile.axis')) return; ev.preventDefault(); gesture.active=true; gesture.pointerId=ev.pointerId; gesture.touched.clear(); await triggerTile(tileFromPoint(ev.clientX, ev.clientY)); });
  window.addEventListener('pointermove', async ev=>{ if(!gesture.active || ev.pointerId!==gesture.pointerId) return; await triggerTile(tileFromPoint(ev.clientX, ev.clientY)); });
  window.addEventListener('pointerup', ev=>{ if(gesture.active && ev.pointerId===gesture.pointerId) endGesture(); });
  window.addEventListener('pointercancel', ev=>{ if(gesture.active && ev.pointerId===gesture.pointerId) endGesture(); });
  viewport.addEventListener('pointerdown', (e)=>{ if(pinch.points.size===1) endGesture(); });

  // ---------- Axis behavior (Shift+click = chord, two-click = arpeggio with 2s arm) ----------
  const axisClickState = new WeakMap();
  function collectLineCells(ax){ const val=ax.dataset.value; const isRow=ax.dataset.axis==='row'; const sel=isRow? `.tile[data-a="${val}"]` : `.tile[data-b="${val}"]`; return Array.from(stage.querySelectorAll(sel)); }
  function uniqueKeysFromCells(cells){ const keys=[]; const seen=new Set(); for(const c of cells){ const k=noteKeyFor(+c.dataset.num, +c.dataset.den); if(!seen.has(k)){ seen.add(k); keys.push(k); } } return keys; }
  async function playChord(ax, sustain){ const cells=collectLineCells(ax); const keys=uniqueKeysFromCells(cells); await ensureAudio(); for(const c of cells){ c.classList.add('play'); } await Promise.all(keys.map(async k=>{ const [sn,sd]=k.replace('note-','').split('/').map(Number); await noteOn(k, rtof(ratioFor(sn,sd))); })); if(sustain){ keys.forEach(k=>sustainKeys.add(k)); } else { const relMs=Math.max(10, parseFloat(document.getElementById('release').value||'250')); setTimeout(()=> keys.forEach(noteOff), relMs+40); } }
  async function playArpeggio(ax, stepMs){ const cells=collectLineCells(ax); const keys=uniqueKeysFromCells(cells); await ensureAudio(); cells.forEach(c=>c.classList.add('play')); let i=0; const id=setInterval(async ()=>{ if(i>=keys.length){ clearInterval(id); return; } const k=keys[i++]; const [sn,sd]=k.replace('note-','').split('/').map(Number); await noteOn(k, rtof(ratioFor(sn,sd))); const relMs=Math.max(10, parseFloat(document.getElementById('release').value||'250')); setTimeout(()=> noteOff(k), relMs+40); }, Math.max(40, Math.min(1200, stepMs||120))); }
  function attachAxisHandlers(){ stage.querySelectorAll('.tile.axis[data-axis]').forEach(ax=>{ ax.addEventListener('click', async ev=>{ ev.preventDefault(); if(mods.shift){ await playChord(ax, true); return; } let st = axisClickState.get(ax) || {}; if(!st.armTs){ st.armTs = performance.now(); if(st.timer) clearTimeout(st.timer); ax.classList.add('armed'); st.timer = setTimeout(()=>{ axisClickState.set(ax, {}); ax.classList.remove('armed'); }, 2000); axisClickState.set(ax, st); } else { const step = Math.max(40, Math.min(1200, performance.now() - st.armTs)); if(st.timer) clearTimeout(st.timer); axisClickState.set(ax, {}); ax.classList.remove('armed'); await playArpeggio(ax, step); } }); }); }

  // ---------- Orientation ----------
  const ORIENT_KEY='td-orientation';
  const rootStyle = document.documentElement.style;
  function setOrientation(val){ if(val==='v'){ rootStyle.setProperty('--wrap-rot','45deg'); rootStyle.setProperty('--label-rot','-45deg'); }else{ rootStyle.setProperty('--wrap-rot','-45deg'); rootStyle.setProperty('--label-rot','45deg'); } try{ localStorage.setItem(ORIENT_KEY, val); }catch(e){} applyTransform(); }
  try{ const saved = localStorage.getItem(ORIENT_KEY); if(saved==='v'){ document.getElementById('o-v').checked=true; setOrientation('v'); } else { document.getElementById('o-h').checked=true; setOrientation('h'); } }catch(e){ setOrientation('h'); }
  document.querySelectorAll('input[name="orient"]').forEach(r=> r.addEventListener('change', (e)=> setOrientation(e.target.value)));
  window.addEventListener('keydown', (e)=>{ if(e.key && e.key.toLowerCase()==='o'){ const v=document.getElementById('o-v').checked; setOrientation(v? 'h':'v'); document.getElementById(v? 'o-h':'o-v').checked=true; } });

  // ---------- Build controls ----------
  function build(){
    const m=mode(); let nums=[];
    if(m==='limit'){
      let L=parseInt(document.getElementById('oddLimit').value,10); if(!isFinite(L)) L=1; if(L%2===0) L--; L=Math.max(1,L); const P=document.getElementById('primeLimit').value; nums=limitset(L, P);
    } else { // custom
      const raw=document.getElementById('customNums').value.trim(); nums = parseCustom(raw);
    }
    currentNums = nums.slice();
    computePrimeHueMap(currentNums);
    render(currentNums);
  }
    const panels = {
        limit: document.getElementById('limit-opts'),
        custom: document.getElementById('custom-opts')
    };

    function updatePanelVisibility() {
        const m = mode();
        for (const k in panels) {
            panels[k].classList.toggle('hidden', k !== m);
        }
    }

    // Attach listeners for mode change
    document.querySelectorAll('input[name="mode"]').forEach(r =>
        r.addEventListener('change', () => {
            updatePanelVisibility();
            build();
        })
    );

    // Ensure correct panel is visible on page load
    updatePanelVisibility();
  document.querySelectorAll('input[name="mode"]').forEach(r=> r.addEventListener('change', ()=>{ const m=mode(); for(const k in panels){ panels[k].classList.toggle('hidden', k!==m); } }));

  // Re-render labels only when label mode changes
  document.querySelectorAll('input[name="labels"]').forEach(r=> r.addEventListener('change', ()=>{ if(currentNums.length) render(currentNums); }));

  // ---------- Optional: lightweight self-tests (opt-in) ----------
  function runSelfTests(){
    try{
      const url = new URL(window.location.href);
      const on = url.hash.includes('selftest') || url.searchParams.get('selftest')==='1';
      if(!on) return; // opt-in only

      const assert = (name, cond)=> console[(cond?'log':'error')]((cond?'✓ ':'✗ ')+name);
      const _noteOn = noteOn, _noteOff = noteOff; // stub audio for silent tests
      window.noteOn = async (key)=>{ active.set(key, {o:null,g:null}); };
      window.noteOff = (key)=>{ active.delete(key); };

      // Build: limit mode L=5, P blank
      document.getElementById('m-limit').checked = true;
      document.getElementById('oddLimit').value = 5;
      document.getElementById('primeLimit').value = '';
      build();

      let cells = Array.from(stage.querySelectorAll('.tile:not(.axis)'));
      assert('grid renders cells', cells.length>0);

      // Label mode: rows
      document.getElementById('lbl-rows').checked = true; render(currentNums);
      cells = Array.from(stage.querySelectorAll('.tile:not(.axis)'));
      const any = cells[0];
      const a = +any.dataset.a, b=+any.dataset.b;
      const txt = any.querySelector('.frac .n').textContent + '/' + any.querySelector('.frac .d').textContent;
      assert('rows label shows a/b', txt === `${a}/${b}`);
      // Rows mode: diagonal cells share the same reduced key 1/1
      const diag = cells.filter(t=> +t.dataset.a === +t.dataset.b);
      assert('have multiple diagonal cells', diag.length>=2);
      const k1 = noteKeyFor(+diag[0].dataset.num, +diag[0].dataset.den);
      const k2 = noteKeyFor(+diag[1].dataset.num, +diag[1].dataset.den);
      assert('rows mode: diagonal share key note-1/1', k1==='note-1/1' && k1===k2);

      // Label mode: normalized
      document.getElementById('lbl-norm').checked = true; render(currentNums);
      cells = Array.from(stage.querySelectorAll('.tile:not(.axis)'));
      // find a diagonal cell (unison)
      const unison = cells.find(t=> +t.dataset.a === +t.dataset.b);
      const utxt = unison.querySelector('.frac .n').textContent + '/' + unison.querySelector('.frac .d').textContent;
      assert('normalized unison shows 1/1', utxt === '1/1');
      // Normalization affects key identity for >2 ratios
      const gt2 = cells.find(t=> (+t.dataset.num)/(+t.dataset.den) >= 2);
      if(gt2){
        const sn=+gt2.dataset.num, sd=+gt2.dataset.den;
        const [nx,dx]=normalizeFrac(sn,sd);
        const kNorm = noteKeyFor(sn,sd);
        assert('normalized key equals note-nx/dx', kNorm === `note-${nx}/${dx}`);
      } else {
        assert('found a ratio >= 2 cell (for key test)', false);
      }

      // Color mapping tests: primes share hue with their multiples, and saturation decreases
      const parseHSL = (s)=>{ try{ const inner=s.slice(s.indexOf('(')+1, s.lastIndexOf(')')); const parts=inner.split(' '); return {h:parseFloat(parts[0]), s:parseFloat(parts[1]), l:parseFloat(parts[2])}; }catch(e){ return null; } };
      const c3 = parseHSL(colorByPrimeBase(3));
      const c6 = parseHSL(colorByPrimeBase(6));
      const c9 = parseHSL(colorByPrimeBase(9));
      assert('hue(3) == hue(6)', !!c3 && !!c6 && c3.h === c6.h);
      assert('hue(3) == hue(9)', !!c3 && !!c9 && c3.h === c9.h);
      assert('saturation 3 > 6 > 9', !!c3 && !!c6 && !!c9 && c3.s > c6.s && c6.s > c9.s);

      // Distinct prime hues within a set (use custom set to include several primes)
      document.getElementById('m-custom').checked = true;
      document.getElementById('customNums').value = '3.4.5.6.7.8.9.10.11';
      build();
      const primes = [3,5,7,11];
      const hs = primes.map(p=> { const x=parseHSL(colorByPrimeBase(p)); return x?x.h:NaN; });
      const circDist=(a,b)=>{ const d=Math.abs(a-b); return Math.min(d, 360-d); };
      let minSep=999;
      for(let i=0;i<hs.length;i++) for(let j=i+1;j<hs.length;j++) minSep=Math.min(minSep, circDist(hs[i], hs[j]));
      assert('prime hues reasonably separated (>=45°)', minSep>=45);

      // cleanup
      window.noteOn = _noteOn; window.noteOff = _noteOff;
    }catch(e){ console.error('Self-tests error:', e); }
  }

  // Initial render
  build();
  runSelfTests();
});
