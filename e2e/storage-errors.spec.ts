import { test, expect } from '@playwright/test';
import { openApp, openLibraryTab } from './helpers';

/**
 * 儲存失敗時使用者看得到。
 *
 * 原本所有儲存失敗都只寫進 console：使用者以為練習紀錄存好了，其實沒有。
 * 對一個「累積紀錄」的 App 來說，默默掉資料是最糟的失敗方式。
 *
 * 這裡攔的是真實路徑 —— 把 IndexedDB 的 put 換成會丟 QuotaExceededError，
 * 再透過 UI 實際觸發一次寫入。
 */

/** 讓所有 IndexedDB 寫入失敗，模擬配額用盡 */
async function breakWrites(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    // idb-keyval 的 set() 會在交易回呼裡同步呼叫 store.put()，然後等交易完成。
    // 所以要讓寫入失敗，必須讓 put 同步丟出 —— 只在請求物件上補發 error 事件
    // 是沒用的，交易仍然會正常完成。
    IDBObjectStore.prototype.put = function () {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    };
  });
}

test('練習紀錄寫入失敗時會明確告知，而不是默默吞掉', async ({ page }) => {
  await breakWrites(page);
  await openApp(page);
  await openLibraryTab(page);

  // 用「手動補登」觸發一次練習紀錄寫入
  const history = page.getByTestId('practice-history');
  await history.getByRole('button', { name: '手動補登' }).click();
  await history.locator('input[type="number"]').first().fill('45');
  await history.getByRole('button', { name: '新增' }).click();

  const toast = page.getByTestId('storage-error-toast').first();
  await expect(toast).toBeVisible({ timeout: 15_000 });
  await expect(toast).toContainText('空間不足');
  // 要給可行的下一步，不能只說「失敗」
  await expect(toast).toContainText(/刪掉|再試/);
  await expect(toast).toHaveAttribute('role', 'alert');
});

test('提示要能關掉，而且不會自己消失', async ({ page }) => {
  await openApp(page);

  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent('storage-error', {
        detail: { kind: 'write', message: '練習紀錄儲存失敗，這次的變更沒有保留下來。' },
      })
    );
  });

  const toast = page.getByTestId('storage-error-toast');
  await expect(toast).toBeVisible();

  // 這不是成功回饋，是「你剛做的事沒被保留」，不該自動消失
  await page.waitForTimeout(6000);
  await expect(toast).toBeVisible();

  await toast.getByRole('button', { name: '關閉提示' }).click();
  await expect(toast).toHaveCount(0);
});

test('同一個錯誤重複發生時不會疊成一整面牆', async ({ page }) => {
  await openApp(page);

  await page.evaluate(() => {
    for (let i = 0; i < 6; i++) {
      window.dispatchEvent(
        new CustomEvent('storage-error', {
          detail: { kind: 'write', message: '練習紀錄儲存失敗，這次的變更沒有保留下來。' },
        })
      );
    }
  });

  // 配額用盡時每次寫入都會失敗，去重後只留一則
  await expect(page.getByTestId('storage-error-toast')).toHaveCount(1);
});
