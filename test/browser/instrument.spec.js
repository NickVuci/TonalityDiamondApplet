import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.note')).toHaveCount(9);
});
test('presets, bounded custom input, independent labels, and saved settings', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.getByRole('button', { name: 'Custom', exact: true }).click();
  await page.getByRole('button', { name: '11-limit preset' }).click();
  await expect(page.locator('.note')).toHaveCount(36);
  await page.getByRole('radio', { name: 'Custom', exact: true }).check();
  await page.getByLabel('Numbers (any order)').fill('4.5.6.7');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.locator('.note')).toHaveCount(16);
  await page.getByLabel('Numbers (any order)').fill('0.99999999');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.locator('#shapeError')).toBeVisible();
  await expect(page.locator('.note')).toHaveCount(16);
  const before = await page.locator('.note').evaluateAll(nodes => nodes.map(n => n.dataset.note));
  await page.getByRole('radio', { name: 'Sounding ratio' }).check();
  expect(await page.locator('.note').evaluateAll(nodes => nodes.map(n => n.dataset.note))).toEqual(before);
  await page.reload();
  await expect(page.locator('.note')).toHaveCount(16);
  await page.getByRole('button', { name: 'Custom', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Sounding ratio' })).toBeChecked();
  expect(errors).toEqual([]);
});
test('sustain toggles, grid replacement releases voices, and Escape cancels sequences', async ({ page }) => {
  await page.getByRole('button', { name: 'Sustain', exact: true }).click();
  const note = page.locator('.note[data-note="3/1"]').first();
  await note.click(); await expect(note).toHaveClass(/play/);
  await note.click(); await expect(page.locator('.note.play')).toHaveCount(0);
  await note.click();
  await page.getByRole('button', { name: 'Custom', exact: true }).click();
  await page.getByRole('button', { name: '7-limit preset' }).click();
  await expect(page.locator('.note.play')).toHaveCount(0);
  await page.getByRole('button', { name: 'Custom', exact: true }).click();
  await page.getByRole('button', { name: 'Play scale', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  await expect(page.locator('.note.play')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Play scale', exact: true })).toBeVisible();
});
test('edge chords, arpeggios, and keyboard tile activation work', async ({ page }) => {
  await page.getByRole('button', { name: 'Sustain', exact: true }).click();
  await page.getByRole('button', { name: 'Play row 3', exact: true }).click();
  await expect.poll(() => page.locator('.note.play').evaluateAll(nodes => new Set(nodes.map(n => n.dataset.note)).size)).toBe(3);
  await page.getByRole('button', { name: 'Stop all', exact: true }).click();
  await expect(page.locator('.note.play')).toHaveCount(0);
  const tile = page.locator('.note[data-note="5/3"]');
  await tile.focus(); await page.keyboard.press('Enter');
  await expect(tile).toHaveClass(/play/);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Advanced sound options', exact: true }).click();
  await page.getByLabel('Play a row or column as').selectOption('arpeggio');
  await page.getByRole('button', { name: 'Advanced sound options', exact: true }).click();
  await page.getByRole('button', { name: 'Play column 5', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop sequence' })).toBeVisible();
  await page.getByRole('button', { name: 'Stop sequence' }).click();
  await page.waitForTimeout(1000);
  await expect(page.locator('.note.play')).toHaveCount(0);
});
test('editing a field does not rotate the diamond and invalid links recover', async ({ page }) => {
  await page.getByRole('button', { name: 'Custom', exact: true }).click();
  await page.getByRole('radio', { name: 'Custom', exact: true }).check();
  await page.getByLabel('Numbers (any order)').press('o');
  await expect(page.locator('#diamondWrap')).toHaveCSS('--label-rot', '45deg');
  await page.goto('/?diamond=%7Bbad');
  await expect(page.locator('.note')).toHaveCount(9);
  await expect(page.locator('#notice')).toContainText('could not be loaded');
});
test('phone touch drag, two fingers, panel scrolling, and default dark canvas', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('#viewport')).toHaveCSS('background-color', 'rgb(23, 26, 32)');
  await page.getByRole('button', { name: 'Sustain', exact: true }).tap();
  const notes = page.locator('.note');
  const first = await notes.nth(1).boundingBox(), second = await notes.nth(2).boundingBox();
  const cdp = await context.newCDPSession(page);
  const point = (box, id) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2, id });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(first, 1)] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(second, 1)] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => page.locator('.note.play').evaluateAll(nodes => new Set(nodes.map(n => n.dataset.note)).size)).toBe(2);
  await page.getByRole('button', { name: 'Stop all', exact: true }).tap();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(first, 1), point(second, 2)] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => page.locator('.note.play').evaluateAll(nodes => new Set(nodes.map(n => n.dataset.note)).size)).toBe(2);
  await page.getByRole('button', { name: 'Custom', exact: true }).tap();
  await expect(page.getByLabel('Odd limit', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Help', exact: true }).tap();
  await expect(page.locator('#settings-help')).toBeVisible();
  await page.getByRole('button', { name: 'Help', exact: true }).tap();
  await expect(page.locator('#menuContent')).toBeHidden();
  await expect(page.getByRole('combobox', { name: 'Odd limit preset', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.close();
});

test('move mode, fit, reset, and Shift sustain leave no stuck interaction state', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.getByRole('button', { name: 'Custom', exact: true }).click();
  await page.getByRole('tab', { name: 'View', exact: true }).click();
  await page.getByLabel('Move / pinch to zoom').check();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(page.locator('#zoomPct')).toHaveText('115%');
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  await expect(page.locator('#zoomPct')).toHaveText('100%');
  await page.getByRole('button', { name: 'Reset settings', exact: true }).click();
  await expect(page.getByLabel('Move / pinch to zoom')).not.toBeChecked();
  await page.getByRole('button', { name: 'Custom', exact: true }).click();
  await page.keyboard.down('Shift');
  await page.getByRole('button', { name: 'Play row 3', exact: true }).click({ modifiers: ['Shift'] });
  await expect.poll(() => page.locator('.note.play').evaluateAll(nodes => new Set(nodes.map(n => n.dataset.note)).size)).toBe(3);
  await page.keyboard.up('Shift');
  await expect(page.locator('.note.play')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('diamond cells share exact edges without overlaps, gaps, or added pressed borders', async ({ page }) => {
  const geometry = await page.locator('.note').first().evaluate(tile => {
    const next = tile.nextElementSibling;
    const below = document.querySelector('.note[data-row="2"][data-col="1"]');
    return {
      width: getComputedStyle(tile).width,
      horizontalOverlap: tile.offsetLeft + tile.offsetWidth - next.offsetLeft,
      verticalOverlap: tile.offsetTop + tile.offsetHeight - below.offsetTop
    };
  });
  expect(geometry.width).toBe('33px');
  expect(geometry.horizontalOverlap).toBe(0);
  expect(geometry.verticalOverlap).toBe(0);
  await page.getByRole('button', { name: 'Sustain', exact: true }).click();
  const tile = page.locator('.note[data-note="3/1"]');
  await tile.click();
  await expect(tile).toHaveClass(/play/);
  await expect(tile).toHaveCSS('box-shadow', 'none');
  await expect(tile).toHaveCSS('outline-style', 'none');
  await expect(tile.locator('.cell')).toHaveCSS('filter', 'none');
  expect(await tile.evaluate(node => getComputedStyle(node, '::after').pointerEvents)).toBe('none');
});
test('diamond tabs and separate sound/help disclosures support keyboard navigation', async ({ page }) => {
  const diamond = page.getByRole('button', { name: 'Custom', exact: true });
  const sound = page.getByRole('button', { name: 'Advanced sound options', exact: true });
  const help = page.getByRole('button', { name: 'Help', exact: true });
  await diamond.click();
  await expect(page.getByRole('tabpanel', { name: 'Diamond', exact: true })).toBeVisible();
  await expect(page.getByLabel('Wave', { exact: true })).toBeHidden();
  await page.getByRole('tab', { name: 'Diamond', exact: true }).press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'View', exact: true })).toBeFocused();
  await expect(page.getByLabel('Move / pinch to zoom')).toBeVisible();
  await sound.click();
  await expect(diamond).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByLabel('Wave', { exact: true })).toBeVisible();
  await expect(page.locator('#tempoControl')).toBeHidden();
  await page.getByLabel('Play a row or column as').selectOption('arpeggio');
  await expect(page.locator('#tempoControl')).toBeVisible();
  await help.click();
  await expect(sound).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#settings-help')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(help).toHaveAttribute('aria-expanded', 'false');
  await sound.click();
  await page.getByLabel('Wave', { exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(sound).toBeFocused();
  await expect(page.getByLabel('Wave', { exact: true })).toBeHidden();
});

test('limit and layout presets stay visible above closed Advanced options and reorder both axes', async ({ page }) => {
  await expect(page.locator('#menuContent')).toBeHidden();
  await expect(page.getByRole('button', { name: '11-limit preset' })).toBeVisible();
  await page.getByRole('button', { name: '11-limit preset' }).click();
  const columns = () => page.locator('.axis[data-axis="column"]').evaluateAll(nodes => nodes.map(n => +n.dataset.value));
  const rows = () => page.locator('.axis[data-axis="row"]').evaluateAll(nodes => nodes.map(n => +n.dataset.value));
  for (const [label, order] of [
    ['Numerically', [1, 3, 5, 7, 9, 11]],
    ['Tonally', [1, 9, 5, 11, 3, 7]],
    ['Chordally', [1, 5, 3, 7, 9, 11]]
  ]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    expect(await columns()).toEqual(order);
    expect(await rows()).toEqual(order);
    await expect(page.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#menuContent')).toBeHidden();
  }
  await page.reload();
  expect(await columns()).toEqual([1, 5, 3, 7, 9, 11]);
  await page.getByRole('button', { name: '5-limit preset', exact: true }).click();
  expect(await columns()).toEqual([1, 5, 3]);
  await page.getByRole('button', { name: 'Advanced sound options', exact: true }).click();
  await expect(page.getByLabel('Wave', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tonally', exact: true })).toBeVisible();
});

test('compact corner controls leave the diamond fitted to the full viewport', async ({ page }) => {
  for (const viewport of [{ width: 1200, height: 800 }, { width: 612, height: 590 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const board = page.locator('#diamondWrap');
    await expect.poll(async () => { const r=await board.boundingBox();return Math.round(r.y+r.height/2); }).toBe(viewport.height/2);
    const before = await board.boundingBox();
    expect(before.x + before.width / 2).toBeCloseTo(viewport.width / 2, 0);
    expect(before.y + before.height / 2).toBeCloseTo(viewport.height / 2, 0);
    await expect(page.locator('#menu')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(page.locator('#menu')).toHaveCSS('box-shadow', 'none');
    expect((await page.locator('#menu').boundingBox()).height).toBeLessThan(viewport.width < 801 ? 260 : 130);
    await page.getByRole('button', { name: 'Custom', exact: true }).click();
    expect(await board.boundingBox()).toEqual(before);
    await page.getByRole('button', { name: 'Custom', exact: true }).click();
  }
});


test('four corners remain reachable and external links have names and safe destinations', async ({ page }) => {
  await expect(page.locator('#helpMenu .project-links a')).toHaveCount(2);
  await expect(page.locator('#communityLinks .xen-links a')).toHaveCount(3);
  const help = await page.locator('#helpToggle').boundingBox();
  const projects = await page.locator('#helpMenu .project-links').boundingBox();
  expect(help.y + help.height).toBeLessThan(projects.y);
  const destinations = [
    'https://github.com/NickVuci/TonalityDiamondApplet', 'https://nickvuci.com/',
    'https://en.xen.wiki/w/Main_Page', 'https://discord.com/invite/QhJBn3b2wX',
    'https://www.facebook.com/groups/xenharmonic2', 'https://en.xen.wiki/w/Tonality_diamond'
  ];
  const links = page.locator('.corner-links a');
  expect(await links.evaluateAll(nodes => nodes.map(n => n.href))).toEqual(destinations);
  await expect(page.getByRole('link', { name: 'go back to the tonality diamond page', exact: true })).toBeVisible();
  for (const link of await links.all()) {
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(link).toHaveAttribute('target', '_blank');
  }
  for (const viewport of [{width:1200,height:800},{width:612,height:590},{width:390,height:844},{width:320,height:568},{width:844,height:390}]) {
    await page.setViewportSize(viewport);
    const areas = await page.locator('#menu, #playbar, #helpMenu, #communityLinks').evaluateAll(nodes => nodes.map(node => {
      const r = node.getBoundingClientRect(); return {id:node.id,x:r.x,y:r.y,right:r.right,bottom:r.bottom};
    }));
    for (const r of areas) {
      expect(r.x).toBeGreaterThanOrEqual(0); expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.right).toBeLessThanOrEqual(viewport.width); expect(r.bottom).toBeLessThanOrEqual(viewport.height);
    }
    const sound = areas.find(a=>a.id==='playbar'), links = areas.find(a=>a.id==='communityLinks');
    expect(sound.right <= links.x || links.right <= sound.x || sound.bottom <= links.y || links.bottom <= sound.y).toBe(true);
    await page.getByRole('button', {name:'Advanced sound options',exact:true}).click();
    await expect(page.getByLabel('Wave',{exact:true})).toBeVisible();
    const dropdown = await page.locator('#soundContent').boundingBox();
    expect(dropdown.y).toBeGreaterThanOrEqual(0);
    expect(dropdown.y).toBeGreaterThan(sound.bottom);
    await page.getByRole('button', {name:'Advanced sound options',exact:true}).click();
  }
});


test('root frequency edits inline, retunes and persists without following played notes', async ({page}) => {
  const root = page.getByRole('spinbutton', { name: 'Root frequency in hertz' });
  await expect(root).toHaveValue('392.00');
  await expect(page.locator('#pitchReadout')).toHaveCount(0);
  await page.locator('.note[data-numerator="3"][data-denominator="1"]').hover();
  await expect(root).toHaveValue('392.00');
  await page.getByRole('button', {name:'Sustain',exact:true}).click();
  await page.locator('.note[data-numerator="3"][data-denominator="1"]').click();
  await expect(page.locator('.note.play')).not.toHaveCount(0);
  await root.click();
  await root.pressSequentially('440.5');
  await root.press('Enter');
  await expect(root).toHaveValue('440.50');
  await expect(page.locator('.note.play')).toHaveCount(0);
  await expect(page.locator('.note[data-numerator="3"][data-denominator="1"]')).toHaveAttribute('aria-label', /1321.50 hertz/);
  await page.reload();
  await expect(root).toHaveValue('440.50');
  await root.fill('880'); await root.press('Tab');
  await expect(root).toHaveValue('880.00');
  for (const value of ['', '0', '2001']) {
    await root.fill(value); await root.press('Enter');
    await expect(root).toHaveValue('880.00');
    await expect(page.locator('#notice')).toContainText('between 20 and 2000');
  }
  await root.fill('432'); await root.press('Escape');
  await expect(root).toHaveValue('880.00');
  const rootBox=await root.boundingBox();
  const advancedBox=await page.getByRole('button',{name:'Advanced sound options',exact:true}).boundingBox();
  expect(rootBox.y + rootBox.height).toBeLessThanOrEqual(advancedBox.y);
});


test('playable diamond stays centred with thin connected chord strips', async ({ page }) => {
  await expect(page.locator('.tile.corner')).toHaveCount(0);
  for (const limit of [5, 11]) {
    await page.getByRole('button', {name: limit+'-limit preset', exact:true}).click();
    for (const orientation of ['horizontal','vertical']) {
      if (orientation === 'vertical') await page.keyboard.press('o');
      const geometry = await page.locator('#stage').evaluate(stage => {
        const notes = [...stage.querySelectorAll('.note')];
        const axes = [...stage.querySelectorAll('.axis')];
        const boxes = notes.map(n=>n.getBoundingClientRect());
        const left=Math.min(...boxes.map(r=>r.left)),right=Math.max(...boxes.map(r=>r.right));
        const top=Math.min(...boxes.map(r=>r.top)),bottom=Math.max(...boxes.map(r=>r.bottom));
        return { centreX:(left+right)/2,centreY:(top+bottom)/2,w:innerWidth,h:innerHeight,
          noteSize: notes[0].offsetWidth, axisSize: Math.min(axes[0].offsetWidth, axes[0].offsetHeight),
          axisLength: Math.max(axes[0].offsetWidth, axes[0].offsetHeight),
          joins: axes.filter(axis=>axis.nextElementSibling?.dataset.axis === axis.dataset.axis).map(axis => axis.offsetLeft + axis.offsetWidth - axis.nextElementSibling.offsetLeft),
          gaps: axes.map(axis => axis.dataset.axis==='column' ? -axis.offsetTop-axis.offsetHeight : -axis.offsetLeft-axis.offsetWidth),
          visible: axes.every(axis=>{const r=axis.getBoundingClientRect();return r.left>=0 && r.top>=0 && r.right<=innerWidth && r.bottom<=innerHeight;}) };
      });
      expect(geometry.centreX).toBeCloseTo(geometry.w/2,1);
      expect(geometry.centreY).toBeCloseTo(geometry.h/2,1);
      expect(geometry.axisSize).toBeLessThanOrEqual(geometry.noteSize*0.4);
      expect(geometry.axisLength).toBe(geometry.noteSize+1);
      expect(geometry.joins.length).toBeGreaterThan(0);
      expect(geometry.joins.every(overlap=>overlap===1)).toBe(true);
      expect(geometry.gaps.every(gap=>gap===1)).toBe(true);
      expect(geometry.visible).toBe(true);
      const tile=page.locator('.note[data-row="1"][data-col="1"]');
      await tile.focus(); await page.keyboard.press('ArrowUp');
      await expect(page.getByRole('button',{name:'Play column 1',exact:true})).toBeFocused();
    }
    await page.keyboard.press('o');
  }
});

test('fixed corner dropdowns stay within narrow viewports', async ({page}) => {
  for (const viewport of [{width:1200,height:800},{width:390,height:844},{width:320,height:568},{width:568,height:320},{width:844,height:390}]) {
    await page.setViewportSize(viewport);
    for (const [label,id] of [['Custom','menuContent'],['Advanced sound options','soundContent'],['Help','helpContent']]) {
      await page.getByRole('button',{name:label,exact:true}).click();
      const popup=page.locator('#'+id);
      const box=await popup.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x+box.width).toBeLessThanOrEqual(viewport.width);expect(box.y+box.height).toBeLessThanOrEqual(viewport.height);
      const covered=await popup.evaluate(root=>[...root.querySelectorAll('button,input,select,summary')].filter(node=>{
        const r=node.getBoundingClientRect(),p=root.getBoundingClientRect();
        if(!node.getClientRects().length || r.y+r.height/2<p.top || r.y+r.height/2>p.bottom) return false;
        const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
        return hit?.closest('.panel') !== root.closest('.panel');
      }).map(node=>node.id));
      expect(covered).toEqual([]);
      await page.keyboard.press('Escape');
    }
  }
});


test('interface text matches the return link and fitted tiles stay clear of controls', async ({page}) => {
  for(const viewport of [{width:1200,height:800},{width:870,height:764},{width:612,height:590},{width:390,height:844},{width:320,height:568}]) {
    await page.setViewportSize(viewport);
    await expect.poll(async()=>{const r=await page.locator('#diamondWrap').boundingBox();return Math.round(r.y+r.height/2);}).toBe(viewport.height/2);
    for(const selector of ['.quick-heading','#presets button','#layoutPresets button','#menuToggle','#soundToggle','#helpToggle','#sustain','#refHz','.quick-volume','#volumeValue','.diamond-return']) {
      for(const node of await page.locator(selector).all()) await expect(node).toHaveCSS('font-size','16px');
    }
    const blocked = await page.locator('.tile').evaluateAll(tiles=>tiles.filter(tile=>{
      const r=tile.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
      return hit?.closest('.panel') !== null;
    }).length);
    expect(blocked).toBe(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.getByRole('button',{name:'Advanced sound options',exact:true}).click();
  for(const selector of ['#soundContent label','#soundContent select','#soundContent summary','#soundContent .muted']) {
    for(const node of await page.locator(selector).all()) await expect(node).toHaveCSS('font-size','16px');
  }
});

test('hover, press, and equivalent pitches have distinct feedback that clears', async ({page}) => {
  const tile=page.locator('.note[data-row="1"][data-col="1"]');
  const peer=page.locator('.note[data-row="2"][data-col="2"]');
  const other=page.locator('.note[data-row="1"][data-col="2"]');
  await tile.hover();
  await expect(tile).toHaveClass(/hovered/);
  await expect(peer).toHaveClass(/related/);
  await expect(other).not.toHaveClass(/related/);
  await page.mouse.down();
  await expect(tile).toHaveClass(/pressed/);
  await expect(tile).toHaveCSS('--light','50%');
  await expect(peer).toHaveCSS('--light','12.5%');
  await expect(peer).toHaveClass(/pressed-related/);
  await expect.poll(()=>tile.evaluate(n=>getComputedStyle(n.querySelector('.cell'),'::before').boxShadow)).toContain('rgba(255, 255, 255, 0.5)');
  await expect.poll(()=>peer.evaluate(n=>getComputedStyle(n.querySelector('.cell'),'::before').boxShadow)).toContain('rgba(255, 255, 255, 0.125)');
  await expect.poll(()=>tile.evaluate(n=>getComputedStyle(n,'::after').backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  await other.hover();
  await expect(tile).not.toHaveClass(/pressed/);
  await expect(other).toHaveClass(/pressed/);
  await page.mouse.up();
  await expect(page.locator('.pressed')).toHaveCount(0);
  await page.getByRole('button',{name:'Stop all',exact:true}).click();
  await expect(page.locator('.hovered, .related, .pressed')).toHaveCount(0);
  await tile.focus();
  await page.keyboard.down('Space');
  await expect(tile).toHaveClass(/pressed/);
  await page.keyboard.up('Space');
  await expect(tile).not.toHaveClass(/pressed/);
});

test('warm audio renders clean chords, softens high notes, and stops release tails', async ({page}) => {
  const rendered = await page.evaluate(async () => {
    const {AudioEngine} = await import('/js/modules/audio.js');
    async function render(frequencies, stop=false) {
      const ctx=new OfflineAudioContext(1, 48000*3, 48000);
      const facade={state:'running',get currentTime(){return ctx.currentTime;},destination:ctx.destination};
      for(const key of ['createGain','createPeriodicWave','createBiquadFilter','createOscillator','createDynamicsCompressor']) facade[key]=ctx[key].bind(ctx);
      const engine=new AudioEngine({contextFactory:()=>facade});engine.setVolume(0.6);
      const ids=frequencies.map((f,i)=>engine.play(String(i),f,{wave:'warm',attack:60,release:900}));
      await Promise.resolve(); await Promise.resolve();
      const pause=ctx.suspend(1.5);const rendering=ctx.startRendering();
      await pause; ids.forEach(id=>engine.release(id)); if(stop) engine.stopAll(); await ctx.resume();
      const samples=(await rendering).getChannelData(0);
      const rms=(start,end)=>Math.sqrt(samples.slice(start*48000,end*48000).reduce((n,x)=>n+x*x,0)/((end-start)*48000));
      return {peak:samples.reduce((peak,x)=>Math.max(peak,Math.abs(x)),0),steady:rms(0.5,1.4),early:rms(0,0.01),tail:rms(1.65,1.8),end:rms(2.7,2.9),samples:Array.from(samples)};
    }
    const single=await render([440]);const high=await render([3520]);
    const chord=await render([1,9/8,5/4,11/8,3/2,13/8,7/4,15/8].map(r=>220*r));
    const stopped=await render([220,275,330,385],true);
    return {single:{...single,samples:undefined},high:{...high,samples:undefined},chord,stopped:{...stopped,samples:undefined}};
  });
  expect(rendered.single.steady).toBeGreaterThan(0.01);
  expect(rendered.single.early).toBeLessThan(rendered.single.steady/3);
  expect(rendered.high.steady).toBeLessThan(rendered.single.steady*0.4);
  expect(rendered.chord.peak).toBeLessThan(0.85);
  expect(rendered.chord.steady).toBeLessThan(rendered.single.steady*1.5);
  expect(rendered.chord.tail).toBeGreaterThan(0.001);
  expect(rendered.chord.end).toBeLessThan(0.00001);
  expect(rendered.stopped.tail).toBeLessThan(0.00001);
  const {writeFileSync,mkdirSync}=await import('node:fs');
  const wav=Buffer.alloc(44+rendered.chord.samples.length*2);
  wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(48000,24);wav.writeUInt32LE(96000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
  rendered.chord.samples.forEach((x,i)=>wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,x))*32767),44+i*2));
  mkdirSync('test-results',{recursive:true});writeFileSync('test-results/warm-ji-chord.wav',wav);
});

test('continuous ratio dividers align with cell centres in both orientations', async ({page}) => {
  for (const limit of [5,15]) {
    await page.getByRole('button',{name:limit+'-limit preset',exact:true}).click();
    for (let orientation=0;orientation<2;orientation++) {
      const alignment=await page.locator('#stage').evaluate(stage=>{
        const path=document.querySelector('.ratio-dividers path');
        const matrix=path.getScreenCTM();
        const lines=path.getAttribute('d').split(' ').map(segment=>{
          const values=segment.match(/-?\d+(?:\.\d+)?/g).map(Number);
          return [new DOMPoint(values[0],values[1]).matrixTransform(matrix),new DOMPoint(values[2],values[3]).matrixTransform(matrix)];
        });
        return {widthRatio:parseFloat(getComputedStyle(path).strokeWidth)/parseFloat(getComputedStyle(document.querySelector('.grid-borders')).strokeWidth),horizontal:lines.every(([a,b])=>Math.abs(a.y-b.y)<0.01),
          error:Math.max(...[...stage.querySelectorAll('.note .cell')].map(cell=>{
            const r=cell.getBoundingClientRect();return Math.min(...lines.map(([a])=>Math.abs(a.y-(r.y+r.height/2))));
          }))};
      });
      expect(alignment.widthRatio).toBeCloseTo(0.5,3);
      expect(alignment.horizontal).toBe(true);
      expect(alignment.error).toBeLessThan(0.1);
      await page.keyboard.press('o');
    }
  }
});

test('divider alignment survives fractional browser scaling', async ({page}) => {
  for (const zoom of [0.8,1,1.25,1.5,2]) {
    await page.evaluate(z=>document.documentElement.style.zoom=z,zoom);
    await page.getByRole('button',{name:'5-limit preset',exact:true}).click();
    await page.locator('#viewport').dispatchEvent('wheel',{ctrlKey:true,deltaY:-120});
    const result=await page.locator('#stage').evaluate(stage=>{
      const path=document.querySelector('.ratio-dividers path'), matrix=path.getScreenCTM();
      const lines=path.getAttribute('d').split(' ').map(s=>{const v=s.match(/-?\d+(?:\.\d+)?/g).map(Number);return new DOMPoint(v[0],v[1]).matrixTransform(matrix).y;});
      return {lines,centres:[...stage.querySelectorAll('.note .cell')].map(n=>{const r=n.getBoundingClientRect();return r.y+r.height/2;})};
    });
    expect(Math.max(...result.centres.map(y=>Math.min(...result.lines.map(line=>Math.abs(line-y))))),JSON.stringify({zoom,result})).toBeLessThan(0.1);
  }
});

test('painted divider pixels cross every cell centre at fractional scales', async ({page}) => {
  const {createRequire}=await import('node:module');
  const {dirname,join}=await import('node:path');
  const require=createRequire(import.meta.url);
  const {PNG}=require(join(dirname(require.resolve('playwright-core/package.json')),'lib/utilsBundle.js'));
  await page.setViewportSize({width:1200,height:900});
  for(const zoom of [1,1.25,1.5]) {
    await page.evaluate(z=>document.documentElement.style.zoom=z,zoom);
    for(const limit of [5,15]) {
      await page.getByRole('button',{name:limit+'-limit preset',exact:true}).click();
      for(let orientation=0;orientation<2;orientation++) {
        const samples=await page.locator('.note').evaluateAll(nodes=>nodes.flatMap(node=>{
          const r=node.getBoundingClientRect();
          return [0.22,0.78].map(t=>({x:r.x+r.width*t,y:r.y+r.height/2}));
        }));
        const png=PNG.sync.read(await page.screenshot({scale:'css'}));
        for(const point of samples) {
          let darkest=255;
          for(let dy=-1;dy<=1;dy++) {
            const x=Math.round(point.x),y=Math.round(point.y)+dy;
            const i=(y*png.width+x)*4;
            darkest=Math.min(darkest,Math.max(png.data[i],png.data[i+1],png.data[i+2]));
          }
          expect(darkest,JSON.stringify({zoom,limit,orientation,point})).toBeLessThan(150);
        }
        await page.keyboard.press('o');
      }
    }
  }
});

test('dark appearance persists independently, retains readable controls, and loads the supplied wiki icon', async ({page}) => {
  const before=await page.locator('#stage').boundingBox();
  const toggle=page.locator('#themeToggle');
  await expect(toggle).toHaveAccessibleName('Switch to light mode');
  await expect(toggle.locator('.theme-sun')).toBeVisible();
  await expect(toggle.locator('.theme-moon')).toBeHidden();
  await expect(page.locator('#viewport')).toHaveCSS('background-color','rgb(23, 26, 32)');
  await expect(page.locator('.axis').first()).toHaveCSS('color','rgb(11, 13, 16)');
  const after=await page.locator('#stage').boundingBox();expect(after).toEqual(before);
  const wiki=page.getByRole('link',{name:'Xenharmonic Wiki (opens in a new tab)',exact:true}).locator('img');
  await expect(wiki).toHaveAttribute('src','assets/xen-wiki.png');
  expect(await wiki.evaluate(img=>img.complete&&img.naturalWidth===180)).toBe(true);
  await page.reload();
  await expect(toggle).toHaveAccessibleName('Switch to light mode');
  for(const [label,id] of [['Custom','menuContent'],['Advanced sound options','soundContent'],['Help','helpContent']]) {
    await page.getByRole('button',{name:label,exact:true}).click();
    await expect(page.locator('#'+id)).toHaveCSS('background-color','rgb(35, 40, 49)');
    await page.keyboard.press('Escape');
  }
  await page.setViewportSize({width:320,height:568});
  const [links,help]=await Promise.all([page.locator('#communityLinks').boundingBox(),page.locator('#helpMenu').boundingBox()]);
  expect(links.x+links.width).toBeLessThanOrEqual(help.x);
  await toggle.click();await expect(toggle).toHaveAccessibleName('Switch to dark mode');
  await expect(toggle.locator('.theme-moon')).toBeVisible();
  await expect(toggle.locator('.theme-sun')).toBeHidden();
  await expect(page.locator('#viewport')).toHaveCSS('background-color','rgb(255, 255, 255)');
  await page.reload();await expect(toggle).toHaveAccessibleName('Switch to dark mode');
});

test('dark is the default even when the system prefers light', async ({page}) => {
  await page.emulateMedia({colorScheme:'light'});await page.reload();
  await expect(page.getByRole('button',{name:'Switch to light mode',exact:true})).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
});


test('painted colours stop at the divider and chord-strip edges stay straight', async ({page}) => {
  const {createRequire}=await import('node:module');
  const {dirname,join}=await import('node:path');
  const require=createRequire(import.meta.url);
  const {PNG}=require(join(dirname(require.resolve('playwright-core/package.json')),'lib/utilsBundle.js'));
  await page.setViewportSize({width:1075,height:931});
  for(const zoom of [1,1.25,1.5]) {
    await page.evaluate(z=>document.documentElement.style.zoom=z,zoom);
    for(const limit of [5,7,11,13,15]) {
      await page.getByRole('button',{name:limit+'-limit preset',exact:true}).click();
      for(let orientation=0;orientation<2;orientation++) {
        const samples=await page.locator('#stage').evaluate(stage=>{
          const fills=[...stage.querySelectorAll('.diamond-fills path')];
          const matrix=stage.querySelector('.ratio-dividers').getScreenCTM();
          const scale=Math.hypot(matrix.a,matrix.b);
          const colours=[...stage.querySelectorAll('.note')].flatMap((note,index)=>{
            const r=note.getBoundingClientRect();
            return [0,1].flatMap(half=>{
              const colour=getComputedStyle(fills[index*2+half]).fill.match(/[\d.]+/g).map(Number);
              return [0.24,0.76].map(t=>({x:r.x+r.width*t,y:r.y+r.height/2+(half?1:-1)*(scale/2+1.5),colour}));
            });
          });
          const axes=[];
          const rects=[...stage.querySelectorAll('.diamond-fills rect')];
          for(const rect of rects) {
            const x=+rect.getAttribute('x'),y=+rect.getAttribute('y'),w=+rect.getAttribute('width'),h=+rect.getAttribute('height');
            // Probe the outside stroke around every join and at the cell midpoint.
            for(const fraction of [0.03,0.5,0.97]) {
              const p=new DOMPoint(w>h?x+w*fraction:x,w>h?y:y+h*fraction).matrixTransform(matrix);
              axes.push({x:p.x,y:p.y});
            }
          }
          return {colours,axes};
        });
        const png=PNG.sync.read(await page.screenshot({scale:'css'}));
        const pixel=(x,y)=>{const i=(Math.round(y)*png.width+Math.round(x))*4;return [...png.data.slice(i,i+3)];};
        for(const point of samples.colours) {
          const actual=pixel(point.x,point.y);
          expect(Math.max(...actual.map((v,i)=>Math.abs(v-point.colour[i]))),JSON.stringify({zoom,limit,orientation,point,actual})).toBeLessThan(32);
        }
        for(const point of samples.axes) {
          let darkest=255;
          for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)darkest=Math.min(darkest,Math.max(...pixel(point.x+dx,point.y+dy)));
          expect(darkest,JSON.stringify({zoom,limit,orientation,point})).toBeLessThan(145);
        }
        await page.keyboard.press('o');
      }
    }
  }
});


test('responsive corners keep controls separate through portrait, landscape and playback', async ({page}) => {
  for (const viewport of [{width:320,height:568},{width:360,height:640},{width:390,height:844},{width:568,height:320},{width:640,height:280},{width:700,height:500},{width:701,height:500},{width:844,height:390},{width:1024,height:768},{width:1440,height:900}]) {
    await page.setViewportSize(viewport);
    await expect.poll(async()=>{const r=await page.locator('#diamondWrap').boundingBox();return Math.round(r.y+r.height/2);}).toBe(viewport.height/2);
    for (const active of [false,true]) {
      if (active) await page.getByRole('button', {name:'Play scale',exact:true}).click();
      const issues = await page.evaluate(() => {
        const selector = '#presets button,#layoutPresets button,#limitPreset,#layoutPreset,#menuToggle,#volume,#volumeValue,#panic,#sustain,#explore,#refHz,.root-frequency>span,#soundToggle,#helpToggle,#themeToggle,#helpMenu a,#communityLinks a';
        const items=[...document.querySelectorAll(selector)].filter(n=>n.getClientRects().length).map(n=>({n,r:n.getBoundingClientRect(),name:n.id||n.getAttribute('aria-label')||n.textContent}));
        const errors=[];
        for (let i=0;i<items.length;i++) {
          const {n,r,name}=items[i];
          if(r.left<0||r.top<0||r.right>innerWidth+0.5||r.bottom>innerHeight+0.5) errors.push(name+' leaves viewport');
          const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
          if(!n.contains(hit)) errors.push(name+' is covered');
          if(n.tagName==='BUTTON' && n.textContent.trim() && r.height>40) errors.push(name+' wraps');
          for (const other of items.slice(i+1)) {
            const b=other.r;
            if(Math.min(r.right,b.right)-Math.max(r.left,b.left)>0.5 && Math.min(r.bottom,b.bottom)-Math.max(r.top,b.top)>0.5) errors.push(name+' overlaps '+other.name);
          }
        }
        return errors;
      });
      expect(issues, JSON.stringify({viewport,active})).toEqual([]);
      if (active) await page.getByRole('button', {name:'Stop all',exact:true}).click();
    }
    for (const label of ['Custom','Advanced sound options','Help']) {
      const toggle=page.getByRole('button',{name:label,exact:true});
      await toggle.click();
      const popup=page.locator('#'+await toggle.getAttribute('aria-controls'));
      const box=await popup.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x+box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y+box.height).toBeLessThanOrEqual(viewport.height);
      await page.keyboard.press('Escape');
    }
  }
});

test('compact presets share state with desktop buttons, custom settings and saved links', async ({page}) => {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:390,height:844});
  const limit=page.getByRole('combobox',{name:'Odd limit preset',exact:true});
  const layout=page.getByRole('combobox',{name:'Layout preset',exact:true});
  for (const value of ['5','7','11','13','15']) {
    await limit.selectOption(value);
    await expect(page.locator('.note')).toHaveCount(((+value+1)/2)**2);
  }
  await limit.selectOption('11');
  await layout.selectOption('tonal');
  expect(await page.locator('.axis[data-axis="column"]').evaluateAll(nodes=>nodes.map(n=>+n.dataset.value))).toEqual([1,9,5,11,3,7]);
  await page.reload();
  await expect(limit).toHaveValue('11');await expect(layout).toHaveValue('tonal');
  await page.setViewportSize({width:1200,height:800});
  await expect(page.getByRole('button',{name:'11-limit preset',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('button',{name:'Tonally',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'13-limit preset',exact:true}).click();
  await page.getByRole('button',{name:'Chordally',exact:true}).click();
  await page.setViewportSize({width:320,height:568});
  await expect(limit).toHaveValue('13');await expect(layout).toHaveValue('chordal');
  await page.getByRole('button',{name:'Custom',exact:true}).click();
  await page.getByRole('radio',{name:'Custom',exact:true}).check();
  await page.getByLabel('Numbers (any order)').fill('4.5.6.7');
  await page.getByRole('button',{name:'Apply',exact:true}).click();
  await page.keyboard.press('Escape');
  await expect(limit).toHaveValue('custom');
  await expect(page.locator('.note')).toHaveCount(16);
  await limit.selectOption('5');
  await expect(page.locator('.note')).toHaveCount(9);
  expect(errors).toEqual([]);
});


test('corner anchors and dropdowns respect phone safe areas', async ({page}) => {
  for (const viewport of [{width:390,height:844},{width:844,height:390}]) {
    await page.setViewportSize(viewport);
    await page.addStyleTag({content:'#viewport { --corner-top: 44px; --corner-bottom: 34px; --corner-left: 44px; --corner-right: 44px; }'});
    await expect.poll(()=>page.locator('#helpMenu').evaluate(node=>Math.round(node.getBoundingClientRect().bottom))).toBe(viewport.height-34);
    for (const label of ['Custom','Advanced sound options','Help']) {
      const toggle=page.getByRole('button',{name:label,exact:true});
      await toggle.click();
      const box=await page.locator('#'+await toggle.getAttribute('aria-controls')).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(44);expect(box.y).toBeGreaterThanOrEqual(44);
      expect(box.x+box.width).toBeLessThanOrEqual(viewport.width-44);
      expect(box.y+box.height).toBeLessThanOrEqual(viewport.height-34);
      await page.keyboard.press('Escape');
    }
    await page.reload();
  }
});


test('first touch retries audio on release after a Safari-style pending resume', async ({browser}) => {
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  await page.addInitScript(()=>{
    const NativeContext=window.AudioContext;
    const stats=window.audioUnlockTest={released:false,calls:0,starts:0,session:''};
    document.addEventListener('pointerup',()=>{stats.released=true;},{capture:true});
    Object.defineProperty(navigator,'audioSession',{configurable:true,value:{set type(value){stats.session=value;}}});
    window.AudioContext=class extends NativeContext {
      constructor(){super();this.blocked=true;}
      get state(){return this.blocked?'suspended':super.state;}
      resume(){
        stats.calls++;
        if(!stats.released)return new Promise(()=>{});
        this.blocked=false;return super.resume();
      }
      createOscillator(){
        const node=super.createOscillator(),start=node.start.bind(node);
        node.start=(...args)=>{stats.starts++;return start(...args);};return node;
      }
    };
  });
  await page.goto('/');
  await page.locator('.note[data-row="1"][data-col="1"]').tap();
  await expect.poll(()=>page.evaluate(()=>audioUnlockTest.starts)).toBe(1);
  expect(await page.evaluate(()=>audioUnlockTest.calls)).toBeGreaterThanOrEqual(2);
  expect(await page.evaluate(()=>audioUnlockTest.session)).toBe('playback');
  await expect(page.locator('#audioBanner')).toHaveClass(/hidden/);
  await page.getByRole('button',{name:'Stop all',exact:true}).tap();
  await page.locator('.note[data-row="1"][data-col="2"]').tap();
  await expect.poll(()=>page.evaluate(()=>audioUnlockTest.starts)).toBe(2);
  await context.close();
});
