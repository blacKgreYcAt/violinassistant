import { test, expect, Page } from '@playwright/test';
import { openApp, openLibraryTab, skipWithoutWebAudio } from './helpers';

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

test('鍵盤焦點看得見', async ({ page }) => {
  await openApp(page);

  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');

  // .transition-colors 把 outline-color 也列入過場屬性，
  // 立刻量會拿到過場中的瞬時值
  await page.waitForTimeout(400);

  const focus = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const cs = getComputedStyle(el);
    return {
      name: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 20),
      style: cs.outlineStyle,
      width: parseFloat(cs.outlineWidth),
      color: cs.outlineColor,
    };
  });

  expect(focus, '按 Tab 之後沒有任何元素取得焦點').not.toBeNull();
  expect(focus!.style, `${focus!.name} 的焦點沒有外框`).not.toBe('none');
  expect(focus!.width).toBeGreaterThanOrEqual(2);
  // 用主色而不是瀏覽器預設的細灰框，深色主題下才看得清楚
  expect(focus!.color).toBe('rgb(242, 125, 38)');
});

test('開啟「減少動態效果」時不會有長時間的動畫', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openApp(page);

  // 前庭敏感的使用者會因為這些動畫不適；不是整個關掉而是縮到極短，
  // 因為有些元件依賴動畫結束的時間點
  const durations = await page.evaluate(() =>
    [...document.querySelectorAll('button, [class*="animate-"]')]
      .slice(0, 40)
      .map((el) => {
        const cs = getComputedStyle(el);
        return Math.max(
          ...cs.transitionDuration.split(',').map((d) => parseFloat(d) || 0),
          ...cs.animationDuration.split(',').map((d) => parseFloat(d) || 0)
        );
      })
  );

  const longest = Math.max(...durations);
  expect(longest, `最長的動畫是 ${longest}s`).toBeLessThan(0.05);
});

test('沒有開啟「減少動態效果」時動畫照常', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openApp(page);

  // 確認上面那個測試不是因為根本沒有動畫而假性通過
  const longest = await page.evaluate(() =>
    Math.max(
      ...[...document.querySelectorAll('button')].map((el) =>
        Math.max(...getComputedStyle(el).transitionDuration.split(',').map((d) => parseFloat(d) || 0))
      )
    )
  );
  expect(longest).toBeGreaterThan(0.05);
});

test('動態變化的狀態有提供給螢幕閱讀器', async ({ page }) => {
  await skipWithoutWebAudio(page);
  await openApp(page);

  // 這些區域刻意不播報每一拍、每一秒或 Hz —— 那會把螢幕閱讀器洗版到
  // 無法使用。只播報「狀態改變」這種真正需要知道的事。
  const regions = await page.evaluate(() =>
    [...document.querySelectorAll('[role="status"], [aria-live]')].map((el) => ({
      role: el.getAttribute('role'),
      srOnly: el.className.includes('sr-only'),
    }))
  );
  expect(regions.length, '全站沒有任何狀態播報區域').toBeGreaterThanOrEqual(3);

  // 節拍器：開始後要播報
  const metronome = page.getByTestId('metronome');
  await metronome.getByRole('button', { name: '開始' }).click();
  await expect(metronome.locator('[role="status"]')).toHaveText('節拍器播放中');
  await metronome.getByRole('button', { name: '停止' }).click();
  await expect(metronome.locator('[role="status"]')).toHaveText('');
});

test('彈窗按 Esc 可以關閉', async ({ page }) => {
  await openApp(page);

  // 原本所有彈窗都只能用滑鼠點關閉鈕，只用鍵盤的人進得去出不來
  const modals: [string, string][] = [
    ['使用說明', '關閉使用說明'],
    ['集點卡', '關閉集點卡'],
    ['練習錄影', '關閉'],
  ];

  for (const [open, closeLabel] of modals) {
    await page.getByRole('button', { name: open, exact: true }).click();
    const close = page.getByRole('button', { name: closeLabel }).first();
    await expect(close, `${open} 沒有打開`).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(close, `${open} 按 Esc 後沒有關閉`).toHaveCount(0);
  }
});
