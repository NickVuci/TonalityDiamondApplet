# Tonality Diamond Applet

An interactive just-intonation diamond, served as static HTML, CSS, and JavaScript.

Production: https://tonalitydiamondapplet.nickvuci.com/

## Run locally

With Node.js 22 or newer:

```sh
npm ci
npm start
```

Open http://127.0.0.1:4173/. There is no application build step or runtime dependency.
Any static HTTP server also works. ES modules require HTTP rather than opening the HTML file directly.

## Play

- Click, tap, or drag across tiles. Several fingers can play at once.
- Hold Shift to sustain notes until Shift is released. The Sustain button works without a keyboard; tap a held pitch again to release it.
- Click an edge number for its whole row or column. Advanced sound options offers chords, arpeggios, and the original two-click tap-timing behavior.
- Click the root frequency above Advanced sound options to type a new value (20–2000 Hz). Enter or leaving the field applies it; Escape cancels. The root stays fixed when hovering or playing tiles.
- Play scale plays the distinct pitches in ascending order. Stop all or Escape cancels notes, pending audio starts, release tails, and queued sequences.
- Focus a tile and press Enter or Space to play it. Arrow keys navigate rows and columns; O rotates the diamond. Input fields do not trigger shortcuts.
- Enable Move / pinch to zoom to pan or pinch without playing notes. Ctrl + scroll and the zoom buttons also work. Fit recentres the view.

The original light canvas, prime-based colours, and joined split ratio tiles are retained, without an added pressed border. Hovering shades a cell gently. Pressing lights up its coloured fill with a 50% white overlay; equivalent sounding ratios light up at one-quarter of that intensity (12.5%). Sounding pitches also receive the softer light. Labels and black dividers remain crisp. Feedback supports dragging, touch, and keyboard activation, and clears on release, cancellation, or losing window focus. The playable diamond is centred on its own geometry. Note cells meet edge-to-edge on a single 33px grid. SVG triangle fills and shared strokes use identical coordinates, so colours meet exactly beneath the horizontal dividers. Those dividers remain half the border thickness. Chord-strip outlines and separators also use the same lattice instead of overlapping CSS borders. Thin row/column chord buttons connect into strips beside it with a narrow gap; there is no empty corner cell. Compact text controls in the top-left select odd-limit and layout presets without reserving space in the canvas. Advanced diamond options contains Diamond and View tabs. Sound controls sit at top-right, with volume and playback always visible. Xen Wiki, XA community icons, and the return link sit at bottom-left. A question-mark Help icon sits above a sun/moon toggle, which aligns over the blue-and-gold NV logo at bottom-right; GitHub sits directly above the NV logo. The two XA icons are slightly larger than the Xen Wiki icon. Dropdowns open inward from their fixed corners. The supplied gold Xen image identifies the wiki; platform-badged variants identify the XA communities. Interface text uses a consistent 16px size, with wrapping controls and scrollable dropdowns on narrow screens. Fit includes the thin chord strips and clears the visible corner controls without offsetting the playable diamond; opening settings does not move or shrink it. Opening another dropdown closes the previous one; clicking outside or pressing Escape dismisses it. Escape still stops sound.
Row labels show the original numbers. Sounding ratio labels show the reduced audible ratio. Octave reduction is a separate setting so a label change does not retune the instrument.

The three axis layouts are Numerical (1, 3, 5, 7, 9, 11), Tonal (1, 9, 5, 11, 3, 7), and Chordal (1, 5, 3, 7, 9, 11) at the 11-odd limit. Tonal sorts octave-reduced pitches. Chordal raises harmonics below 4 by octaves for ordering, then continues with higher harmonics in ascending order. Layout changes reorder the axes without changing pitches.

The default Warm voice uses a fundamental-led harmonic spectrum, a non-resonant low-pass filter, reduced high-note level, a 60ms attack, and a 900ms exponential release. Tuning stays exact without detuning or chorus. Chord gain accounts for release tails and reduces buildup as polyphony rises. The original oscillator choices remain under Advanced sound options. Saved setups using the previous unchanged triangle/5ms/250ms default upgrade to Warm; explicitly edited sounds and shared setups keep their selections.

Settings are saved locally. Copy setup link shares musical settings without starting playback. The sun/moon icon below Help switches between light and dark mode. Dark mode is the default; a saved choice takes precedence and is kept separately from musical settings and shared links.
Inputs are limited to 16 numbers from 1–255, or odd limits up to 31, to keep rendering responsive. Unfolded pitches outside 20–16000 Hz are visibly disabled.

## Test

```sh
npm test
npm run test:browser
```

Unit tests use Node's built-in runner. Browser tests use Playwright and installed Google Chrome
(`channel: 'chrome'` in `playwright.config.js`). They check presets, validation, persistence,
sustain, cancellation, keyboard access, mobile touch dragging, simultaneous fingers, and panel behavior.
Browser tests launch a local server automatically if one is not already running.

## Code

- `js/index.js`: controls, gestures, and application state.
- `js/theme.js`: apply the saved theme or default dark mode before the page paints.
- `js/modules/grid.js`: the original diamond rendering, colours, and viewport transforms.
- `js/modules/audio.js`: audio initialization and independently cancellable note voices.
- `js/modules/player.js`: sustain, chords, and cancellable arpeggios.
- `js/modules/math.js`: bounded integer ratios and pitch calculations.
- `js/modules/config.js`: validated settings and share links.

## Artwork

The Xen Wiki link uses the user-supplied gold PNG, stored unchanged as `assets/xen-wiki.png` and displayed as a circular badge. The custom XA Discord and Facebook icons in `assets/` combine the user-supplied `TheXen.svg` artwork with small platform badges. They remain vectors and inherit the link colour. The original supplied file is unchanged. `assets/nv-mark.svg` is the blue-and-gold light-background monogram from [NickVuci/Directory](https://github.com/NickVuci/Directory/blob/main/assets/nv-mark.svg), copied without altering its artwork (source blob `3768bc91e1d0f1d6cffed264aaff69c4c1455ad7`).

## Deployment

GitHub Pages serves the static files directly. Keep `CNAME` at the publishing root with
`tonalitydiamondapplet.nickvuci.com`. The GitHub Pages custom-domain setting must also remain configured.
This change does not move the domain or modify Pages settings.
