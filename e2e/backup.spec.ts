import { test, expect, Page } from '@playwright/test';
import { openApp, openLibraryTab } from './helpers';

/**
 * 備份與還原。
 *
 * 原本的備份只有 `JSON.stringify(scores)`，但使用說明寫著「更換裝置時，
 * 使用『匯入備份』即可還原所有內容」。換裝置的人會丟掉全部練習紀錄、
 * 集點卡進度、練習計畫與目標，資料夾不見還會讓樂譜失去分類。
 */

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

type Snapshot = Record<string, unknown>;

async function seedEverything(page: Page) {
  await page.evaluate((png) => {
    const put = (key: string, value: unknown) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onupgradeneeded = () => open.result.createObjectStore('keyval');
        open.onsuccess = () => {
          const tx = open.result.transaction('keyval', 'readwrite');
          tx.objectStore('keyval').put(value, key);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        };
        open.onerror = () => reject(open.error);
      });

    const now = Date.now();
    return Promise.all([
      put('viola-scores-idb', [
        { id: 's1', name: '備份測試曲', type: 'file', data: png, date: now, folderId: 'f1' },
      ]),
      put('viola-folders-idb', [{ id: 'f1', name: '巴哈', color: '#F27D26' }]),
      put('viola-practice-history', [
        { id: 'p1', date: '2026-10-01', durationSeconds: 3600, timestamp: now },
        { id: 'p2', date: '2026-10-05', durationSeconds: 1800, timestamp: now },
      ]),
      put('viola-routines-idb', [
        { id: 'r1', name: '每日暖身', steps: [{ id: 'st1', name: '音階', duration: 10 }] },
      ]),
      put('viola-rewards-idb', {
        currentNotes: 7,
        totalNotes: 27,
        pieces: ['bow-1', 'violin-2'],
        concertmasterUnlocked: false,
        unrewardedSeconds: 300,
      }),
      put('viola-goals-idb', [
        { id: 'g1', title: '每週 5 小時', type: 'time', target: 300, current: 120, period: 'weekly' },
      ]),
    ]);
  }, PNG);
}

/** 讀出所有資料，用來比對還原前後 */
async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const get = (key: string) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onsuccess = () => {
          const tx = open.result.transaction('keyval', 'readonly');
          const req = tx.objectStore('keyval').get(key);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        };
        open.onerror = () => reject(open.error);
      });

    return Promise.all([
      get('viola-scores-idb'),
      get('viola-folders-idb'),
      get('viola-practice-history'),
      get('viola-routines-idb'),
      get('viola-rewards-idb'),
      get('viola-goals-idb'),
    ]).then(([scores, folders, history, routines, rewards, goals]) => ({
      scores,
      folders,
      history,
      routines,
      rewards,
      goals,
    }));
  });
}

/** 按下「下載備份」並攔下產生的檔案內容 */
async function captureBackup(page: Page): Promise<string> {
  await page.evaluate(() => {
    const w = window as unknown as { __backup?: string };
    const origCreate = URL.createObjectURL;
    URL.createObjectURL = function (blob: Blob) {
      blob.text().then((t) => {
        w.__backup = t;
      });
      return origCreate.call(URL, blob);
    };
    // 不要真的觸發下載
    HTMLAnchorElement.prototype.click = function () {};
  });

  await page.getByRole('button', { name: '下載', exact: true }).click();

  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __backup?: string }).__backup))
    .toBeTruthy();

  return page.evaluate(() => (window as unknown as { __backup: string }).__backup);
}

test('備份涵蓋全部六種資料，不是只有樂譜', async ({ page }) => {
  await page.goto('/');
  await seedEverything(page);
  await openApp(page);
  await openLibraryTab(page);

  const backup = JSON.parse(await captureBackup(page));

  // 迴歸測試：原本這裡只有 scores
  expect(backup.format).toBe('violinassistant-backup');
  expect(backup.scores).toHaveLength(1);
  expect(backup.folders).toHaveLength(1);
  expect(backup.practiceHistory).toHaveLength(2);
  expect(backup.routines).toHaveLength(1);
  expect(backup.goals).toHaveLength(1);
  expect(backup.rewards.totalNotes).toBe(27);
});

test('換裝置情境：清空後匯入備份能完整還原', async ({ page }) => {
  await page.goto('/');
  await seedEverything(page);
  await openApp(page);
  await openLibraryTab(page);

  const before = await snapshot(page);
  const backup = await captureBackup(page);

  // 清空，模擬一台新裝置
  await page.evaluate(() => {
    const put = (key: string, value: unknown) =>
      new Promise((resolve) => {
        const open = indexedDB.open('keyval-store');
        open.onsuccess = () => {
          const tx = open.result.transaction('keyval', 'readwrite');
          tx.objectStore('keyval').put(value, key);
          tx.oncomplete = () => resolve(true);
        };
      });
    return Promise.all(
      [
        'viola-scores-idb',
        'viola-folders-idb',
        'viola-practice-history',
        'viola-routines-idb',
        'viola-goals-idb',
      ].map((k) => put(k, []))
    );
  });

  await page.reload();
  await openApp(page);
  await openLibraryTab(page);

  page.on('dialog', (d) => d.accept());
  await page.setInputFiles('input[type="file"][accept=".json"]', {
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup, 'utf-8'),
  });

  await expect.poll(async () => (await snapshot(page)).scores).toHaveLength(1);

  const after = await snapshot(page);
  expect(after.folders).toEqual(before.folders);
  expect(after.history).toEqual(before.history);
  expect(after.routines).toEqual(before.routines);
  expect(after.goals).toEqual(before.goals);
  expect(after.rewards).toEqual(before.rewards);
});

test('舊版備份（只有樂譜陣列）仍然讀得回來', async ({ page }) => {
  await page.goto('/');
  await openApp(page);
  await openLibraryTab(page);

  page.on('dialog', (d) => d.accept());
  const legacy = JSON.stringify([
    { id: 'old', name: '舊備份樂譜', type: 'file', data: PNG, date: 1 },
  ]);
  await page.setInputFiles('input[type="file"][accept=".json"]', {
    name: 'old-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(legacy, 'utf-8'),
  });

  await expect.poll(async () => (await snapshot(page)).scores).toHaveLength(1);
});

test('壞掉的檔案會被擋下，不會把現有資料洗掉', async ({ page }) => {
  await page.goto('/');
  await seedEverything(page);
  await openApp(page);
  await openLibraryTab(page);

  const messages: string[] = [];
  page.on('dialog', (d) => {
    messages.push(d.message());
    d.accept();
  });

  await page.setInputFiles('input[type="file"][accept=".json"]', {
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{ 這不是 JSON', 'utf-8'),
  });

  await expect.poll(() => messages.length).toBeGreaterThan(0);
  expect(messages[0]).toContain('匯入失敗');

  // 既有資料必須原封不動
  const after = await snapshot(page);
  expect(after.scores).toHaveLength(1);
  expect(after.history).toHaveLength(2);
});
