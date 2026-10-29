import { test, expect } from '@playwright/test';

test('octave toggle folds pitches and restores their original register', async ({ page }) => {
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
  await page.getByRole('button', { name: 'Custom', exact: true }).click();
  const tile = page.locator('.note[data-numerator="3"][data-denominator="1"]');
  await expect(tile).toHaveAttribute('data-note', '3/1');
  await page.keyboard.press('Escape');
  await tile.click();
  await expect.poll(() => page.evaluate(() => window.startedFrequencies.at(-1))).toBe(1176);
  await page.getByRole('button', { name: 'Custom', exact: true }).click();
  const toggle = page.getByLabel('Reduce pitches to one octave');
  await toggle.check();
  await expect(toggle).toBeChecked();
  await expect(tile).toHaveAttribute('data-note', '3/2');
  await expect(page.locator('#octaveHint')).toContainText('Pitches reduced to 392.00–784.00 Hz');
  await expect(page.locator('#octaveHint')).toContainText('Row labels stay a/b');
  await expect(tile.locator('.n')).toHaveText('3');
  await expect(tile.locator('.d')).toHaveText('1');
  await page.getByRole('radio', { name: 'Sounding ratio' }).check();
  await expect(tile.locator('.d')).toHaveText('2');
  await page.keyboard.press('Escape');
  await tile.click();
  await expect.poll(() => page.evaluate(() => window.startedFrequencies.at(-1))).toBe(588);
  await page.getByRole('button', { name: 'Custom', exact: true }).click();
  await toggle.uncheck();
  await expect(tile).toHaveAttribute('data-note', '3/1');
  await expect(page.locator('#octaveHint')).toContainText('Pitches use their original register');
});

test('phone touch can toggle octave reduction using the label', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Custom', exact: true }).tap();
  await page.locator('label.check-row').filter({ has: page.locator('#folded') }).tap();
  await expect(page.locator('#folded')).toBeChecked();
  await expect(page.locator('.note[data-numerator="3"][data-denominator="1"]')).toHaveAttribute('data-note', '3/2');
  await context.close();
});
