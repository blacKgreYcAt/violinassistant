import { describe, it, expect } from 'vitest';
import {
  createBackup,
  parseBackup,
  describeBackup,
  backupFileName,
  BACKUP_FORMAT,
  BACKUP_VERSION,
} from './backup';
import type { Score } from './storage';

const score = (id: string, name = id): Score => ({
  id,
  name,
  type: 'file',
  data: 'data:image/png;base64,AAAA',
  date: 1,
});

const fullPayload = {
  scores: [score('s1'), score('s2')],
  folders: [{ id: 'f1', name: '巴哈', color: '#fff' }],
  practiceHistory: [{ id: 'p1', date: '2026-10-01', durationSeconds: 600, timestamp: 1 }],
  routines: [{ id: 'r1', name: '每日暖身', steps: [] }],
  rewards: {
    currentNotes: 3,
    totalNotes: 13,
    pieces: ['bow-1'],
    concertmasterUnlocked: false,
    unrewardedSeconds: 60,
  },
  goals: [
    { id: 'g1', title: '每週 5 小時', type: 'time' as const, target: 300, current: 0, period: 'weekly' as const },
  ],
};

describe('createBackup', () => {
  it('包含全部六種資料，不只樂譜', () => {
    // 原本的備份只有 JSON.stringify(scores)，換裝置會丟掉其餘全部
    const b = createBackup(fullPayload, 12345);
    expect(b.scores).toHaveLength(2);
    expect(b.folders).toHaveLength(1);
    expect(b.practiceHistory).toHaveLength(1);
    expect(b.routines).toHaveLength(1);
    expect(b.goals).toHaveLength(1);
    expect(b.rewards?.totalNotes).toBe(13);
  });

  it('標上格式與版本，之後才認得出來', () => {
    const b = createBackup(fullPayload);
    expect(b.format).toBe(BACKUP_FORMAT);
    expect(b.version).toBe(BACKUP_VERSION);
  });

  it('可以完整走一趟 JSON 來回', () => {
    const b = createBackup(fullPayload, 999);
    const result = parseBackup(JSON.stringify(b));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.practiceHistory).toEqual(fullPayload.practiceHistory);
    expect(result.backup.rewards).toEqual(fullPayload.rewards);
    expect(result.legacy).toBe(false);
  });
});

describe('parseBackup — 舊格式', () => {
  it('舊版備份（整個檔案就是樂譜陣列）仍讀得回來', () => {
    // 使用者手上可能還留著舊版匯出的檔案，不能因為換格式就讀不了
    const result = parseBackup(JSON.stringify([score('old1'), score('old2')]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.legacy).toBe(true);
    expect(result.backup.scores).toHaveLength(2);
    // 舊格式本來就沒有這些資料，要是空的而不是 undefined
    expect(result.backup.practiceHistory).toEqual([]);
    expect(result.backup.rewards).toBeNull();
  });

  it('空陣列算合法的舊備份', () => {
    const result = parseBackup('[]');
    expect(result.ok).toBe(true);
  });

  it('剛好是陣列但不是樂譜的 JSON 要被擋下來', () => {
    // 否則隨便一個陣列 JSON 就能把使用者的樂譜全部洗掉
    const result = parseBackup(JSON.stringify([{ foo: 'bar' }]));
    expect(result.ok).toBe(false);
  });
});

describe('parseBackup — 擋掉壞檔案', () => {
  it('不是 JSON', () => {
    const r = parseBackup('這不是 JSON');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain('JSON');
  });

  it('是 JSON 但不是備份檔', () => {
    expect(parseBackup(JSON.stringify({ hello: 'world' })).ok).toBe(false);
  });

  it('format 對但缺少樂譜欄位', () => {
    const r = parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1 }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain('樂譜');
  });

  it('來自更新版本的備份要擋下並說明原因', () => {
    // 硬讀新版格式可能只讀進一半，比明確拒絕更糟
    const r = parseBackup(
      JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION + 1, scores: [] })
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain('更新版本');
  });

  it('壞掉的個別樂譜會被濾掉，其餘仍可匯入', () => {
    const r = parseBackup(
      JSON.stringify({
        format: BACKUP_FORMAT,
        version: 1,
        scores: [score('good'), { id: 'bad' }],
      })
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.backup.scores).toHaveLength(1);
    expect(r.backup.scores[0].id).toBe('good');
  });

  it('缺少的欄位會補成空值，不會變成 undefined 害後續爆掉', () => {
    const r = parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1, scores: [] }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.backup.folders).toEqual([]);
    expect(r.backup.routines).toEqual([]);
    expect(r.backup.goals).toEqual([]);
  });
});

describe('describeBackup', () => {
  it('列出即將被取代的東西，而不是只說「確定匯入嗎」', () => {
    const text = describeBackup(createBackup(fullPayload));
    expect(text).toContain('2 份樂譜');
    expect(text).toContain('1 筆練習紀錄');
    expect(text).toContain('集點卡進度');
  });

  it('沒有的項目不會列出來', () => {
    const text = describeBackup(
      createBackup({
        scores: [score('s1')],
        folders: [],
        practiceHistory: [],
        routines: [],
        rewards: null,
        goals: [],
      })
    );
    expect(text).toBe('1 份樂譜');
  });
});

describe('backupFileName', () => {
  it('含日期方便辨識', () => {
    expect(backupFileName(new Date(2026, 9, 12))).toBe('violinassistant-backup-2026-10-12.json');
  });

  it('月份與日期補零', () => {
    expect(backupFileName(new Date(2026, 0, 5))).toBe('violinassistant-backup-2026-01-05.json');
  });
});
