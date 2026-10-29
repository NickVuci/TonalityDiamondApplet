import { pitch, largestPrimeFactor, clamp } from './math.js';

const STRIDE = 33, NOTE_SIZE = STRIDE, GRID_WIDTH = 2, AXIS_THICKNESS = 12, AXIS_GAP = 1;
const AXIS_LENGTH = STRIDE + 1; // Adjacent chord cells share a one-pixel border.
const AXIS_INSET = (NOTE_SIZE - AXIS_LENGTH) / 2;
const svgElement = name => document.createElementNS('http://www.w3.org/2000/svg', name);

/** Joined playable tiles centred independently of the thin chord strips. */
export class DiamondView {
  constructor(viewport, stage, wrap) {
    this.viewport = viewport; this.stage = stage; this.wrap = wrap;
    this.notes = new WeakMap();
    this.zoom = 1; this.pan = { x: 0, y: 0 }; this.vertical = false; this.count = 3;
    this.hovered = null;
    this.pressed = new Map();
    this.onZoom = () => {};
    this.observer = new ResizeObserver(() => this.transform());
    this.observer.observe(viewport);
    this.controls = [...viewport.querySelectorAll(':scope > .panel')];
    this.controls.forEach(control => this.observer.observe(control));
  }
  render(numbers, config) {
    this.hovered = null;
    this.pressed.clear();
    this.stage.replaceChildren();
    this.notes = new WeakMap();
    this.count = numbers.length;
    // Shared edges sit exactly on the cell lattice; no overlapping button boxes.
    const size = (this.count - 1) * STRIDE + NOTE_SIZE;
    this.stage.style.setProperty('--note-size', STRIDE + 'px');
    this.stage.style.setProperty('--axis-length', AXIS_LENGTH + 'px');
    this.stage.style.setProperty('--axis-thickness', AXIS_THICKNESS + 'px');
    this.stage.style.width = size + 'px';
    this.stage.style.height = size + 'px';
    this.stage.style.gridTemplateColumns = 'repeat(' + this.count + ', ' + STRIDE + 'px)';
    this.stage.style.gridTemplateRows = 'repeat(' + this.count + ', ' + STRIDE + 'px)';
    this.vertical = config.orientation === 'vertical';
    // Fills and line work share one lattice. Scaled CSS gradients can round
    // their midpoints independently of SVG strokes.
    this.fills = svgElement('svg');
    this.fills.classList.add('diamond-fills');
    this.fills.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    this.fills.setAttribute('aria-hidden', 'true');
    this.stage.append(this.fills);
    this.noteFills = [];
    const primes = [...new Set(numbers.map(largestPrimeFactor))].filter(p => p > 1).sort((a, b) => a - b);
    const color = (n, axis = false) => {
      if (n === 1) return '#f2f4f8';
      const prime = largestPrimeFactor(n);
      const hue = (17 + primes.indexOf(prime) * 360 / Math.max(1, primes.length)) % 360;
      const saturation = Math.max(28, 75 * Math.pow(0.85, Math.max(1, Math.round(n / prime)) - 1));
      return 'hsl(' + hue + ' ' + saturation + '% ' + (axis ? 82 : 60) + '%)';
    };
    const append = (className, label, row, col) => {
      const tile = document.createElement('button');
      tile.className = 'tile ' + className;
      tile.dataset.row = row; tile.dataset.col = col;
      if (className === 'axis') {
        tile.style.left = (col === 0 ? -AXIS_THICKNESS - AXIS_GAP : (col - 1) * STRIDE + AXIS_INSET) + 'px';
        tile.style.top = (row === 0 ? -AXIS_THICKNESS - AXIS_GAP : (row - 1) * STRIDE + AXIS_INSET) + 'px';
      } else {
        tile.style.gridRow = row;
        tile.style.gridColumn = col;
      }
      const cell = document.createElement('span'); cell.className = 'cell';
      const text = document.createElement('span'); text.className = 'label'; text.textContent = label;
      if (className === 'axis' && String(label).length > 2) text.style.fontSize = '6px';
      cell.append(text); tile.append(cell); this.stage.append(tile);
      return tile;
    };
    numbers.forEach((n, j) => {
      const tile = append('axis', n, 0, j + 1);
      tile.dataset.axis = 'column'; tile.dataset.value = n;
      this.axisFill(j * STRIDE, -AXIS_THICKNESS - AXIS_GAP + 0.5, STRIDE, AXIS_THICKNESS - 1, color(n, true));
      tile.setAttribute('aria-label', 'Play column ' + n);
    });
    numbers.forEach((d, i) => {
      const axis = append('axis', d, i + 1, 0);
      axis.dataset.axis = 'row'; axis.dataset.value = d;
      this.axisFill(-AXIS_THICKNESS - AXIS_GAP + 0.5, i * STRIDE, AXIS_THICKNESS - 1, STRIDE, color(d, true));
      axis.setAttribute('aria-label', 'Play row ' + d);
      numbers.forEach((n, j) => {
        const note = pitch(n, d, config.folded, config.root);
        const label = config.labels === 'source' ? [n, d] : [note.num, note.den];
        const tile = append('note', '', i + 1, j + 1);
        const frac = document.createElement('span'); frac.className = 'frac';
        const numerator = document.createElement('span'); numerator.className = 'n';
        const denominator = document.createElement('span'); denominator.className = 'd';
        numerator.textContent = label[0]; denominator.textContent = label[1];
        frac.append(numerator, denominator); tile.querySelector('.label').append(frac);
        tile.dataset.note = note.key; tile.dataset.numerator = n; tile.dataset.denominator = d;
        const unavailable = note.frequency < 20 || note.frequency > 16000;
        const upper = svgElement('path'), lower = svgElement('path');
        upper.setAttribute('fill', color(n)); lower.setAttribute('fill', color(d));
        if (unavailable) { upper.setAttribute('opacity', '.4'); lower.setAttribute('opacity', '.4'); }
        this.fills.append(upper, lower);
        this.noteFills.push({ x: j * STRIDE, y: i * STRIDE, upper, lower });
        tile.setAttribute('aria-disabled', String(unavailable));
        const description = 'Ratio ' + note.key + ', ' + note.frequency.toFixed(2) + ' hertz' + (unavailable ? ', outside playable range' : '');
        tile.setAttribute('aria-label', description); tile.title = description;
        this.notes.set(tile, note);
      });
    });
    this.dividers?.remove();
    this.dividers = svgElement('svg');
    this.dividers.classList.add('ratio-dividers');
    this.dividers.setAttribute('aria-hidden', 'true');
    this.dividerPath = svgElement('path');
    this.dividers.append(this.dividerPath);
    this.gridPath = svgElement('path');
    this.gridPath.classList.add('grid-borders');
    this.dividerPath.classList.add('cell-dividers');
    this.dividers.append(this.gridPath);
    this.axisPath = svgElement('path');
    this.axisPath.classList.add('axis-borders');
    this.dividers.append(this.axisPath);
    this.stage.append(this.dividers);
    this.fit();
  }
  fit() { this.zoom = 1; this.pan = { x: 0, y: 0 }; this.transform(); }
  axisFill(x, y, width, height, color) {
    const rect = svgElement('rect');
    for (const [key, value] of Object.entries({ x, y, width, height, fill: color })) rect.setAttribute(key, value);
    this.fills.append(rect);
  }
  alignArtwork() {
    if (!this.dividerPath) return;
    const size = this.count * STRIDE;
    this.dividers.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    this.gridPath.setAttribute('stroke-width', GRID_WIDTH);
    this.dividerPath.setAttribute('stroke-width', GRID_WIDTH / 2);
    for (const { x, y, upper, lower } of this.noteFills) {
      const right = x + STRIDE, bottom = y + STRIDE;
      upper.setAttribute('d', this.vertical ? 'M'+x+','+y+'H'+right+'L'+x+','+bottom+'Z' : 'M'+x+','+y+'H'+right+'V'+bottom+'Z');
      lower.setAttribute('d', this.vertical ? 'M'+right+','+y+'V'+bottom+'H'+x+'Z' : 'M'+x+','+y+'L'+right+','+bottom+'H'+x+'Z');
    }
    // Draw each strip edge once. Shared separator centres align with note edges.
    const outer = -AXIS_THICKNESS - AXIS_GAP + 0.5, inner = -AXIS_GAP - 0.5;
    const axes = ['M0,'+outer+'H'+size+'V'+inner+'H0Z', 'M'+outer+',0H'+inner+'V'+size+'H'+outer+'Z'];
    for (let i = 1; i < this.count; i++) {
      const p = i * STRIDE;
      axes.push('M'+p+','+outer+'V'+inner, 'M'+outer+','+p+'H'+inner);
    }
    this.axisPath.setAttribute('d', axes.join(' '));
    // All fills, shared borders, and ratio dividers use this exact lattice.
    const borders = ['M0,0H' + size + 'V' + size + 'H0Z'];
    for (let i = 1; i < this.count; i++) {
      const p = i * STRIDE;
      borders.push('M' + p + ',0V' + size, 'M0,' + p + 'H' + size);
    }
    this.gridPath.setAttribute('d', borders.join(' '));
    const lines = [];
    for (let k = 1 - this.count; k < this.count; k++) {
      if (this.vertical) {
        const sum = (k + this.count) * STRIDE;
        const start = Math.max(0, sum - size), end = Math.min(size, sum);
        lines.push('M' + start + ',' + (sum - start) + 'L' + end + ',' + (sum - end));
      } else {
        const offset = k * STRIDE;
        const start = Math.max(0, -offset), end = Math.min(size, size - offset);
        lines.push('M' + start + ',' + (start + offset) + 'L' + end + ',' + (end + offset));
      }
    }
    this.dividerPath.setAttribute('d', lines.join(' '));
  }
  transform() {
    const size = (this.count - 1) * STRIDE + NOTE_SIZE;
    // Fit the chord strips too, while keeping the active square's centre fixed.
    const footprint = size + AXIS_THICKNESS + AXIS_GAP - AXIS_INSET;
    const insets = getComputedStyle(this.viewport);
    // getBoundingClientRect includes browser/CSS zoom; layout dimensions do not.
    const viewportBox = this.viewport.getBoundingClientRect();
    const scaleX = viewportBox.width / this.viewport.clientWidth, scaleY = viewportBox.height / this.viewport.clientHeight;
    const layoutBounds = node => {
      const box = node.getBoundingClientRect();
      return { left: (box.left - viewportBox.left) / scaleX, right: (box.right - viewportBox.left) / scaleX,
        top: (box.top - viewportBox.top) / scaleY, bottom: (box.bottom - viewportBox.top) / scaleY };
    };
    const safe = { top: parseFloat(insets.paddingTop), right: parseFloat(insets.paddingRight), bottom: parseFloat(insets.paddingBottom), left: parseFloat(insets.paddingLeft) };
    const left = Math.max(12, safe.left), right = this.viewport.clientWidth - Math.max(12, safe.right);
    const top = Math.max(12, safe.top), bottom = this.viewport.clientHeight - Math.max(12, safe.bottom);
    let availableScale = Math.min(right - left, bottom - top) / (footprint * Math.SQRT2);
    const centreX = (left + right) / 2, centreY = (top + bottom) / 2;
    // Keep enlarged corner controls clear of the instrument, including its chord strips.
    const reach = (size + 2 * (AXIS_THICKNESS + AXIS_GAP)) / Math.SQRT2;
    for (const control of this.controls) {
      const bounds = layoutBounds(control);
      const popup = control.querySelector(':scope > .corner-popup');
      if (popup) {
        const room = control.id !== 'helpMenu' ? this.viewport.clientHeight - safe.bottom - bounds.bottom : bounds.top - safe.top;
        popup.style.maxHeight = Math.max(32, room - 6) + 'px';
      }
      const targets = control.querySelectorAll('button, input, select, a, label, .quick-heading, output');
      for (const target of targets) {
        if (target.closest('.corner-popup') || !target.getClientRects().length) continue;
        const box = layoutBounds(target);
        const dx = Math.max(box.left - centreX, centreX - box.right, 0);
        const dy = Math.max(box.top - centreY, centreY - box.bottom, 0);
        availableScale = Math.min(availableScale, Math.max(1, dx + dy - 12) / reach);
      }
    }
    const base = clamp(availableScale, 0.1, 20);
    this.wrap.style.left = (left + right) / 2 + 'px';
    this.wrap.style.top = (top + bottom) / 2 + 'px';
    this.wrap.style.setProperty('--label-rot', this.vertical ? '-45deg' : '45deg');
    this.wrap.style.transform = 'translate(calc(-50% + ' + this.pan.x + 'px), calc(-50% + ' + this.pan.y + 'px)) rotate(' + (this.vertical ? 45 : -45) + 'deg) scale(' + base * this.zoom + ')';
    this.alignArtwork();
    this.onZoom(Math.round(this.zoom * 100));
  }
  setZoom(value) { this.zoom = clamp(value, 0.5, 4); this.transform(); }
  move(x, y) {
    this.pan = { x: clamp(x, -this.viewport.clientWidth, this.viewport.clientWidth), y: clamp(y, -this.viewport.clientHeight, this.viewport.clientHeight) };
    this.transform();
  }
  tileAt(x, y) {
    const tile = document.elementFromPoint(x, y)?.closest('.tile');
    return tile && this.stage.contains(tile) ? tile : null;
  }
  line(axis) {
    const attribute = axis.dataset.axis === 'row' ? 'denominator' : 'numerator';
    return [...this.stage.querySelectorAll('.note')].filter(t => t.dataset[attribute] === axis.dataset.value).map(t => this.notes.get(t));
  }
  hover(tile) {
    if (this.hovered === tile) return;
    this.hovered = tile;
    this.feedback();
  }
  press(id, tile) {
    if (tile) this.pressed.set(id, tile); else this.pressed.delete(id);
    this.feedback();
  }
  clearFeedback() {
    this.hovered = null;
    this.pressed.clear();
    this.feedback();
  }
  feedback() {
    const active = new Set(this.pressed.values());
    const keys = new Set([this.hovered, ...active].filter(Boolean).map(t => t.dataset.note).filter(Boolean));
    const pressedKeys = new Set([...active].map(t => t.dataset.note).filter(Boolean));
    this.stage.querySelectorAll('.tile').forEach(tile => {
      tile.classList.toggle('hovered', tile === this.hovered);
      tile.classList.toggle('pressed', active.has(tile));
      tile.classList.toggle('related', keys.has(tile.dataset.note));
      tile.classList.toggle('pressed-related', pressedKeys.has(tile.dataset.note));
    });
  }
  highlight(keys) {
    this.stage.querySelectorAll('.note').forEach(t => t.classList.toggle('play', keys.has(t.dataset.note)));
  }
}
