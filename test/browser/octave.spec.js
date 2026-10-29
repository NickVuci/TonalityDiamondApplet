import { test, expect } from '@playwright/test';

test('Octave reduced toggles labels and audio together, persists and restores', async ({ page }) => {
  await page.addInitScript(() => {
    window.startedFrequencies = [];
    const createOscillator = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (...args) {
      const oscillator = createOscillator.apply(this, args);
      const start = oscillator.start.bind(oscillator);
      oscillator.start = (...times) => {
        window.startedFrequencies.push(oscillator.frequency.value);
        return start(...times);
      };
      return oscillator;
    };
  });
  await page.goto('/');
  const source = page.getByRole('button', { name: 'Octave reduced', exact: true });
  const toggle = page.getByRole('button', { name: 'Octave reduced', exact: true });
  const tile = page.locator('.note[data-numerator="3"][data-denominator="1"]');
  await expect(page.locator('#menuContent')).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await tile.click();
  await expect.poll(() => page.evaluate(() => window.startedFrequencies.at(-1))).toBe(1176);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(tile).toHaveAttribute('data-note', '3/2');
  await expect(tile.locator('.n')).toHaveText('3');
  await expect(tile.locator('.d')).toHaveText('2');
  await tile.click();
  await expect.poll(() => page.evaluate(() => window.startedFrequencies.at(-1))).toBe(588);
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(tile).toHaveAttribute('data-note', '3/2');
  await toggle.click();
  await expect(tile).toHaveAttribute('data-note', '3/1');
  await expect(tile.locator('.d')).toHaveText('1');
  await tile.click();
  await expect.poll(() => page.evaluate(() => window.startedFrequencies.at(-1))).toBe(1176);
});

test('phone switch is reachable outside Custom and updates both settings', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Octave reduced', exact: true }).tap();
  await expect(page.locator('#menuContent')).toBeHidden();
  const tile = page.locator('.note[data-numerator="3"][data-denominator="1"]');
  await expect(tile).toHaveAttribute('data-note', '3/2');
  await expect(tile.locator('.d')).toHaveText('2');
  await page.getByRole('button', { name: 'Custom', exact: true }).tap();
  await expect(page.getByLabel('Reduce pitches to one octave')).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Sounding ratio', exact: true })).toBeChecked();
  await context.close();
});
