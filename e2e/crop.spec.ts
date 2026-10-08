import { test, expect, Page } from '@playwright/test';
import { openApp, openLibraryTab } from './helpers';

/**
 * 樂譜裁切。
 *
 * 手機拍的樂譜常常帶到桌面或大片留白，裁切就是把真正要看的那一塊框出來。
 *
 * 這個功能原本只做了一半：裁切視窗會把 cropData 存起來，但沒有任何地方讀它
 * ——使用者認真調好範圍按下「套用裁切」，畫面上不會有任何改變。
 */

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const SCORE_NAME = '裁切測試曲';

async function seedScore(page: Page, pages: number) {
  await page.evaluate(
    ([name, png, count]) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onupgradeneeded = () => open.result.createObjectStore('keyval');
        open.onsuccess = () => {
          const tx = open.result.transaction('keyval', 'readwrite');
          const data =
            (count as number) > 1 ? Array((count as number)).fill(png) : png;
          tx.objectStore('keyval').put(
            [{ id: 'crop-score', name, type: 'file', data, date: Date.now() }],
            'viola-scores-idb'
          );
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        };
        open.onerror = () => reject(open.error);
      }),
    [SCORE_NAME, PNG, pages] as [string, string, number]
  );
}

async function openCropModal(page: Page, pages = 1) {
  await page.goto('/');
  await seedScore(page, pages);
  await openApp(page);
  await openLibraryTab(page);
  await page.getByRole('button', { name: '裁切樂譜' }).first().click();
  await expect(page.getByTestId('crop-preview')).toBeVisible();
}

/** 把某個角落的控點拖到預覽框的指定比例位置（0~1） */
async function dragHandle(
  page: Page,
  corner: 'nw' | 'ne' | 'sw' | 'se',
  toX: number,
  toY: number
) {
  const preview = (await page.getByTestId('crop-preview').boundingBox())!;
  const handle = (await page.getByTestId(`crop-handle-${corner}`).boundingBox())!;

  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(preview.x + preview.width * toX, preview.y + preview.height * toY, {
    steps: 10,
  });
  await page.mouse.up();
}

/** 讀出裁切框目前的百分比 */
async function cropBoxPercent(page: Page) {
  const style = (await page.getByTestId('crop-box').getAttribute('style')) ?? '';
  const num = (prop: string) =>
    Number(new RegExp(`${prop}:\\s*(-?[\\d.]+)%`).exec(style)?.[1] ?? NaN);
  return { x: num('left'), y: num('top'), width: num('width'), height: num('height') };
}

async function openViewer(page: Page) {
  await page.getByText(SCORE_NAME).first().click();
  await expect(page.getByTestId('score-crop-content')).toBeVisible();
}

async function cropTransform(page: Page) {
  return (await page.getByTestId('score-crop-content').getAttribute('style')) ?? '';
}

test('套用裁切後，樂譜檢視器真的只顯示框起來的那一塊', async ({ page }) => {
  await openCropModal(page);

  await dragHandle(page, 'se', 0.7, 0.6);
  await dragHandle(page, 'nw', 0.1, 0.15);

  const box = await cropBoxPercent(page);
  expect(box.x).toBeCloseTo(10, 0);
  expect(box.y).toBeCloseTo(15, 0);
  expect(box.width).toBeCloseTo(60, 0);
  expect(box.height).toBeCloseTo(45, 0);

  await page.getByRole('button', { name: '套用裁切' }).click();
  await openViewer(page);

  // 迴歸測試：這整段原本完全沒有效果——cropData 存了，但沒有任何地方讀它。
  const transform = await cropTransform(page);
  const scale = /scale\(([\d.]+), ([\d.]+)\)/.exec(transform);
  expect(scale, `沒有套用裁切變形：${transform}`).not.toBeNull();
  expect(Number(scale![1])).toBeCloseTo(100 / box.width, 1);
  expect(Number(scale![2])).toBeCloseTo(100 / box.height, 1);
  expect(transform).toContain(`translate(-${box.x}%, -${box.y}%)`);
});

test('沒有裁切的樂譜不會被變形', async ({ page }) => {
  await page.goto('/');
  await seedScore(page, 1);
  await openApp(page);
  await openLibraryTab(page);
  await openViewer(page);

  expect(await cropTransform(page)).toContain('scale(1, 1) translate(0%, 0%)');
  // 沒裁切就不該出現「顯示完整頁面」的按鈕
  await expect(page.getByRole('button', { name: '顯示完整頁面' })).toHaveCount(0);
});

test('裁切後可以暫時切回完整頁面', async ({ page }) => {
  await openCropModal(page);
  await dragHandle(page, 'se', 0.5, 0.5);
  await page.getByRole('button', { name: '套用裁切' }).click();
  await openViewer(page);

  expect(await cropTransform(page)).not.toContain('scale(1, 1)');

  // 裁壞了總要有辦法看到被切掉的部分
  await page.getByRole('button', { name: '顯示完整頁面' }).click();
  expect(await cropTransform(page)).toContain('scale(1, 1) translate(0%, 0%)');

  await page.getByRole('button', { name: '回到裁切範圍' }).click();
  expect(await cropTransform(page)).not.toContain('scale(1, 1)');
});

test('裁切設定重新開啟後仍在', async ({ page }) => {
  await openCropModal(page);
  await dragHandle(page, 'se', 0.6, 0.5);
  await page.getByRole('button', { name: '套用裁切' }).click();
  const before = await (async () => {
    await openViewer(page);
    return cropTransform(page);
  })();

  await page.reload();
  await openApp(page);
  await openLibraryTab(page);
  await openViewer(page);

  expect(await cropTransform(page)).toBe(before);
});

test('迴歸：預設整頁時拖右下角，裁切框不會歸零', async ({ page }) => {
  await openCropModal(page);

  // 原本的實作把夾值寫成 Math.min(100 - height, height + 5)，
  // 整頁（height=100）時算出 min(0, 105) = 0，一動高度就歸零。
  await dragHandle(page, 'se', 0.6, 0.7);

  const box = await cropBoxPercent(page);
  expect(box.width).toBeCloseTo(60, 0);
  expect(box.height).toBeCloseTo(70, 0);
});

test('裁切框不會被拖到小於下限或超出頁面', async ({ page }) => {
  await openCropModal(page);

  // 往左上拖過頭
  await dragHandle(page, 'se', -1, -1);
  let box = await cropBoxPercent(page);
  expect(box.width).toBeGreaterThanOrEqual(10);
  expect(box.height).toBeGreaterThanOrEqual(10);

  // 往右下拖出頁面
  await dragHandle(page, 'se', 2, 2);
  box = await cropBoxPercent(page);
  expect(box.x + box.width).toBeLessThanOrEqual(100.01);
  expect(box.y + box.height).toBeLessThanOrEqual(100.01);
});

test('多頁樂譜：換頁時不會把上一頁的裁切框帶過去', async ({ page }) => {
  await openCropModal(page, 3);

  await dragHandle(page, 'se', 0.5, 0.5);
  const firstPage = await cropBoxPercent(page);
  expect(firstPage.width).toBeCloseTo(50, 0);

  await page.getByRole('button', { name: '下一頁' }).click();

  // 第 2 頁沒有設定過，應該是整頁
  const secondPage = await cropBoxPercent(page);
  expect(secondPage.width).toBeCloseTo(100, 0);
  expect(secondPage.height).toBeCloseTo(100, 0);

  await page.getByRole('button', { name: '上一頁' }).click();
  // 回到第 1 頁時……這一頁的框還沒按「套用」，所以也是整頁；
  // 重點是兩頁之間不會互相污染
  await expect(page.getByText('第 1 / 3 頁')).toBeVisible();
});
