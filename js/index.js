import { AudioEngine } from './modules/audio.js';
import { Player } from './modules/player.js';
import { DiamondView } from './modules/grid.js';
import { DEFAULTS, readConfig, validateConfig, numbersFor, shareURL } from './modules/config.js';
import { uniquePitches } from './modules/math.js';

const $ = id => document.getElementById(id);
const STORAGE_KEY = 'tonality-diamond-classic-v2';
let saved;
try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* Storage is optional. */ }
const initial = readConfig(location.search, saved);
let config = initial.config;
let numbers = [], pitches = [];
let sustain = false, shift = false, moving = false, sequenceRunning = false;
let noticeTimer;
const pointers = new Map();
const armed = new Map();
const view = new DiamondView($('viewport'), $('stage'), $('diamondWrap'));
view.onZoom = value => { $('zoomPct').textContent = value + '%'; };
const audio = new AudioEngine({
  onChange(keys) {
    view.highlight(keys);
  },
  onStatus(message, error) {
    $('audioBanner').classList.toggle('hidden', !error);
    $('audioBannerMsg').textContent = message;
  }
});
const player = new Player(audio, {
  options: () => ({ wave: config.wave, attack: config.attack, release: config.release }),
  onSequence(active) {
    sequenceRunning = active;
    $('explore').textContent = active ? 'Stop sequence' : 'Play scale';
  }
});


function notice(message) {
  clearTimeout(noticeTimer);
  $('notice').textContent = message; $('notice').hidden = false;
  noticeTimer = setTimeout(() => { $('notice').hidden = true; }, 4000);
}
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch { /* Storage is optional. */ }
  if (new URLSearchParams(location.search).has('diamond')) {
    try { history.replaceState(null, '', shareURL(location.href, config)); } catch { /* Some embeds restrict history. */ }
  }
}
function clearArmed() {
  for (const [tile, state] of armed) { clearTimeout(state.timer); tile.classList.remove('armed'); }
  armed.clear();
}
function stop() {
  player.stop(); pointers.clear(); shift = false; clearArmed(); view.clearFeedback();
}
function syncFields() {
  for (const [id, value] of Object.entries({
    oddLimit: config.limit, primeLimit: config.prime, customNums: config.custom,
    refHz: config.root, wave: config.wave, volume: config.volume,
    attack: config.attack, release: config.release, tempo: config.tempo, axisMode: config.axisMode
  })) $(id).value = value;
  for (const [name, value] of [['mode', config.mode], ['labels', config.labels], ['orient', config.orientation]]) {
    document.querySelectorAll('input[name="' + name + '"]').forEach(r => { r.checked = r.value === value; });
  }
  syncRootField();
  $('folded').checked = config.folded;
  $('volumeValue').textContent = Math.round(config.volume * 100) + '%';
  $('tempoValue').textContent = config.tempo + ' BPM';
  $('tempoControl').hidden = config.axisMode !== 'arpeggio';
  $('limitFields').hidden = config.mode !== 'limit';
  $('customFields').hidden = config.mode !== 'custom';
  $('shapeHint').textContent = config.mode === 'limit' ? 'Odd limits 1–31.' : 'Up to 16 numbers, 1–255. Separate with periods, spaces, commas, or colons.';
  $('shapeError').hidden = true;
}
function render() {
  numbers = numbersFor(config);
  pitches = uniquePitches(numbers, config.folded, config.root);
  view.render(numbers, config);
  for (const button of $('layoutPresets').children) {
    button.setAttribute('aria-pressed', String(button.dataset.layout === config.layout));
  }
  for (const button of $('presets').children) {
    button.setAttribute('aria-pressed', String(config.mode === 'limit' && config.limit === +button.dataset.limit && config.prime === ''));
  }
}
function update(patch, rebuild = true) {
  try {
    const next = validateConfig({ ...config, ...patch });
    if (rebuild) stop();
    config = next; syncFields(); audio.setVolume(config.volume);
    if (rebuild) render();
    persist(); return true;
  } catch (error) {
    $('shapeError').textContent = error.message; $('shapeError').hidden = false; return false;
  }
}
for (const limit of [5, 7, 11, 13, 15]) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'btn ghost small'; button.dataset.limit = limit;
  button.textContent = limit + '-limit'; button.setAttribute('aria-label', limit + '-limit preset');
  button.addEventListener('click', () => update({ mode: 'limit', limit, prime: '' }));
  $('presets').append(button);
}
for (const button of $('layoutPresets').children) {
  button.addEventListener('click', () => update({ layout: button.dataset.layout }));
}
document.querySelectorAll('input[name="mode"]').forEach(r => r.addEventListener('change', () => update({ mode: r.value })));
function applyShape(event) {
  event?.preventDefault();
  update(config.mode === 'limit' ? { limit: Number($('oddLimit').value), prime: $('primeLimit').value } : { custom: $('customNums').value.trim() });
}
$('shapeForm').addEventListener('submit', applyShape);
for (const id of ['oddLimit', 'primeLimit', 'customNums']) $(id).addEventListener('change', applyShape);
$('folded').addEventListener('change', () => update({ folded: $('folded').checked }));
document.querySelectorAll('input[name="labels"]').forEach(r => r.addEventListener('change', () => update({ labels: r.value })));
document.querySelectorAll('input[name="orient"]').forEach(r => r.addEventListener('change', () => {
  config.orientation = r.value; view.vertical = r.value === 'vertical'; view.transform(); persist();
}));
for (const [id, name] of [['attack', 'attack'], ['release', 'release']]) {
  $(id).addEventListener('change', () => {
    if ($(id).reportValidity()) update({ [name]: Number($(id).value) }, false);
  });
}
function sizeRootField() {
  $('refHz').style.width = Math.max(4, $('refHz').value.length + 0.3) + 'ch';
}
function syncRootField() {
  $('refHz').value = config.root.toFixed(2);
  sizeRootField();
}
$('refHz').addEventListener('input', sizeRootField);
$('refHz').addEventListener('click', () => $('refHz').select());
$('refHz').addEventListener('change', () => {
  if (!$('refHz').checkValidity()) {
    syncRootField(); notice('Root frequency must be between 20 and 2000 Hz.'); return;
  }
  update({ root: Number($('refHz').value) });
});
$('refHz').addEventListener('keydown', event => {
  if (event.key === 'Enter') { event.preventDefault(); $('refHz').blur(); }
  if (event.key === 'Escape') { syncRootField(); $('refHz').blur(); }
});
$('wave').addEventListener('change', () => { stop(); update({ wave: $('wave').value }, false); });
$('volume').addEventListener('input', () => {
  config.volume = Number($('volume').value); audio.setVolume(config.volume);
  $('volumeValue').textContent = Math.round(config.volume * 100) + '%'; persist();
});
$('tempo').addEventListener('input', () => {
  config.tempo = Number($('tempo').value); $('tempoValue').textContent = config.tempo + ' BPM';
  player.cancelSequence(); persist();
});
$('axisMode').addEventListener('change', () => {
  player.cancelSequence(); clearArmed(); update({ axisMode: $('axisMode').value }, false);
});
$('panic').addEventListener('click', stop);
$('enableAudio').addEventListener('click', () => { void audio.ensure(); });
$('sustain').addEventListener('click', () => {
  sustain = !sustain; $('sustain').setAttribute('aria-pressed', String(sustain));
  if (!sustain) player.releaseHeld('latch');
  notice(sustain ? 'Sustain on. Tap a held note again to release it.' : 'Sustain off.');
});
$('explore').addEventListener('click', () => { if (sequenceRunning) stop(); else player.sequence(pitches, config.tempo); });
$('resetButton').addEventListener('click', () => {
  sustain = false; $('sustain').setAttribute('aria-pressed', 'false');
  moving = false; $('moveMode').checked = false; $('viewport').classList.remove('moving');
  update({ ...DEFAULTS }); notice('Settings reset.');
});
$('zoomIn').addEventListener('click', () => view.setZoom(view.zoom * 1.15));
$('zoomOut').addEventListener('click', () => view.setZoom(view.zoom / 1.15));
$('fit').addEventListener('click', () => view.fit());
$('moveMode').addEventListener('change', () => {
  stop(); moving = $('moveMode').checked; $('viewport').classList.toggle('moving', moving);
  notice(moving ? 'Move mode: drag to pan or use two fingers to zoom.' : 'Play mode.');
});
$('viewport').addEventListener('wheel', event => {
  if (!event.ctrlKey || event.target.closest('.panel')) return;
  event.preventDefault(); view.setZoom(view.zoom * Math.exp(-event.deltaY * 0.0015));
}, { passive: false });

function kind() { return sustain ? 'latch' : shift ? 'shift' : 'pulse'; }
function playTile(tile, gesture) {
  if (!tile || tile.getAttribute('aria-disabled') === 'true') return;
  const note = view.notes.get(tile);
  if (!note || gesture?.visited.has(note.key)) return;
  gesture?.visited.add(note.key); player.play(note, kind());
}
function playAxis(tile) {
  const notes = view.line(tile);
  if (shift) { player.cancelSequence(); player.chord(notes, 'shift'); return; }
  if (config.axisMode === 'arpeggio') player.sequence(notes, config.tempo);
  else if (config.axisMode === 'tap') {
    const previous = armed.get(tile);
    if (previous) {
      const delay = Math.max(40, Math.min(1200, performance.now() - previous.time));
      clearArmed(); player.sequence(notes, 30000 / delay);
    } else {
      clearArmed(); tile.classList.add('armed');
      const timer = setTimeout(() => { tile.classList.remove('armed'); armed.delete(tile); }, 2000);
      armed.set(tile, { time: performance.now(), timer });
      notice('Tap that edge again to set the arpeggio speed.');
    }
  } else { player.cancelSequence(); player.chord(notes, kind()); }
}
$('viewport').addEventListener('pointerdown', event => {
  if (event.target.closest('.panel, #audioBanner, .notice') || (event.button !== 0 && event.pointerType === 'mouse')) return;
  const tile = event.target.closest('.tile');
  if (!moving && !tile) return;
  event.preventDefault(); shift = event.shiftKey;
  const gesture = { x: event.clientX, y: event.clientY, visited: new Set(), tile };
  pointers.set(event.pointerId, gesture); $('viewport').setPointerCapture(event.pointerId);
  if (moving) return;
  view.press(event.pointerId, tile);
  if (tile?.classList.contains('axis') && !tile.classList.contains('corner')) playAxis(tile);
  else playTile(tile, gesture);
});
$('viewport').addEventListener('pointermove', event => {
  const target = moving ? null : view.tileAt(event.clientX, event.clientY);
  if (event.pointerType !== 'touch') view.hover(target);
  if (pointers.has(event.pointerId) && !moving) view.press(event.pointerId, target);
  const gesture = pointers.get(event.pointerId);
  if (!gesture) return;
  const oldX = gesture.x, oldY = gesture.y, pairBefore = [...pointers.values()];
  const before = pairBefore.length === 2 ? Math.hypot(pairBefore[0].x - pairBefore[1].x, pairBefore[0].y - pairBefore[1].y) : 0;
  gesture.x = event.clientX; gesture.y = event.clientY;
  if (moving) {
    const pair = [...pointers.values()];
    if (pair.length === 2 && before > 0) {
      view.setZoom(view.zoom * Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y) / before);
    } else view.move(view.pan.x + gesture.x - oldX, view.pan.y + gesture.y - oldY);
  } else if (!gesture.tile?.classList.contains('axis')) playTile(view.tileAt(event.clientX, event.clientY), gesture);
});
$('viewport').addEventListener('pointerleave', () => view.hover(null));
const endPointer = event => { pointers.delete(event.pointerId); view.press(event.pointerId, null); };
$('viewport').addEventListener('pointerup', endPointer);
$('viewport').addEventListener('pointercancel', () => stop());
$('viewport').addEventListener('lostpointercapture', endPointer);
$('stage').addEventListener('click', event => {
  if (event.detail !== 0 || moving) return;
  const tile = event.target.closest('.tile');
  if (tile?.classList.contains('axis') && !tile.classList.contains('corner')) playAxis(tile);
  else playTile(tile);
});
$('stage').addEventListener('keyup', event => {
  if (event.key === 'Enter' || event.key === ' ') view.press('keyboard', null);
});
$('stage').addEventListener('focusout', () => view.press('keyboard', null));
$('stage').addEventListener('keydown', event => {
  if (!moving && (event.key === 'Enter' || event.key === ' ')) view.press('keyboard', event.target.closest('.tile'));
  const delta = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[event.key];
  const tile = event.target.closest('.tile');
  if (!delta || !tile) return;
  event.preventDefault();
  $('stage').querySelector('button[data-row="' + (+tile.dataset.row + delta[0]) + '"][data-col="' + (+tile.dataset.col + delta[1]) + '"]')?.focus();
});
const editing = target => target instanceof Element && (target.matches('input, select, textarea') || target.isContentEditable);
window.addEventListener('keydown', event => {
  if (event.key === 'Escape') { stop(); closeCornerMenus(true); return; }
  if (event.key === 'Shift') { shift = true; return; }
  if (editing(event.target) || $('shareDialog').open || event.ctrlKey || event.metaKey || event.altKey) return;
  if (!event.repeat && event.key.toLowerCase() === 'o') {
    config.orientation = config.orientation === 'horizontal' ? 'vertical' : 'horizontal';
    syncFields(); view.vertical = config.orientation === 'vertical'; view.transform(); persist();
  }
});
window.addEventListener('keyup', event => { if (event.key === 'Shift') { shift = false; player.releaseHeld('shift'); } });
window.addEventListener('blur', stop);
document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
window.addEventListener('pagehide', stop);


function selectMenuTab(tab) {
  const tabs = [...document.querySelectorAll('.menu-tabs [role="tab"]')];
  tabs.forEach(button => {
    const selected = button === tab;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    $(button.getAttribute('aria-controls')).hidden = !selected;
  });
  document.querySelector('.menu-body').scrollTop = 0;
}
const menuTabs = [...document.querySelectorAll('.menu-tabs [role="tab"]')];
menuTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectMenuTab(tab));
  tab.addEventListener('keydown', event => {
    const next = event.key === 'ArrowRight' ? (index + 1) % menuTabs.length
      : event.key === 'ArrowLeft' ? (index + menuTabs.length - 1) % menuTabs.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? menuTabs.length - 1 : null;
    if (next === null) return;
    event.preventDefault(); selectMenuTab(menuTabs[next]); menuTabs[next].focus();
  });
});

const cornerMenus = [
  ['menuToggle', 'menuContent', 'menu'],
  ['soundToggle', 'soundContent', 'playbar'],
  ['helpToggle', 'helpContent', 'helpMenu']
];
function closeCornerMenus(returnFocus = false) {
  for (const [toggleId, contentId, panelId] of cornerMenus) {
    if (returnFocus && $(contentId).contains(document.activeElement)) $(toggleId).focus();
    $(toggleId).setAttribute('aria-expanded', 'false');
    const indicator = $(toggleId).querySelector('.btn-collapse');
    if (indicator) indicator.textContent = '+';
    $(contentId).hidden = true;
    $(panelId).classList.add('collapsed');
  }
}
for (const [toggleId, contentId, panelId] of cornerMenus) {
  $(toggleId).addEventListener('click', () => {
    const open = $(contentId).hidden;
    closeCornerMenus();
    if (!open) return;
    $(toggleId).setAttribute('aria-expanded', 'true');
    const indicator = $(toggleId).querySelector('.btn-collapse');
    if (indicator) indicator.textContent = '−';
    $(contentId).hidden = false;
    $(panelId).classList.remove('collapsed');
  });
}
document.addEventListener('pointerdown', event => {
  for (const [, contentId, panelId] of cornerMenus) {
    if (!$(contentId).hidden && !$(panelId).contains(event.target)) { closeCornerMenus(); break; }
  }
});
$('shareButton').addEventListener('click', async () => {
  const link = shareURL(location.href, config);
  try { await navigator.clipboard.writeText(link); notice('Setup link copied.'); }
  catch {
    stop(); $('shareURL').value = link; $('shareDialog').showModal();
    $('shareURL').focus(); $('shareURL').select();
  }
});
$('closeShare').addEventListener('click', () => $('shareDialog').close());
function syncThemeToggle() {
  const label = document.documentElement.dataset.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  $('themeToggle').setAttribute('aria-label', label);
  $('themeToggle').title = label;
}
$('themeToggle').addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('tonality-diamond-theme', theme); } catch { /* Storage is optional. */ }
  syncThemeToggle();
});
syncThemeToggle();
syncFields(); audio.setVolume(config.volume); render();
if (initial.warning) notice(initial.warning);
