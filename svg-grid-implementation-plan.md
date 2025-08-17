# SVG Grid Line Implementation Plan

## Current Problem
In the Tonality Diamond application, horizontal grid lines are currently drawn as CSS pseudo-elements (`::after`) inside each cell. This approach causes misalignments because:

1. Each line is positioned relative to its own cell's bounding box
2. Cell rotations and transforms affect the visual positioning
3. Grid gaps and borders further contribute to misalignment

## Solution: SVG-based Grid Lines
Replace individual CSS-drawn lines with a single SVG overlay containing all grid lines. This ensures perfect alignment since all lines are drawn in a single coordinate system.

## Implementation Steps

### 1. HTML Changes

#### Add SVG Element
```html
<!-- Inside #diamondWrap, before #stage -->
<div id="diamondWrap">
  <svg id="diamondGridLines" style="position:absolute; inset:0; pointer-events:none; z-index:1;"></svg>
  <div id="stage" class="stage"></div>
</div>
```

### 2. CSS Changes

#### Remove Per-Cell Line CSS
Remove or comment out the rule that draws horizontal lines in each cell:

```css
/* Remove this rule */
.tile:not(.axis) .cell::after {
  content:"";
  position:absolute;
  left:-35%; right:-35%;
  top:48%;
  height:0;
  border-top: var(--grid-width) solid var(--grid-color);
  z-index:2;
}
```

### 3. JavaScript Changes

#### Create Grid Line Drawing Function
Add a new function to calculate and draw grid lines in SVG:

```javascript
function drawDiamondGridLines(nums) {
  const N = nums.length;
  if (N < 1) return;
  
  // Get the SVG element (create if not exists)
  let svg = document.getElementById('diamondGridLines');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'diamondGridLines';
    svg.style.position = 'absolute';
    svg.style.inset = '0';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '1';
    document.getElementById('diamondWrap').insertBefore(svg, document.getElementById('stage'));
  }
  
  // Clear previous lines
  svg.innerHTML = '';
  
  // Get CSS values
  const cs = getComputedStyle(document.documentElement);
  const cellSize = parseFloat(cs.getPropertyValue('--cell')) || 32;
  const gap = parseFloat(cs.getPropertyValue('--gap')) || 1;
  const gridColor = cs.getPropertyValue('--grid-color') || '#0b0d10';
  const gridWidth = parseFloat(cs.getPropertyValue('--grid-width')) || 2;
  
  // Calculate grid size
  const gridWidth_px = (N + 1) * cellSize + N * gap;
  const gridHeight_px = gridWidth_px;  // Square grid
  
  // Set SVG size and attributes
  svg.setAttribute('width', gridWidth_px);
  svg.setAttribute('height', gridHeight_px);
  
  // Draw horizontal grid lines
  for (let r = 0; r <= N; r++) {
    const y = r * (cellSize + gap);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', 0);
    line.setAttribute('y1', y);
    line.setAttribute('x2', gridWidth_px);
    line.setAttribute('y2', y);
    line.setAttribute('stroke', gridColor);
    line.setAttribute('stroke-width', gridWidth);
    svg.appendChild(line);
  }
  
  // Draw vertical grid lines
  for (let c = 0; c <= N; c++) {
    const x = c * (cellSize + gap);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x);
    line.setAttribute('y1', 0);
    line.setAttribute('x2', x);
    line.setAttribute('y2', gridHeight_px);
    line.setAttribute('stroke', gridColor);
    line.setAttribute('stroke-width', gridWidth);
    svg.appendChild(line);
  }
}
```

#### Update Render Function
Modify the existing `render()` function to call our grid line drawing function:

```javascript
function render(nums) {
  clearStage(); 
  const N = nums.length; 
  if (N < 1) return; 
  stage.dataset.n = N; 
  stage.style.gridTemplateColumns = `repeat(${N+1}, var(--cell))`;
  stage.style.gridTemplateRows = `repeat(${N+1}, var(--cell))`;

  // ... existing cell creation code ...

  // Draw grid lines using SVG
  drawDiamondGridLines(nums);
  
  fitToViewport();
  attachAxisHandlers();
}
```

### 4. Potential Enhancements

#### SVG Rotation for Diamond Orientation
To maintain the diamond orientation, the SVG grid should be rotated along with the stage:

```javascript
function applyTransform() {
  // Update wrap transform as before
  wrap.style.transform = `translate(-50%,-50%) rotate(var(--wrap-rot)) scale(${(baseScale*userZoom).toFixed(5)})`;
  
  // Update SVG position if needed
  const svg = document.getElementById('diamondGridLines');
  if (svg) {
    // Ensure SVG stays aligned with the grid
    svg.style.transform = `rotate(0deg)`;  // SVG stays unrotated relative to the wrap
  }
  
  const zoomPct = Math.round(userZoom*100);
  document.getElementById('zoomPct').textContent = zoomPct+"%";
}
```

#### Support for Different Grid Types
The function can be extended to support different grid types (square, diamond, etc.) by adding a parameter:

```javascript
function drawDiamondGridLines(nums, gridType = 'square') {
  // ... existing code ...
  
  if (gridType === 'diamond') {
    // Draw diagonal lines for diamond grid
    // ...
  }
}
```

## Testing

1. First test with a small grid (e.g., oddLimit=5)
2. Verify that horizontal lines are perfectly aligned
3. Test with larger grids to ensure performance
4. Check different orientations (horizontal/vertical)
5. Verify grid lines update correctly when zooming

## Benefits

1. Perfect alignment of all grid lines
2. Simpler CSS (no pseudo-element hacks)
3. Better separation of concerns (layout vs. decoration)
4. More control over grid line appearance
5. Potential for animation or advanced styling of grid lines

## Potential Challenges

1. SVG needs to be properly positioned and sized relative to the grid
2. Rotation and scaling need to be coordinated between grid and SVG
3. Performance may be an issue for very large grids (many SVG elements)
