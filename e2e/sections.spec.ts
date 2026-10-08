import { test, expect, Page } from '@playwright/test';
import { openApp, openLibraryTab } from './helpers';

/**
 * 樂譜段落循環練習。
 *
 * 把難的那幾小節框起來，練習時只亮出那一塊，並記錄練了幾遍、最快練到多少 BPM。
 *
 * 遍數可以手動 +1，也可以跟著節拍器自動算。節拍器的小節事件在真實情境下
 * 要等好幾秒才來一次，這裡直接送 metronome-bar 事件驗證計數邏輯；
 * 「事件本身發得對不對」由 Metronome 自己的測試與單元測試負責。
 */

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const SCORE_NAME = '段落測試曲';

async function seedScore(page: Page) {
  await page.evaluate(
    ([name, png]) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onupgradeneeded = () => open.result.createObjectStore('keyval');
        open.onsuccess = () => {
          const tx = open.result.transaction('keyval', 'readwrite');
          tx.objectStore('keyval').put(
            [{ id: 'section-score', name, type: 'file', data: png, date: Date.now() }],
            'viola-scores-idb'
          );
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        };
        open.onerror = () => reject(open.error);
      }),
    [SCORE_NAME, PNG] as [string, string]
  );
}

async function openSectionPanel(page: Page) {
  await page.goto('/');
  await seedScore(page);
  await openApp(page);
  await openLibraryTab(page);
  await page.getByText(SCORE_NAME).first().click();
  await page.getByRole('button', { name: '段落循環練習' }).click();
}

/** 在樂譜上拖曳出一個段落（以框選層的實際位置換算） */
async function dragSection(page: Page) {
  const layer = page.getByTestId('section-select-layer');
  await expect(layer).toBeVisible();
  const box = await layer.boundingBox();
  if (!box) throw new Error('找不到框選層');

  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.45, { steps: 8 });
  await page.mouse.up();
}

async function createSection(page: Page, name: string) {
  await page.getByRole('button', { name: '框選新段落' }).click();
  await dragSection(page);
  await page.getByLabel('段落名稱').fill(name);
  await page.getByRole('button', { name: '儲存段落' }).click();
}

/** 送出節拍器的小節事件 */
async function sendBars(page: Page, completedBars: number) {
  await page.evaluate((n) => {
    window.dispatchEvent(new CustomEvent('metronome-bar', { detail: { completedBars: n } }));
  }, completedBars);
}

test('框選段落後會亮出那一塊，其餘壓暗', async ({ page }) => {
  await openSectionPanel(page);
  await expect(page.getByText(/尚未建立段落/)).toBeVisible();

  await createSection(page, '第 45-52 小節');

  const highlight = page.getByTestId('section-highlight');
  await expect(highlight).toBeVisible();

  // 高亮框的位置要對應剛才拖曳的範圍，而不是整頁或左上角。
  // 百分比會有不到 1% 的誤差（滑鼠落點換算成比例），所以比數值不比字串。
  const style = (await highlight.getAttribute('style')) ?? '';
  const percentOf = (prop: string) =>
    Number(new RegExp(`${prop}:\\s*([\\d.]+)%`).exec(style)?.[1] ?? NaN);
  expect(percentOf('left')).toBeCloseTo(20, 0);
  expect(percentOf('top')).toBeCloseTo(25, 0);
  expect(percentOf('width')).toBeCloseTo(50, 0);
  expect(percentOf('height')).toBeCloseTo(20, 0);
  // 靠超大的 box-shadow 把框外壓暗
  expect(style).toContain('box-shadow');

  await expect(page.getByTestId('section-row')).toContainText('第 45-52 小節');
  await expect(page.getByTestId('section-row')).toContainText('第 1 頁');
});

test('手滑點一下不會留下看不見的段落', async ({ page }) => {
  await openSectionPanel(page);
  await page.getByRole('button', { name: '框選新段落' }).click();

  const layer = page.getByTestId('section-select-layer');
  const box = (await layer.boundingBox())!;
  // 只是點一下，沒有拖曳
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  // 不該跳出命名欄，也不該建立段落
  await expect(page.getByLabel('段落名稱')).toHaveCount(0);
  await expect(page.getByTestId('section-row')).toHaveCount(0);
});

test('遍數可以手動加，也會跟著節拍器自動算', async ({ page }) => {
  await openSectionPanel(page);
  await createSection(page, '換弦段');

  const reps = page.getByTestId('section-reps');
  await expect(reps).toHaveText('0');

  await page.getByRole('button', { name: '+1 遍' }).click();
  await expect(reps).toHaveText('1');

  // 預設每 4 小節算一遍：3 小節還不算
  await sendBars(page, 3);
  await expect(reps).toHaveText('1');

  // 第 4 小節湊滿，才加一遍
  await sendBars(page, 1);
  await expect(reps).toHaveText('2');

  // 迴歸測試：分頁切到背景再切回來時，小節事件會一次補一整批。
  // 9 小節要算成 2 遍（餘 1），不能只加一遍把其餘丟掉。
  await sendBars(page, 9);
  await expect(reps).toHaveText('4');

  // 同時記下這個段落練到的最高速度
  await expect(page.getByTestId('section-row')).toContainText('最快 100 BPM');
});

test('關掉自動計數後，節拍器就不會再加遍數', async ({ page }) => {
  await openSectionPanel(page);
  await createSection(page, '不自動計數');

  await page.getByLabel('跟著節拍器自動計遍數').uncheck();
  await sendBars(page, 8);
  await expect(page.getByTestId('section-reps')).toHaveText('0');

  // 手動仍然可以加
  await page.getByRole('button', { name: '+1 遍' }).click();
  await expect(page.getByTestId('section-reps')).toHaveText('1');
});

test('每遍小節數可以改，改完照新的算', async ({ page }) => {
  await openSectionPanel(page);
  await createSection(page, '兩小節一遍');

  await page.getByLabel('每遍小節數').fill('2');
  await sendBars(page, 6);
  await expect(page.getByTestId('section-reps')).toHaveText('3');
});

test('段落與遍數重新開啟後仍在', async ({ page }) => {
  await openSectionPanel(page);
  await createSection(page, '要被記住的段落');
  await page.getByRole('button', { name: '+1 遍' }).click();
  await expect(page.getByTestId('section-reps')).toHaveText('1');

  await page.reload();
  await openApp(page);
  await openLibraryTab(page);
  await page.getByText(SCORE_NAME).first().click();
  await page.getByRole('button', { name: '段落循環練習' }).click();

  await expect(page.getByTestId('section-row')).toContainText('要被記住的段落');
  await expect(page.getByTestId('section-row')).toContainText('1 遍');
});

test('可以刪除段落', async ({ page }) => {
  await openSectionPanel(page);
  await createSection(page, '要刪掉的段落');
  await expect(page.getByTestId('section-row')).toHaveCount(1);

  await page.getByRole('button', { name: '刪除段落 要刪掉的段落' }).click();
  await expect(page.getByTestId('section-row')).toHaveCount(0);
  // 刪掉啟用中的段落後，高亮也要跟著消失
  await expect(page.getByTestId('section-highlight')).toHaveCount(0);
});

test('樂譜檢視器頂欄的按鈕都有可及名稱', async ({ page }) => {
  await openSectionPanel(page);

  // 迴歸測試：先前的無障礙修正只檢查了側欄（aside button），
  // 頂欄的關閉、節拍器、全螢幕這幾顆都只有圖示、沒有任何標籤。
  const unlabelled = await page
    .locator('header button')
    .evaluateAll((els) =>
      els
        .filter((el) => !el.getAttribute('aria-label') && !el.getAttribute('title'))
        .filter((el) => !el.textContent?.trim())
        .length
    );
  expect(unlabelled, '頂欄仍有按鈕缺少可及名稱').toBe(0);
});
