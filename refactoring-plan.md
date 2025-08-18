# Refactoring Plan for Tonality Diamond Applet

## Overview

The current `index.js` file (approximately 1100+ lines) combines multiple responsibilities into a single monolithic file. This makes the code harder to maintain, understand, and extend. Breaking it down into smaller, more focused modules would improve code organization and maintainability.

## Proposed Module Structure

Here's a proposed structure with modules ranked by refactoring value:

```
js/
├── index.js           # Main entry point (bootstrapping)
├── modules/
│   ├── audio.js       # Audio engine functionality
│   ├── grid.js        # Grid generation and rendering
│   ├── interaction.js # User interaction handling
│   ├── math.js        # Mathematical utilities
│   ├── ui.js          # UI controls and panel management
│   └── visualization.js # Coloring and visual representation
```

## Cost-Benefit Analysis of Refactors

### 1. Audio Engine Module (HIGH VALUE)
**File:** `modules/audio.js`

**Content:**
- AudioContext setup and management
- Sound generation functions (noteOn, noteOff)
- Audio banner management
- Audio state management

**Benefits:**
- Isolates complex audio API interactions
- Simplifies testing of audio features independently
- Makes it easier to extend with new audio capabilities
- Clearer separation between audio logic and visualization

**Cost:**
- Medium: Requires careful extraction of audio state and functions
- Audio context and state management needs proper handling

**Estimated time:** 1-2 hours

---

### 2. Mathematical Utilities (HIGH VALUE)
**File:** `modules/math.js`

**Content:**
- GCD calculation
- Prime number calculations
- Ratio normalization
- Frequency conversion

**Benefits:**
- Creates a reusable library of math functions
- Simplifies testing of mathematical logic
- Makes the main code more readable by removing complex calculations
- Could be reused in other music theory projects

**Cost:**
- Low: Math functions are already well-encapsulated
- Minimal dependencies on other parts of the code

**Estimated time:** 30-45 minutes

---

### 3. Grid Generation and Rendering (HIGH VALUE)
**File:** `modules/grid.js`

**Content:**
- Grid building logic
- Cell rendering
- Label generation
- Grid sizing and layout

**Benefits:**
- Separates core grid generation from UI and interaction
- Makes it easier to modify grid layout without affecting other features
- Improves code organization for the central feature of the application

**Cost:**
- Medium-High: Contains core application logic with many dependencies
- Requires careful handling of DOM manipulation and event binding

**Estimated time:** 2-3 hours

---

### 4. User Interaction (MEDIUM VALUE)
**File:** `modules/interaction.js`

**Content:**
- Drag-to-play functionality
- Shift-sustain behavior
- Axis handlers (click and chord playing)
- Touch and pointer event handling

**Benefits:**
- Separates interaction logic from rendering
- Makes it easier to add new interaction modes
- Improves testability of interaction behaviors

**Cost:**
- Medium: Complex event handling with dependencies on both grid and audio modules
- Requires careful coordination with DOM elements

**Estimated time:** 1-2 hours

---

### 5. Visualization (MEDIUM VALUE)
**File:** `modules/visualization.js`

**Content:**
- Color mapping logic
- Prime hue mapping
- Visual styling functions

**Benefits:**
- Centralizes visual representation code
- Makes it easier to update or enhance visualization aspects
- Separates color logic from structural grid logic

**Cost:**
- Low-Medium: Mostly self-contained functions
- Some dependencies on math utilities

**Estimated time:** 1 hour

---

### 6. UI Controls and Panel Management (MEDIUM VALUE)
**File:** `modules/ui.js`

**Content:**
- Panel collapse/expand functionality
- Zoom controls
- Orientation switching
- Mode switching
- Build controls

**Benefits:**
- Isolates UI-specific code
- Makes it easier to add new controls or panels
- Improves separation between UI and core functionality

**Cost:**
- Medium: Spread throughout the codebase
- Many interconnections with other modules

**Estimated time:** 1-2 hours

---

## Implementation Strategy

1. **Create module structure** - Set up the directory structure and empty module files
2. **Extract math utilities first** - These have the fewest dependencies
3. **Extract audio engine** - Isolate the audio functionality
4. **Extract visualization** - Move color mapping and visual functions
5. **Extract grid generation** - Move core grid functionality
6. **Extract interaction handling** - Move user interaction code
7. **Extract UI controls** - Move panel and control functionality
8. **Update main index.js** - Convert to import modules and initialize them

## Risks and Mitigations

**Risk:** Breaking functionality during refactoring
**Mitigation:** Implement and test one module at a time, verify functionality after each step

**Risk:** Circular dependencies between modules
**Mitigation:** Use careful dependency management, possibly implement a simple event system for cross-module communication

**Risk:** Global state management becomes complex
**Mitigation:** Consider using a simple state management pattern or explicit dependency injection

## Total Estimated Effort

- **Total estimated time:** 7-11 hours
- **Testing time:** 2-3 hours
- **Total:** 9-14 hours

## Next Steps

1. Approve or adjust this refactoring plan
2. Implement the modules in the order suggested above
3. Test thoroughly after each module extraction
4. Consider adding automated tests to ensure functionality remains intact

Please review this plan and provide feedback before proceeding with implementation.
