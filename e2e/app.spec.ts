import { test, expect } from '@playwright/test';
import { openApp, openLibraryTab, collectPageErrors, createRoutine } from './helpers';

test.describe('基本運作', () => {
  test('App 能開起來，且沒有 console 錯誤', async ({ page }) => {
    const errors = collectPageErrors(page);
    await openApp(page);

    await expect(page.getByTestId('metronome')).toBeVisible();
    await expect(page.getByTestId('timer')).toBeVisible();

    expect(errors, `發生了 console 錯誤：\n${errors.join('\n')}`).toEqual([]);
  });

  test('開場畫面可以點擊跳過，不必等滿 3.5 秒', async ({ page }) => {
    await page.goto('/');
    await page.getByText('點擊畫面任一處可直接進入').waitFor({ state: 'visible' });

    // 只量「按下去到進入主畫面」這一段。
    // 若把 page.goto 的載入時間也算進來，量到的是載入+動畫，驗不到跳過本身。
    const clickedAt = Date.now();
    await page.getByText('點擊畫面任一處可直接進入').click();
    await expect(page.getByRole('button', { name: '練習工具' })).toBeVisible();

    // 原本固定要等滿 3.5 秒才會進主畫面；點擊跳過應該是即時的
    expect(Date.now() - clickedAt).toBeLessThan(1_500);
  });
});

test.describe('節拍器', () => {
  test('可以啟動，且拍點燈號會隨拍子前進', async ({ page }) => {
    await openApp(page);

    const metronome = page.getByTestId('metronome');
    await metronome.getByRole('button', { name: '開始' }).click();
    await expect(metronome.getByRole('button', { name: '停止' })).toBeVisible();

    const activeDot = () =>
      metronome.locator('[data-testid="beat-dot"][data-active="true"]');

    // 任何時刻都應該恰好只有一顆亮著
    await expect(activeDot()).toHaveCount(1);

    const indexOfActive = async () => {
      const dots = metronome.locator('[data-testid="beat-dot"]');
      const states = await dots.evaluateAll((els) =>
        els.map((el) => el.getAttribute('data-active') === 'true')
      );
      return states.indexOf(true);
    };

    // 100 BPM 下每拍 0.6 秒，等 1.5 秒必定換過拍子。
    // 這裡要驗的是 drawLoop 真的有在跑 —— 先前燈號是在「排程當下」就更新，
    // 會比聲音早最多 100ms；改成依 audioContext 時鐘對齊後仍須確認它會前進。
    const before = await indexOfActive();
    await expect
      .poll(indexOfActive, { timeout: 5_000, message: '拍點燈號沒有前進' })
      .not.toBe(before);

    await expect(activeDot()).toHaveCount(1);
  });
});

test.describe('練習計時器', () => {
  test('按下開始後會倒數', async ({ page }) => {
    await openApp(page);

    const timer = page.getByTestId('timer');
    const remaining = timer.getByTestId('timer-remaining');
    await expect(remaining).toHaveText('30:00');

    await timer.getByRole('button', { name: '開始' }).click();
    await expect(timer.getByRole('button', { name: '暫停' })).toBeVisible();

    await expect
      .poll(async () => await remaining.textContent(), {
        timeout: 8_000,
        message: '計時器沒有倒數',
      })
      .not.toBe('30:00');
  });
});

test.describe('練習計畫', () => {
  test('建立計畫 → 開始練習 → 計時器接手執行', async ({ page }) => {
    await openApp(page);
    await openLibraryTab(page);

    await createRoutine(page, 'E2E 暖身', '音階練習', 7);

    // 這整條路徑先前是死碼：PracticeDashboard 沒有被掛上畫面，
    // activeRoutine 永遠是 null，Timer 裡的計畫模式永遠跑不到。
    await page.getByRole('button', { name: '開始練習' }).click();

    // 按下開始後應自動切回「練習工具」分頁，否則使用者看不到任何反應
    const timer = page.getByTestId('timer');
    await expect(timer.getByText('計畫執行中')).toBeVisible();
    await expect(timer.getByText('音階練習')).toBeVisible();
    await expect(timer.getByTestId('timer-remaining')).toHaveText('07:00');
  });
});

test.describe('練習紀錄', () => {
  test('手動補登會寫進今日練習時間', async ({ page }) => {
    await openApp(page);
    await openLibraryTab(page);

    const history = page.getByTestId('practice-history');
    await expect(history.getByTestId('today-minutes')).toHaveText('0');

    // 這顆按鈕先前按下去完全沒有反應：表單從未被渲染、handleManualAdd 也從未被呼叫
    await history.getByRole('button', { name: '手動補登' }).click();

    const minutesInput = history.locator('input[type="number"]');
    await expect(minutesInput).toBeVisible();
    await minutesInput.fill('45');
    await history.getByRole('button', { name: '新增' }).click();

    await expect(history.getByTestId('today-minutes')).toHaveText('45');
  });
});
