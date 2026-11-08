import { expect, test, type Page } from '@playwright/test';

async function setLatency(page: Page, value: string) {
  const slider = page.getByLabel('Latency');
  await slider.fill(value);
}

function noteField(page: Page) {
  return page.getByRole('textbox', { name: 'Note', exact: true });
}

test('success hardens, failure keeps the note, and retry can save it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/');
  await page.getByLabel('Full motion').check();
  await setLatency(page, '900');
  await noteField(page).fill('Ship the notes');
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  const first = page.getByRole('listitem').filter({ hasText: 'Ship the notes' });
  await expect(first.locator('.settle')).toHaveAttribute('data-phase', 'pending');
  await expect(first.locator('.settle-sweep')).toHaveCSS('pointer-events', 'none');
  await expect(first.locator('.settle-sweep')).toHaveAttribute('aria-hidden', 'true');
  await first.getByText('Ship the notes').selectText();
  expect(await page.evaluate(() => window.getSelection()?.toString())).toContain('Ship the notes');
  await expect(first.locator('.settle')).toHaveAttribute('data-phase', 'settled', { timeout: 4000 });
  await expect(first.getByText('Saved', { exact: true })).toBeVisible();

  await page.getByLabel('Fail requests').check();
  await noteField(page).fill('Keep this');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  const failed = page.getByRole('listitem').filter({ hasText: 'Keep this' });
  await expect(failed.getByText('Keep this', { exact: true })).toBeVisible();
  await expect(failed.getByRole('button', { name: 'Retry sending “Keep this”' })).toBeVisible();
  await expect(failed.getByRole('button', { name: 'Edit “Keep this”' })).toBeVisible();
  await expect(failed.getByRole('button', { name: 'Dismiss “Keep this”' })).toBeVisible();
  await expect(failed.locator('.settle-particle')).toHaveCount(0);

  await failed.getByRole('button', { name: 'Edit “Keep this”' }).click();
  await expect(noteField(page)).toHaveValue('Keep this');
  await expect(failed.getByText('Keep this', { exact: true })).toBeVisible();
  await noteField(page).fill('');

  await page.getByLabel('Fail requests').uncheck();
  await failed.getByRole('button', { name: 'Retry sending “Keep this”' }).click();
  await expect(failed.getByText('Attempt 2')).toBeVisible();
  await expect(failed.getByText('Saved', { exact: true })).toBeVisible({ timeout: 4000 });
  await expect(failed.getByText('Keep this', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('keyboard sends, reaches retry, and dismiss returns focus', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Reduced motion').check();
  await setLatency(page, '0');
  await page.getByLabel('Fail requests').check();
  await noteField(page).focus();
  await page.keyboard.type('From keys');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Retry sending “From keys”' })).toBeVisible();
  await expect(noteField(page)).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Retry sending “From keys”' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Attempt 2')).toBeVisible();
  await expect(page.getByText('From keys', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Dismiss “From keys”' }).focus();
  await page.keyboard.press('Enter');
  await expect(noteField(page)).toBeFocused();
  await expect(page.getByText('From keys', { exact: true })).toHaveCount(0);
});

test('concurrent notes settle independently and leave no particles', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Full motion').check();
  await setLatency(page, '200');
  const notes = [
    ['one', false],
    ['two', true],
    ['three', false],
    ['four', true],
    ['five', false],
  ] as const;

  for (const [text, shouldFail] of notes) {
    if (shouldFail) await page.getByLabel('Fail requests').check();
    else await page.getByLabel('Fail requests').uncheck();
    await noteField(page).fill(text);
    await page.getByRole('button', { name: 'Send', exact: true }).click();
  }

  await expect(page.getByRole('listitem')).toHaveCount(5);
  for (const [index, [text, shouldFail]] of notes.entries()) {
    const item = page.getByRole('listitem').nth(index);
    await expect(item).toContainText(text);
    await expect(item.getByText(shouldFail ? 'Failed' : 'Saved', { exact: true })).toBeVisible({
      timeout: 4000,
    });
  }
  await expect(page.locator('.settle-particle')).toHaveCount(0);
  await expect(page.getByRole('listitem')).toHaveCount(5);
});

test('reduced motion leaves no running animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByLabel('Reduced motion').check();
  await setLatency(page, '300');
  await noteField(page).fill('Quiet');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.locator('.settle[data-phase="pending"]')).toBeVisible();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test('composer stays typeable while a note is pending', async ({ page }) => {
  await page.goto('/');
  await setLatency(page, '2000');
  await noteField(page).fill('In flight');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.locator('.settle[data-phase="pending"]')).toBeVisible();
  await noteField(page).fill('Another thought');
  await expect(noteField(page)).toHaveValue('Another thought');
  await noteField(page).press('a');
  await expect(noteField(page)).toHaveValue('Another thoughta');
});

test('navigating away mid-request does not throw', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await setLatency(page, '2500');
  await noteField(page).fill('Leaving');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.locator('.settle[data-phase="pending"]')).toBeVisible();
  await page.goto('about:blank');
  await page.waitForTimeout(300);
  expect(errors).toEqual([]);
});
