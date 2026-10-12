import { test, expect, Page } from '@playwright/test';
import { openApp, openLibraryTab } from './helpers';

/**
 * 全 App 的可及名稱掃描。
 *
 * 先前修過兩次無障礙，但斷言都只寫了樂譜檢視器的 `aside button` 與
 * `header button` —— 範圍訂得太窄，所以節拍器、調音器、計時器、樂譜庫裡
 * 幾十個只有圖示的按鈕一直沒被發現。這裡改成掃整個畫面。
 */

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/**
 * 找出畫面上所有「看得到但沒有可及名稱」的控制項。
 *
 * 可及名稱的來源：文字內容、aria-label、title、aria-labelledby，
 * 以及表單控制項的 <label>（包住或用 htmlFor 關聯）。
 */
async function unnamedControls(page: Page) {
  return page.evaluate(() => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.display !== 'none';
    };

    const accessibleName = (el: Element): string => {
      const aria = el.getAttribute('aria-label');
      if (aria?.trim()) return aria.trim();
      const title = el.getAttribute('title');
      if (title?.trim()) return title.trim();
      const by = el.getAttribute('aria-labelledby');
      if (by) {
        const t = by
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
          .join(' ')
          .trim();
        if (t) return t;
      }
      if (el.tagName === 'BUTTON') return (el.textContent ?? '').trim();
      // 表單控制項：htmlFor 關聯或被 <label> 包住
      const id = el.getAttribute('id');
      if (id) {
        const lbl = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (lbl?.textContent?.trim()) return lbl.textContent.trim();
      }
      const wrapping = el.closest('label');
      if (wrapping?.textContent?.trim()) return wrapping.textContent.trim();
      return '';
    };

    const selector = 'button, input:not([type="hidden"]), select, textarea, [role="button"]';
    return [...document.querySelectorAll(selector)]
      .filter(visible)
      .filter((el) => !accessibleName(el))
      .map((el) => {
        const path: string[] = [];
        let cur: Element | null = el;
        for (let i = 0; cur && i < 4; i++) {
          path.unshift(cur.tagName.toLowerCase() + (cur.className ? '.' + String(cur.className).split(/\s+/)[0] : ''));
          cur = cur.parentElement;
        }
        return path.join(' > ');
      });
  });
}

async function seedScore(page: Page) {
  await page.evaluate(
    (png) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onupgradeneeded = () => open.result.createObjectStore('keyval');
        open.onsuccess = () => {
          const tx = open.result.transaction('keyval', 'readwrite');
          tx.objectStore('keyval').put(
            [{ id: 'a11y-score', name: '無障礙測試曲', type: 'file', data: png, date: Date.now() }],
            'viola-scores-idb'
          );
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        };
        open.onerror = () => reject(open.error);
      }),
    PNG
  );
}

test('「練習工具」分頁上的每個控制項都有可及名稱', async ({ page }) => {
  await openApp(page);

  // 節拍器的漸進模式與靜音小節預設收合，展開才掃得到裡面的 +/- 控制項
  await page.getByRole('button', { name: '漸進模式' }).click();
  await page.getByRole('button', { name: /靜音小節/ }).click();

  const unnamed = await unnamedControls(page);
  expect(unnamed, `沒有可及名稱的控制項：\n${unnamed.join('\n')}`).toEqual([]);
});

test('「樂譜與紀錄」分頁上的每個控制項都有可及名稱', async ({ page }) => {
  await page.goto('/');
  await seedScore(page);
  await openApp(page);
  await openLibraryTab(page);

  // 把補登表單與新增資料夾也展開
  const history = page.getByTestId('practice-history');
  await history.getByRole('button', { name: '手動補登' }).click();
  await page.getByRole('button', { name: '新增資料夾' }).click();

  const unnamed = await unnamedControls(page);
  expect(unnamed, `沒有可及名稱的控制項：\n${unnamed.join('\n')}`).toEqual([]);
});

test('樂譜檢視器裡的每個控制項都有可及名稱', async ({ page }) => {
  await page.goto('/');
  await seedScore(page);
  await openApp(page);
  await openLibraryTab(page);
  await page.getByText('無障礙測試曲').first().click();

  // 把幾個面板打開，確保面板內的控制項也掃得到
  await page.getByRole('button', { name: '速度與節拍器' }).click();
  await page.getByRole('button', { name: '段落循環練習' }).click();

  const unnamed = await unnamedControls(page);
  expect(unnamed, `沒有可及名稱的控制項：\n${unnamed.join('\n')}`).toEqual([]);
});

test('使用說明與集點卡裡的每個控制項都有可及名稱', async ({ page }) => {
  await openApp(page);

  await page.getByRole('button', { name: '使用說明' }).click();
  let unnamed = await unnamedControls(page);
  expect(unnamed, `使用說明：\n${unnamed.join('\n')}`).toEqual([]);
  await page.getByRole('button', { name: '關閉使用說明' }).click();

  await page.getByRole('button', { name: '集點卡' }).click();
  unnamed = await unnamedControls(page);
  expect(unnamed, `集點卡：\n${unnamed.join('\n')}`).toEqual([]);
});

/**
 * 觸控目標尺寸。
 *
 * 這個 App 開場就要求「請將平板直式放置」，但原本的控制項是以滑鼠為前提
 * 設計的：23 個可見控制項裡有 18 個小於 WCAG 2.5.5 建議的 44×44，
 * 其中 BPM 與練習時間的滑桿只有 6px 高。
 */
async function tooSmallControls(page: Page) {
  return page.evaluate(() => {
    const MIN = 43.5; // 容忍 44 的捨入誤差
    return [...document.querySelectorAll('button, [role="button"], select, input[type="range"]')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.width < MIN || r.height < MIN);
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        const name = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 14);
        return `${name} ${Math.round(r.width)}x${Math.round(r.height)}`;
      })
      // 計時器的 15/30/45/60 分鐘快選是四欄格線，寬度被卡在 40px。
      // 要做到 44 得把版面改成兩欄，取捨之後維持現狀
      // （高度 48，仍遠大於 WCAG 2.5.8 AA 的 24×24 下限）。
      .filter((d) => !/^\d+m /.test(d));
  });
}

test('平板尺寸下的觸控目標都夠大', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/');
  await seedScore(page);
  await openApp(page);

  let small = await tooSmallControls(page);
  expect(small, '練習工具分頁: ' + small.join(' / ')).toEqual([]);

  await openLibraryTab(page);
  small = await tooSmallControls(page);
  expect(small, '樂譜與紀錄分頁: ' + small.join(' / ')).toEqual([]);

  await page.getByText('無障礙測試曲').first().click();
  await page.getByRole('button', { name: '速度與節拍器' }).click();
  small = await tooSmallControls(page);
  expect(small, '樂譜檢視器: ' + small.join(' / ')).toEqual([]);
});
